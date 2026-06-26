from datetime import datetime
import uuid

from fastapi import HTTPException

from config.database import get_db
from services.assessment_service import log_audit
from services.notification_service import create_notification


def _serialize(document: dict) -> dict:
    return {k: str(v) if k == "_id" else v for k, v in document.items() if k != "_id"}


async def create_request(
    assessment_id: str,
    exam_id: str,
    candidate_id: str,
    req_type: str,
    reason: str
):
    db = get_db()

    clean_type = (req_type or "").strip().upper()
    clean_reason = (reason or "").strip()

    if clean_type not in {"LATEENTRY", "REENTRY"}:
        raise HTTPException(status_code=400, detail="Invalid request type")
    if not clean_reason:
        raise HTTPException(status_code=400, detail="Reason is required")

    assessment = await db.assessments.find_one(
        {"assessment_id": assessment_id, "exam_id": exam_id, "candidate_id": candidate_id}
    )
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    existing = await db.requests.find_one({
        "assessment_id": assessment_id,
        "candidate_id": candidate_id,
        "type": clean_type,
        "status": "PENDING",
    })
    if existing:
        raise HTTPException(status_code=409, detail="A pending request of this type already exists")

    now = datetime.utcnow()
    req = {
        "request_id": f"REQ-{uuid.uuid4().hex[:8].upper()}",
        "assessment_id": assessment_id,
        "exam_id": exam_id,
        "candidate_id": candidate_id,
        "type": clean_type,
        "reason": clean_reason,
        "status": "PENDING",
        "reviewed_by": None,
        "reviewed_at": None,
        "created_at": now,
    }
    await db.requests.insert_one(req)

    status = "LATEENTRY_REQUESTED" if clean_type == "LATEENTRY" else "REENTRY_REQUESTED"
    await db.assessments.update_one(
        {"assessment_id": assessment_id},
        {"$set": {"status": status, "updated_at": now}},
    )

    await log_audit(
        candidate_id,
        f"REQUEST_{clean_type}",
        reason=clean_reason,
        assessment_id=assessment_id,
        exam_id=exam_id,
    )

    return _serialize(req)


async def review_request(request_id: str, decision: str, examiner_id: str):
    db = get_db()

    clean_decision = (decision or "").strip().upper()
    if clean_decision not in {"APPROVED", "REJECTED"}:
        raise HTTPException(status_code=400, detail="Decision must be APPROVED or REJECTED")

    req = await db.requests.find_one({"request_id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    if req.get("status") != "PENDING":
        raise HTTPException(status_code=400, detail="Request has already been reviewed")

    req_type = (req.get("type") or "").upper()
    now = datetime.utcnow()

    await db.requests.update_one(
        {"request_id": request_id},
        {
            "$set": {
                "status": clean_decision,
                "reviewed_by": examiner_id,
                "reviewed_at": now,
            }
        },
    )

    if clean_decision == "APPROVED":
        new_status = "LATEENTRY_APPROVED" if req_type == "LATEENTRY" else "REENTRY_APPROVED"
    else:
        new_status = "LATEENTRY_REJECTED" if req_type == "LATEENTRY" else "REENTRY_REJECTED"

    await db.assessments.update_one(
        {"assessment_id": req["assessment_id"]},
        {"$set": {"status": new_status, "updated_at": now}},
    )

    await log_audit(
        examiner_id,
        f"REVIEW_{req_type}",
        reason=clean_decision,
        assessment_id=req["assessment_id"],
        exam_id=req["exam_id"],
    )

    await create_notification(
        req["candidate_id"],
        f"Request {clean_decision.title()}",
        f"Your {req_type} request has been {clean_decision.lower()}",
        "Approval" if clean_decision == "APPROVED" else "Rejection",
    )

    return {"message": f"Request {clean_decision.lower()}"}


async def get_pending_requests(exam_id: str):
    db = get_db()
    reqs = await db.requests.find(
        {"exam_id": exam_id, "status": "PENDING"}
    ).sort("created_at", -1).to_list(None)
    return [_serialize(r) for r in reqs]