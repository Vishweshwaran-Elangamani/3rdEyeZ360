from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from config.database import getdb
from middleware.auth import requirerole

router = APIRouter(prefix="/api/requests", tags=["Requests"])


class CreateRequestBody(BaseModel):
    assessmentid: str
    examid: str
    type: str
    reason: str


class ReviewBody(BaseModel):
    decision: str
    reason: str | None = None


def _serialize(document: dict) -> dict:
    return {k: str(v) if k == "_id" else v for k, v in (document or {}).items() if k != "_id"}


def _normalize_status(value, default="") -> str:
    return str(value or default).strip().upper().replace(" ", "").replace("-", "_")


def _exam_query(exam_id: str) -> dict:
    return {"$or": [{"examid": exam_id}, {"exam_id": exam_id}]}


def _assessment_query(assessment_id: str) -> dict:
    return {"$or": [{"assessmentid": assessment_id}, {"assessment_id": assessment_id}]}


async def _ensure_exam_access(db, exam_id: str, current_user: dict):
    exam = await db.exams.find_one(_exam_query(exam_id))
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    current_user_id = current_user.get("userid") or current_user.get("user_id")
    examiner_id = exam.get("examinerid") or exam.get("examiner_id")

    if current_user["role"] == "Examiner" and examiner_id != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return exam


@router.post("")
async def submit(
    req: CreateRequestBody,
    current_user=Depends(requirerole("Candidate")),
):
    db = getdb()

    current_user_id = current_user.get("userid") or current_user.get("user_id")

    assessment = await db.assessments.find_one(
        {
            "$or": [
                {
                    "assessmentid": req.assessmentid,
                    "examid": req.examid,
                    "candidateid": current_user_id,
                },
                {
                    "assessment_id": req.assessmentid,
                    "exam_id": req.examid,
                    "candidate_id": current_user_id,
                },
            ]
        }
    )
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    request_type = _normalize_status(req.type)
    reason = (req.reason or "").strip()

    if request_type not in {"REENTRY", "LATEENTRY"}:
        raise HTTPException(status_code=400, detail="Invalid request type")

    if not reason:
        raise HTTPException(status_code=400, detail="Reason is required")

    existing = await db.requests.find_one(
        {
            "assessmentid": req.assessmentid,
            "candidateid": current_user_id,
            "type": request_type,
            "status": "PENDING",
        }
    )
    if existing:
        raise HTTPException(status_code=409, detail="A pending request already exists")

    request_id = f"REQ-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.utcnow()

    request_doc = {
        "requestid": request_id,
        "request_id": request_id,
        "assessmentid": req.assessmentid,
        "assessment_id": req.assessmentid,
        "examid": req.examid,
        "exam_id": req.examid,
        "candidateid": current_user_id,
        "candidate_id": current_user_id,
        "type": request_type,
        "requesttype": request_type,
        "reason": reason,
        "status": "PENDING",
        "reviewedby": None,
        "reviewedat": None,
        "reviewreason": None,
        "createdat": now,
        "created_at": now,
    }

    await db.requests.insert_one(request_doc)

    requested_status = "REENTRYREQUESTED" if request_type == "REENTRY" else "LATEENTRYREQUESTED"
    await db.assessments.update_one(
        _assessment_query(req.assessmentid),
        {
            "$set": {
                "status": requested_status,
                "assessmentstatus": requested_status,
                "updatedat": now,
                "updated_at": now,
            }
        },
    )

    audit_collection = getattr(db, "audit_logs", None) or getattr(db, "auditlogs", None)
    if audit_collection is not None:
        await audit_collection.insert_one(
            {
                "logid": f"AUD-{uuid.uuid4().hex[:8].upper()}",
                "log_id": f"AUD-{uuid.uuid4().hex[:8].upper()}",
                "userid": current_user_id,
                "user_id": current_user_id,
                "examid": req.examid,
                "exam_id": req.examid,
                "assessmentid": req.assessmentid,
                "assessment_id": req.assessmentid,
                "action": "CreateRequest",
                "reason": f"{request_type} request submitted",
                "timestamp": now,
            }
        )

    return _serialize(request_doc)


@router.patch("/{requestid}/review")
async def review(
    requestid: str,
    req: ReviewBody,
    current_user=Depends(requirerole("Examiner", "Admin")),
):
    db = getdb()

    decision = _normalize_status(req.decision)
    review_reason = (req.reason or "").strip()

    if decision not in {"APPROVED", "REJECTED"}:
        raise HTTPException(status_code=400, detail="Decision must be APPROVED or REJECTED")

    if decision == "REJECTED" and not review_reason:
        raise HTTPException(status_code=400, detail="Reason is required when rejecting a request")

    request_doc = await db.requests.find_one(
        {"$or": [{"requestid": requestid}, {"request_id": requestid}]}
    )
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")

    if _normalize_status(request_doc.get("status")) != "PENDING":
        raise HTTPException(status_code=400, detail="Request has already been reviewed")

    exam_id = request_doc.get("examid") or request_doc.get("exam_id")
    assessment_id = request_doc.get("assessmentid") or request_doc.get("assessment_id")
    request_type = _normalize_status(request_doc.get("type") or request_doc.get("requesttype"))

    await _ensure_exam_access(db, exam_id, current_user)

    current_user_id = current_user.get("userid") or current_user.get("user_id")
    now = datetime.utcnow()

    await db.requests.update_one(
        {"$or": [{"requestid": requestid}, {"request_id": requestid}]},
        {
            "$set": {
                "status": decision,
                "reviewedby": current_user_id,
                "reviewedat": now,
                "reviewreason": review_reason if review_reason else None,
            }
        },
    )

    if request_type == "LATEENTRY":
        assessment_status = "LATEENTRYAPPROVED" if decision == "APPROVED" else "LATEENTRYREJECTED"
    else:
        assessment_status = "REENTRYAPPROVED" if decision == "APPROVED" else "REENTRYREJECTED"

    await db.assessments.update_one(
        _assessment_query(assessment_id),
        {
            "$set": {
                "status": assessment_status,
                "assessmentstatus": assessment_status,
                "updatedat": now,
                "updated_at": now,
            }
        },
    )

    audit_collection = getattr(db, "audit_logs", None) or getattr(db, "auditlogs", None)
    if audit_collection is not None:
        await audit_collection.insert_one(
            {
                "logid": f"AUD-{uuid.uuid4().hex[:8].upper()}",
                "log_id": f"AUD-{uuid.uuid4().hex[:8].upper()}",
                "userid": current_user_id,
                "user_id": current_user_id,
                "examid": exam_id,
                "exam_id": exam_id,
                "assessmentid": assessment_id,
                "assessment_id": assessment_id,
                "action": "ReviewRequest",
                "reason": review_reason or f"{request_type} {decision}",
                "timestamp": now,
            }
        )

    return {
        "message": f"Request {decision.lower()}",
        "requestid": requestid,
        "status": decision,
        "reviewreason": review_reason if review_reason else None,
        "assessmentstatus": assessment_status,
    }


@router.get("/exam/{examid}/pending")
async def pending(
    examid: str,
    current_user=Depends(requirerole("Examiner", "Admin")),
):
    db = getdb()
    await _ensure_exam_access(db, examid, current_user)

    requests = await db.requests.find(
        {
            "$or": [
                {"examid": examid, "status": "PENDING"},
                {"exam_id": examid, "status": "PENDING"},
            ]
        }
    ).sort("createdat", -1).to_list(None)

    result = []
    for request in requests:
        candidate_id = request.get("candidateid") or request.get("candidate_id")
        user = await db.users.find_one(
            {
                "$or": [
                    {"userid": candidate_id},
                    {"user_id": candidate_id},
                ]
            }
        )

        result.append(
            {
                "requestid": request.get("requestid") or request.get("request_id"),
                "request_id": request.get("requestid") or request.get("request_id"),
                "assessmentid": request.get("assessmentid") or request.get("assessment_id"),
                "assessment_id": request.get("assessmentid") or request.get("assessment_id"),
                "examid": request.get("examid") or request.get("exam_id"),
                "exam_id": request.get("examid") or request.get("exam_id"),
                "candidateid": candidate_id,
                "candidate_id": candidate_id,
                "candidatename": user["name"] if user else candidate_id,
                "candidate_name": user["name"] if user else candidate_id,
                "candidateemail": user["email"] if user else "",
                "candidate_email": user["email"] if user else "",
                "type": request.get("type") or request.get("requesttype"),
                "requesttype": request.get("type") or request.get("requesttype"),
                "reason": request.get("reason"),
                "status": _normalize_status(request.get("status")),
                "createdat": request.get("createdat") or request.get("created_at"),
                "created_at": request.get("createdat") or request.get("created_at"),
                "reviewedat": request.get("reviewedat") or request.get("reviewed_at"),
                "reviewed_at": request.get("reviewedat") or request.get("reviewed_at"),
                "reviewreason": request.get("reviewreason"),
                "review_reason": request.get("reviewreason"),
            }
        )

    return result