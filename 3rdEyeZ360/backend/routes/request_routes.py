from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from config.database import get_db
from middleware.auth import require_role

router = APIRouter(prefix="/api/requests", tags=["Requests"])


class CreateRequestBody(BaseModel):
    assessment_id: str
    exam_id: str
    type: str
    reason: str


class ReviewBody(BaseModel):
    decision: str


def _serialize(document: dict) -> dict:
    return {k: str(v) if k == "_id" else v for k, v in document.items() if k != "_id"}


async def _ensure_exam_access(db, exam_id: str, current_user: dict):
    exam = await db.exams.find_one({"exam_id": exam_id})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    if current_user["role"] == "Examiner" and exam.get("examiner_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    return exam


@router.post("/")
async def submit(
    req: CreateRequestBody,
    current_user=Depends(require_role("Candidate")),
):
    db = get_db()

    assessment = await db.assessments.find_one({
        "assessment_id": req.assessment_id,
        "exam_id": req.exam_id,
        "candidate_id": current_user["user_id"],
    })
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    request_type = req.type.strip().upper()
    reason = req.reason.strip()

    existing = await db.requests.find_one({
        "assessment_id": req.assessment_id,
        "candidate_id": current_user["user_id"],
        "type": request_type,
        "status": "PENDING",
    })
    if existing:
        raise HTTPException(status_code=409, detail="A pending request already exists")

    if not reason:
        raise HTTPException(status_code=400, detail="Reason is required")

    request_id = f"REQ-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.utcnow()

    request_doc = {
        "request_id": request_id,
        "assessment_id": req.assessment_id,
        "exam_id": req.exam_id,
        "candidate_id": current_user["user_id"],
        "type": request_type,
        "reason": reason,
        "status": "PENDING",
        "reviewed_by": None,
        "reviewed_at": None,
        "created_at": now,
    }

    await db.requests.insert_one(request_doc)

    await db.audit_logs.insert_one({
        "log_id": f"AUD-{uuid.uuid4().hex[:8].upper()}",
        "user_id": current_user["user_id"],
        "exam_id": req.exam_id,
        "assessment_id": req.assessment_id,
        "action": "CreateRequest",
        "reason": f"{request_doc['type']} request submitted",
        "timestamp": now,
    })

    return _serialize(request_doc)


@router.patch("/{request_id}/review")
async def review(
    request_id: str,
    req: ReviewBody,
    current_user=Depends(require_role("Examiner", "Admin")),
):
    db = get_db()

    decision = req.decision.strip().upper()
    if decision not in {"APPROVED", "REJECTED"}:
        raise HTTPException(status_code=400, detail="Decision must be APPROVED or REJECTED")

    request_doc = await db.requests.find_one({"request_id": request_id})
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")

    if request_doc.get("status") != "PENDING":
        raise HTTPException(status_code=400, detail="Request has already been reviewed")

    await _ensure_exam_access(db, request_doc["exam_id"], current_user)

    now = datetime.utcnow()

    await db.requests.update_one(
        {"request_id": request_id},
        {
            "$set": {
                "status": decision,
                "reviewed_by": current_user["user_id"],
                "reviewed_at": now,
            }
        },
    )

    assessment_status = "REENTRY_APPROVED" if decision == "APPROVED" else "REENTRY_REJECTED"
    if request_doc.get("type") == "LATEENTRY":
        assessment_status = "LATEENTRY_APPROVED" if decision == "APPROVED" else "LATEENTRY_REJECTED"

    await db.assessments.update_one(
        {"assessment_id": request_doc["assessment_id"]},
        {"$set": {"status": assessment_status, "updated_at": now}},
    )

    await db.audit_logs.insert_one({
        "log_id": f"AUD-{uuid.uuid4().hex[:8].upper()}",
        "user_id": current_user["user_id"],
        "exam_id": request_doc["exam_id"],
        "assessment_id": request_doc["assessment_id"],
        "action": "ReviewRequest",
        "reason": f"{request_doc.get('type', 'REQUEST')} {decision}",
        "timestamp": now,
    })

    return {"message": f"Request {decision.lower()}"}


@router.get("/exam/{exam_id}/pending")
async def pending(
    exam_id: str,
    current_user=Depends(require_role("Examiner", "Admin")),
):
    db = get_db()
    await _ensure_exam_access(db, exam_id, current_user)

    requests = await db.requests.find(
        {"exam_id": exam_id, "status": "PENDING"}
    ).sort("created_at", -1).to_list(None)

    result = []
    for request in requests:
        user = await db.users.find_one({"user_id": request.get("candidate_id")})
        result.append({
            "request_id": request.get("request_id"),
            "assessment_id": request.get("assessment_id"),
            "exam_id": request.get("exam_id"),
            "candidate_id": request.get("candidate_id"),
            "candidate_name": user["name"] if user else request.get("candidate_id"),
            "candidate_email": user["email"] if user else "",
            "type": request.get("type"),
            "reason": request.get("reason"),
            "status": request.get("status"),
            "created_at": request.get("created_at"),
        })

    return result