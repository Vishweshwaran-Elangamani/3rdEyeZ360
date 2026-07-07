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
    return {k: str(v) if k == "_id" else v for k, v in document.items() if k != "_id"}


def _exam_query(examid: str) -> dict:
    return {"$or": [{"examid": examid}, {"exam_id": examid}]}


async def _ensure_exam_access(db, examid: str, current_user: dict):
    exam = await db.exams.find_one(_exam_query(examid))
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

    request_type = req.type.strip().upper()
    reason = req.reason.strip()

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
        "assessmentid": req.assessmentid,
        "examid": req.examid,
        "candidateid": current_user_id,
        "type": request_type,
        "reason": reason,
        "status": "PENDING",
        "reviewedby": None,
        "reviewedat": None,
        "reviewreason": None,
        "createdat": now,
    }

    await db.requests.insert_one(request_doc)

    requested_status = "REENTRYREQUESTED" if request_type == "REENTRY" else "LATEENTRYREQUESTED"
    await db.assessments.update_one(
        {"$or": [{"assessmentid": req.assessmentid}, {"assessment_id": req.assessmentid}]},
        {
            "$set": {
                "status": requested_status,
                "updatedat": now,
                "updated_at": now,
            }
        },
    )

    await db.auditlogs.insert_one(
        {
            "logid": f"AUD-{uuid.uuid4().hex[:8].upper()}",
            "userid": current_user_id,
            "examid": req.examid,
            "assessmentid": req.assessmentid,
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

    decision = req.decision.strip().upper()
    review_reason = (req.reason or "").strip()

    if decision not in {"APPROVED", "REJECTED"}:
        raise HTTPException(status_code=400, detail="Decision must be APPROVED or REJECTED")

    if decision == "REJECTED" and not review_reason:
        raise HTTPException(status_code=400, detail="Reason is required when rejecting a request")

    request_doc = await db.requests.find_one({"requestid": requestid})
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")

    if request_doc.get("status") != "PENDING":
        raise HTTPException(status_code=400, detail="Request has already been reviewed")

    await _ensure_exam_access(db, request_doc["examid"], current_user)

    current_user_id = current_user.get("userid") or current_user.get("user_id")
    now = datetime.utcnow()

    await db.requests.update_one(
        {"requestid": requestid},
        {
            "$set": {
                "status": decision,
                "reviewedby": current_user_id,
                "reviewedat": now,
                "reviewreason": review_reason if review_reason else None,
            }
        },
    )

    assessment_status = "REENTRYAPPROVED" if decision == "APPROVED" else "REENTRYREJECTED"
    if request_doc.get("type") == "LATEENTRY":
        assessment_status = "LATEENTRYAPPROVED" if decision == "APPROVED" else "LATEENTRYREJECTED"

    await db.assessments.update_one(
        {"$or": [{"assessmentid": request_doc["assessmentid"]}, {"assessment_id": request_doc["assessmentid"]}]},
        {"$set": {"status": assessment_status, "updatedat": now, "updated_at": now}},
    )

    await db.auditlogs.insert_one(
        {
            "logid": f"AUD-{uuid.uuid4().hex[:8].upper()}",
            "userid": current_user_id,
            "examid": request_doc["examid"],
            "assessmentid": request_doc["assessmentid"],
            "action": "ReviewRequest",
            "reason": review_reason or f"{request_doc.get('type', 'REQUEST')} {decision}",
            "timestamp": now,
        }
    )

    return {
        "message": f"Request {decision.lower()}",
        "requestid": requestid,
        "status": decision,
        "reviewreason": review_reason if review_reason else None,
    }


@router.get("/exam/{examid}/pending")
async def pending(
    examid: str,
    current_user=Depends(requirerole("Examiner", "Admin")),
):
    db = getdb()
    await _ensure_exam_access(db, examid, current_user)

    requests = (
        await db.requests.find({"examid": examid, "status": "PENDING"})
        .sort("createdat", -1)
        .to_list(None)
    )

    result = []
    for request in requests:
        user = await db.users.find_one(
            {
                "$or": [
                    {"userid": request.get("candidateid")},
                    {"user_id": request.get("candidateid")},
                ]
            }
        )
        result.append(
            {
                "requestid": request.get("requestid"),
                "assessmentid": request.get("assessmentid"),
                "examid": request.get("examid"),
                "candidateid": request.get("candidateid"),
                "candidatename": user["name"] if user else request.get("candidateid"),
                "candidateemail": user["email"] if user else "",
                "type": request.get("type"),
                "reason": request.get("reason"),
                "status": request.get("status"),
                "createdat": request.get("createdat"),
                "reviewedat": request.get("reviewedat"),
                "reviewreason": request.get("reviewreason"),
            }
        )

    return result