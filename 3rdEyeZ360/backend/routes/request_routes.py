from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from config.database import getdb
from middleware.auth import requirerole
from sockets.monitoring_socket import emit_request_event, emit_assessment_event

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


def _user_query(user_id: str) -> dict:
    return {"$or": [{"userid": user_id}, {"user_id": user_id}]}


def _get_audit_collection(db):
    collection = getattr(db, "audit_logs", None)
    if collection is None:
        collection = getattr(db, "auditlogs", None)
    return collection


async def _ensure_exam_access(db, exam_id: str, current_user: dict):
    exam = await db.exams.find_one(_exam_query(exam_id))
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    user_id = current_user.get("userid") or current_user.get("user_id")
    examiner_id = exam.get("examinerid") or exam.get("examiner_id")
    if current_user["role"] == "Examiner" and examiner_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return exam


@router.post("")
async def submit(req: CreateRequestBody, current_user=Depends(requirerole("Candidate"))):
    db = getdb()
    user_id = current_user.get("userid") or current_user.get("user_id")
    assessment = await db.assessments.find_one({
        "$or": [
            {"assessmentid": req.assessmentid, "examid": req.examid, "candidateid": user_id},
            {"assessment_id": req.assessmentid, "exam_id": req.examid, "candidate_id": user_id},
        ]
    })
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    request_type = _normalize_status(req.type)
    reason = (req.reason or "").strip()
    if request_type not in {"REENTRY", "LATEENTRY"}:
        raise HTTPException(status_code=400, detail="Invalid request type")
    if not reason:
        raise HTTPException(status_code=400, detail="Reason is required")

    assessment_status = _normalize_status(assessment.get("status") or assessment.get("assessmentstatus"))
    has_entered = bool(assessment.get("hasenteredexam", assessment.get("has_entered_exam", False)))
    requires_reentry = bool(assessment.get("requiresreentryapproval", assessment.get("requires_reentry_approval", False)))

    if request_type == "REENTRY":
        if not has_entered:
            raise HTTPException(status_code=400, detail="Re-entry is unavailable because the candidate has not entered this assessment.")
        if not requires_reentry and assessment_status not in {"REENTRY_REQUIRED", "INTERRUPTED", "REENTRY_REJECTED", "REENTRYREJECTED"}:
            raise HTTPException(status_code=400, detail="This assessment does not currently require re-entry approval.")
    elif has_entered:
        raise HTTPException(status_code=400, detail="The candidate previously entered this assessment. A REENTRY request is required.")

    existing = await db.requests.find_one({
        "$or": [
            {"assessmentid": req.assessmentid, "candidateid": user_id, "type": request_type, "status": "PENDING"},
            {"assessment_id": req.assessmentid, "candidate_id": user_id, "type": request_type, "status": "PENDING"},
        ]
    })
    if existing:
        raise HTTPException(status_code=409, detail="A pending request already exists")

    now = datetime.utcnow()
    request_id = f"REQ-{uuid.uuid4().hex[:8].upper()}"
    request_doc = {
        "requestid": request_id, "request_id": request_id,
        "assessmentid": req.assessmentid, "assessment_id": req.assessmentid,
        "examid": req.examid, "exam_id": req.examid,
        "candidateid": user_id, "candidate_id": user_id,
        "type": request_type, "requesttype": request_type,
        "reason": reason, "status": "PENDING",
        "reviewedby": None, "reviewed_by": None,
        "reviewedat": None, "reviewed_at": None,
        "reviewreason": None, "review_reason": None,
        "createdat": now, "created_at": now,
    }
    await db.requests.insert_one(request_doc)

    status = "REENTRYREQUESTED" if request_type == "REENTRY" else "LATEENTRYREQUESTED"
    update = {
        "status": status, "assessmentstatus": status, "assessment_status": status,
        "lastrequeststatus": "PENDING", "last_request_status": "PENDING",
        "lastrequesttype": request_type, "last_request_type": request_type,
        "lastrequestreason": reason, "last_request_reason": reason,
        "lastrequestreviewreason": None, "last_request_review_reason": None,
        "rejectionreason": None, "rejection_reason": None,
        "updatedat": now, "updated_at": now,
    }
    if request_type == "REENTRY":
        update.update({
            "requiresreentryapproval": True, "requires_reentry_approval": True,
            "reentryapprovalconsumed": False, "reentry_approval_consumed": False,
            "activesessionid": None, "active_session_id": None,
        })
    await db.assessments.update_one(_assessment_query(req.assessmentid), {"$set": update})

    audit = _get_audit_collection(db)
    if audit is not None:
        audit_id = f"AUD-{uuid.uuid4().hex[:8].upper()}"
        await audit.insert_one({
            "logid": audit_id, "log_id": audit_id,
            "userid": user_id, "user_id": user_id,
            "examid": req.examid, "exam_id": req.examid,
            "assessmentid": req.assessmentid, "assessment_id": req.assessmentid,
            "action": "CreateRequest", "reason": f"{request_type} request submitted", "timestamp": now,
        })
    updated_assessment = await db.assessments.find_one(_assessment_query(req.assessmentid))
    request_payload = _serialize(request_doc)
    assessment_payload = _serialize(updated_assessment)
    await emit_request_event("request_created", request_payload, assessment_payload)
    await emit_assessment_event("assessment_updated", assessment_payload)
    return request_payload


@router.patch("/{requestid}/review")
async def review(requestid: str, req: ReviewBody, current_user=Depends(requirerole("Examiner", "Admin"))):
    db = getdb()
    decision = _normalize_status(req.decision)
    reason = (req.reason or "").strip()
    if decision not in {"APPROVED", "REJECTED"}:
        raise HTTPException(status_code=400, detail="Decision must be APPROVED or REJECTED")
    if decision == "REJECTED" and not reason:
        raise HTTPException(status_code=400, detail="Reason is required when rejecting a request")

    request_doc = await db.requests.find_one({"$or": [{"requestid": requestid}, {"request_id": requestid}]})
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    if _normalize_status(request_doc.get("status")) != "PENDING":
        raise HTTPException(status_code=400, detail="Request has already been reviewed")

    exam_id = request_doc.get("examid") or request_doc.get("exam_id")
    assessment_id = request_doc.get("assessmentid") or request_doc.get("assessment_id")
    request_type = _normalize_status(request_doc.get("type") or request_doc.get("requesttype"))
    await _ensure_exam_access(db, exam_id, current_user)

    user_id = current_user.get("userid") or current_user.get("user_id")
    now = datetime.utcnow()
    await db.requests.update_one(
        {"$or": [{"requestid": requestid}, {"request_id": requestid}]},
        {"$set": {
            "status": decision, "reviewedby": user_id, "reviewed_by": user_id,
            "reviewedat": now, "reviewed_at": now,
            "reviewreason": reason or None, "review_reason": reason or None,
        }},
    )

    if request_type == "LATEENTRY":
        status = "LATEENTRYAPPROVED" if decision == "APPROVED" else "LATEENTRYREJECTED"
    else:
        status = "REENTRYAPPROVED" if decision == "APPROVED" else "REENTRYREJECTED"

    update = {
        "status": status, "assessmentstatus": status, "assessment_status": status,
        "lastrequeststatus": decision, "last_request_status": decision,
        "lastrequesttype": request_type, "last_request_type": request_type,
        "lastrequestreviewreason": reason or None,
        "last_request_review_reason": reason or None,
        "rejectionreason": reason if decision == "REJECTED" else None,
        "rejection_reason": reason if decision == "REJECTED" else None,
        "updatedat": now, "updated_at": now,
    }
    if request_type == "REENTRY":
        update.update({
            "requiresreentryapproval": decision != "APPROVED",
            "requires_reentry_approval": decision != "APPROVED",
            "reentryapprovalconsumed": False, "reentry_approval_consumed": False,
            "activesessionid": None, "active_session_id": None,
        })
    await db.assessments.update_one(_assessment_query(assessment_id), {"$set": update})

    audit = _get_audit_collection(db)
    if audit is not None:
        audit_id = f"AUD-{uuid.uuid4().hex[:8].upper()}"
        await audit.insert_one({
            "logid": audit_id, "log_id": audit_id,
            "userid": user_id, "user_id": user_id,
            "examid": exam_id, "exam_id": exam_id,
            "assessmentid": assessment_id, "assessment_id": assessment_id,
            "action": "ReviewRequest", "reason": reason or f"{request_type} {decision}", "timestamp": now,
        })
    updated_request = await db.requests.find_one({"$or": [{"requestid": requestid}, {"request_id": requestid}]})
    updated_assessment = await db.assessments.find_one(_assessment_query(assessment_id))
    request_payload = _serialize(updated_request)
    assessment_payload = _serialize(updated_assessment)
    await emit_request_event("request_reviewed", request_payload, assessment_payload)
    await emit_assessment_event("assessment_updated", assessment_payload)
    return {
        "message": f"Request {decision.lower()}",
        "requestid": requestid,
        "status": decision,
        "reviewreason": reason or None,
        "assessmentstatus": status,
        "assessment": assessment_payload,
    }


@router.get("/exam/{examid}/pending")
async def pending(examid: str, current_user=Depends(requirerole("Examiner", "Admin"))):
    db = getdb()
    await _ensure_exam_access(db, examid, current_user)
    requests = await db.requests.find({"$or": [{"examid": examid, "status": "PENDING"}, {"exam_id": examid, "status": "PENDING"}]}).sort("createdat", -1).to_list(None)
    result = []
    for request in requests:
        candidate_id = request.get("candidateid") or request.get("candidate_id")
        user = await db.users.find_one(_user_query(candidate_id))
        result.append({
            "requestid": request.get("requestid") or request.get("request_id"),
            "request_id": request.get("requestid") or request.get("request_id"),
            "assessmentid": request.get("assessmentid") or request.get("assessment_id"),
            "assessment_id": request.get("assessmentid") or request.get("assessment_id"),
            "examid": request.get("examid") or request.get("exam_id"),
            "exam_id": request.get("examid") or request.get("exam_id"),
            "candidateid": candidate_id, "candidate_id": candidate_id,
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
            "reviewreason": request.get("reviewreason") or request.get("review_reason"),
            "review_reason": request.get("reviewreason") or request.get("review_reason"),
        })
    return result
