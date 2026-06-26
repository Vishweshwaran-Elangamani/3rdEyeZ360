# controllers/request_controller.py
from config.database import get_db
from services.assessment_service import log_audit
from services.notification_service import create_notification
from datetime import datetime
import uuid

async def create_request(assessment_id: str, exam_id: str, candidate_id: str, req_type: str, reason: str):
    db = get_db()
    req = {
        "request_id":    f"REQ-{uuid.uuid4().hex[:8].upper()}",
        "assessment_id": assessment_id,
        "exam_id":       exam_id,
        "candidate_id":  candidate_id,
        "type":          req_type,
        "reason":        reason,
        "status":        "PENDING",
        "reviewed_by":   None,
        "reviewed_at":   None,
        "created_at":    datetime.utcnow(),
    }
    await db.requests.insert_one(req)

    status = "LATEENTRYREQUESTED" if req_type == "LATEENTRY" else "REENTRYREQUESTED"
    await db.assessments.update_one(
        {"assessment_id": assessment_id},
        {"$set": {"status": status}}
    )
    return {k: str(v) if k == "_id" else v for k, v in req.items() if k != "_id"}


async def review_request(request_id: str, decision: str, examiner_id: str):
    db = get_db()
    req = await db.requests.find_one({"request_id": request_id})
    if not req:
        return None

    req_type = req.get("type", "")  # ← FIX: get req_type from the document

    await db.requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status":      decision,
            "reviewed_by": examiner_id,
            "reviewed_at": datetime.utcnow()
        }}
    )

    if decision == "APPROVED":
        new_status = "LATEENTRYAPPROVED" if req_type == "LATEENTRY" else "REENTRYAPPROVED"
        await db.assessments.update_one(
            {"assessment_id": req["assessment_id"]},
            {"$set": {"status": new_status}}
        )

    await log_audit(
        examiner_id,
        f"REVIEW_{req_type}",
        reason=decision,
        assessment_id=req["assessment_id"],
        exam_id=req["exam_id"]
    )
    await create_notification(
        req["candidate_id"],
        f"Request {decision}",
        f"Your {req_type} request has been {decision}",
        "Approval" if decision == "APPROVED" else "Rejection"
    )
    return {"message": f"Request {decision}"}


async def get_pending_requests(exam_id: str):
    db = get_db()
    reqs = await db.requests.find({"exam_id": exam_id, "status": "PENDING"}).to_list(None)
    return [{k: str(v) if k == "_id" else v for k, v in r.items() if k != "_id"} for r in reqs]