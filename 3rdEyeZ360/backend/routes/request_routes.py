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


def _serialize(document: dict | None) -> dict:
    return {
        key: str(value) if key == "_id" else value
        for key, value in (document or {}).items()
        if key != "_id"
    }


def _normalize_status(value, default="") -> str:
    return (
        str(value or default)
        .strip()
        .upper()
        .replace(" ", "")
        .replace("-", "_")
    )


def _exam_query(exam_id: str) -> dict:
    return {
        "$or": [
            {"examid": exam_id},
            {"exam_id": exam_id},
        ]
    }


def _assessment_query(assessment_id: str) -> dict:
    return {
        "$or": [
            {"assessmentid": assessment_id},
            {"assessment_id": assessment_id},
        ]
    }


def _request_query(request_id: str) -> dict:
    return {
        "$or": [
            {"requestid": request_id},
            {"request_id": request_id},
        ]
    }


def _user_query(user_id: str) -> dict:
    return {
        "$or": [
            {"userid": user_id},
            {"user_id": user_id},
        ]
    }


def _user_id(current_user: dict):
    return current_user.get("userid") or current_user.get("user_id")


def _field(document: dict | None, *keys, default=None):
    document = document or {}
    for key in keys:
        value = document.get(key)
        if value is not None:
            return value
    return default


def _bool_field(document: dict | None, *keys, default=False) -> bool:
    value = _field(document, *keys, default=default)
    return bool(value)


def _int_field(document: dict | None, *keys, default=0) -> int:
    value = _field(document, *keys, default=default)
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return int(default or 0)


def _get_audit_collection(db):
    collection = getattr(db, "audit_logs", None)
    if collection is None:
        collection = getattr(db, "auditlogs", None)
    return collection


async def _ensure_exam_access(db, exam_id: str, current_user: dict):
    exam = await db.exams.find_one(_exam_query(exam_id))
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    user_id = _user_id(current_user)
    examiner_id = exam.get("examinerid") or exam.get("examiner_id")

    if current_user["role"] == "Examiner" and str(examiner_id) != str(user_id):
        raise HTTPException(status_code=403, detail="Access denied")

    return exam


async def _get_candidate_assessment(
    db,
    assessment_id: str,
    exam_id: str,
    candidate_id: str,
):
    return await db.assessments.find_one(
        {
            "$and": [
                _assessment_query(assessment_id),
                _exam_query(exam_id),
                {
                    "$or": [
                        {"candidateid": candidate_id},
                        {"candidate_id": candidate_id},
                    ]
                },
            ]
        }
    )


async def _write_audit(
    db,
    user_id: str,
    exam_id: str,
    assessment_id: str,
    action: str,
    reason: str,
    request_id: str | None = None,
):
    audit = _get_audit_collection(db)
    if audit is None:
        return

    now = datetime.utcnow()
    audit_id = f"AUD-{uuid.uuid4().hex[:8].upper()}"
    document = {
        "logid": audit_id,
        "log_id": audit_id,
        "userid": user_id,
        "user_id": user_id,
        "examid": exam_id,
        "exam_id": exam_id,
        "assessmentid": assessment_id,
        "assessment_id": assessment_id,
        "action": action,
        "reason": reason,
        "timestamp": now,
        "createdat": now,
        "created_at": now,
    }
    if request_id:
        document["requestid"] = request_id
        document["request_id"] = request_id

    await audit.insert_one(document)


@router.post("")
async def submit(
    req: CreateRequestBody,
    current_user=Depends(requirerole("Candidate")),
):
    db = getdb()
    user_id = _user_id(current_user)

    assessment = await _get_candidate_assessment(
        db,
        req.assessmentid,
        req.examid,
        user_id,
    )
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    request_type = _normalize_status(req.type)
    reason = str(req.reason or "").strip()

    if request_type not in {"REENTRY", "LATEENTRY"}:
        raise HTTPException(status_code=400, detail="Invalid request type")
    if not reason:
        raise HTTPException(status_code=400, detail="Reason is required")

    assessment_status = _normalize_status(
        assessment.get("status") or assessment.get("assessmentstatus")
    )
    has_entered = _bool_field(
        assessment,
        "hasenteredexam",
        "has_entered_exam",
    )
    requires_reentry = _bool_field(
        assessment,
        "requiresreentryapproval",
        "requires_reentry_approval",
    )
    threshold_reached = _bool_field(
        assessment,
        "thresholdreached",
        "threshold_reached",
    )

    if request_type == "REENTRY":
        if not has_entered:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Re-entry is unavailable because the candidate has not "
                    "entered this assessment."
                ),
            )

        allowed_reentry_statuses = {
            "LOCKED",
            "REENTRY_REQUIRED",
            "REENTRYREQUIRED",
            "INTERRUPTED",
            "REENTRY_REJECTED",
            "REENTRYREJECTED",
        }
        if (
            not requires_reentry
            and not threshold_reached
            and assessment_status not in allowed_reentry_statuses
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "This assessment does not currently require re-entry "
                    "approval."
                ),
            )
    elif has_entered:
        raise HTTPException(
            status_code=400,
            detail=(
                "The candidate previously entered this assessment. "
                "A REENTRY request is required."
            ),
        )

    existing = await db.requests.find_one(
        {
            "$and": [
                _assessment_query(req.assessmentid),
                {
                    "$or": [
                        {"candidateid": user_id},
                        {"candidate_id": user_id},
                    ]
                },
                {
                    "$or": [
                        {"type": request_type},
                        {"requesttype": request_type},
                    ]
                },
                {"status": "PENDING"},
            ]
        }
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="A pending request already exists",
        )

    now = datetime.utcnow()
    request_id = f"REQ-{uuid.uuid4().hex[:8].upper()}"
    request_doc = {
        "requestid": request_id,
        "request_id": request_id,
        "assessmentid": req.assessmentid,
        "assessment_id": req.assessmentid,
        "examid": req.examid,
        "exam_id": req.examid,
        "candidateid": user_id,
        "candidate_id": user_id,
        "type": request_type,
        "requesttype": request_type,
        "reason": reason,
        "status": "PENDING",
        "sourceassessmentstatus": assessment_status,
        "source_assessment_status": assessment_status,
        "thresholdreached": threshold_reached,
        "threshold_reached": threshold_reached,
        "warningcount": _int_field(
            assessment,
            "warningcount",
            "warning_count",
        ),
        "warning_count": _int_field(
            assessment,
            "warningcount",
            "warning_count",
        ),
        "violationcount": _int_field(
            assessment,
            "violationcount",
            "violation_count",
        ),
        "violation_count": _int_field(
            assessment,
            "violationcount",
            "violation_count",
        ),
        "violationthreshold": _int_field(
            assessment,
            "violationthreshold",
            "violation_threshold",
            default=10,
        ),
        "violation_threshold": _int_field(
            assessment,
            "violationthreshold",
            "violation_threshold",
            default=10,
        ),
        "credibilityscore": _int_field(
            assessment,
            "credibilityscore",
            "credibility_score",
            default=100,
        ),
        "credibility_score": _int_field(
            assessment,
            "credibilityscore",
            "credibility_score",
            default=100,
        ),
        "reviewedby": None,
        "reviewed_by": None,
        "reviewedat": None,
        "reviewed_at": None,
        "reviewreason": None,
        "review_reason": None,
        "createdat": now,
        "created_at": now,
    }
    await db.requests.insert_one(request_doc)

    status = (
        "REENTRYREQUESTED"
        if request_type == "REENTRY"
        else "LATEENTRYREQUESTED"
    )
    update = {
        "status": status,
        "assessmentstatus": status,
        "assessment_status": status,
        "lastrequeststatus": "PENDING",
        "last_request_status": "PENDING",
        "lastrequesttype": request_type,
        "last_request_type": request_type,
        "lastrequestreason": reason,
        "last_request_reason": reason,
        "lastrequestreviewreason": None,
        "last_request_review_reason": None,
        "rejectionreason": None,
        "rejection_reason": None,
        "updatedat": now,
        "updated_at": now,
    }

    if request_type == "REENTRY":
        update.update(
            {
                "requiresreentryapproval": True,
                "requires_reentry_approval": True,
                "reentryapprovalconsumed": False,
                "reentry_approval_consumed": False,
                "activesessionid": None,
                "active_session_id": None,
                "lastheartbeatat": None,
                "last_heartbeat_at": None,
            }
        )

    await db.assessments.update_one(
        _assessment_query(req.assessmentid),
        {"$set": update},
    )

    await _write_audit(
        db,
        user_id,
        req.examid,
        req.assessmentid,
        "CreateRequest",
        f"{request_type} request submitted",
        request_id,
    )

    updated_assessment = await db.assessments.find_one(
        _assessment_query(req.assessmentid)
    )
    request_payload = _serialize(request_doc)
    assessment_payload = _serialize(updated_assessment)

    await emit_request_event(
        "request_created",
        request_payload,
        assessment_payload,
    )
    await emit_assessment_event(
        "assessment_updated",
        assessment_payload,
    )

    return request_payload


@router.patch("/{requestid}/review")
async def review(
    requestid: str,
    req: ReviewBody,
    current_user=Depends(requirerole("Examiner", "Admin")),
):
    db = getdb()
    decision = _normalize_status(req.decision)
    reason = str(req.reason or "").strip()

    if decision not in {"APPROVED", "REJECTED"}:
        raise HTTPException(
            status_code=400,
            detail="Decision must be APPROVED or REJECTED",
        )
    if decision == "REJECTED" and not reason:
        raise HTTPException(
            status_code=400,
            detail="Reason is required when rejecting a request",
        )

    request_doc = await db.requests.find_one(_request_query(requestid))
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    if _normalize_status(request_doc.get("status")) != "PENDING":
        raise HTTPException(
            status_code=400,
            detail="Request has already been reviewed",
        )

    exam_id = request_doc.get("examid") or request_doc.get("exam_id")
    assessment_id = request_doc.get("assessmentid") or request_doc.get(
        "assessment_id"
    )
    request_type = _normalize_status(
        request_doc.get("type") or request_doc.get("requesttype")
    )

    await _ensure_exam_access(db, exam_id, current_user)

    assessment = await db.assessments.find_one(
        _assessment_query(assessment_id)
    )
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    user_id = _user_id(current_user)
    now = datetime.utcnow()

    await db.requests.update_one(
        _request_query(requestid),
        {
            "$set": {
                "status": decision,
                "reviewedby": user_id,
                "reviewed_by": user_id,
                "reviewedat": now,
                "reviewed_at": now,
                "reviewreason": reason or None,
                "review_reason": reason or None,
            }
        },
    )

    if request_type == "LATEENTRY":
        status = (
            "LATEENTRYAPPROVED"
            if decision == "APPROVED"
            else "LATEENTRYREJECTED"
        )
    else:
        status = (
            "REENTRYAPPROVED"
            if decision == "APPROVED"
            else "REENTRYREJECTED"
        )

    update = {
        "status": status,
        "assessmentstatus": status,
        "assessment_status": status,
        "lastrequeststatus": decision,
        "last_request_status": decision,
        "lastrequesttype": request_type,
        "last_request_type": request_type,
        "lastrequestreviewreason": reason or None,
        "last_request_review_reason": reason or None,
        "rejectionreason": reason if decision == "REJECTED" else None,
        "rejection_reason": reason if decision == "REJECTED" else None,
        "updatedat": now,
        "updated_at": now,
    }

    if request_type == "REENTRY":
        update.update(
            {
                "requiresreentryapproval": decision != "APPROVED",
                "requires_reentry_approval": decision != "APPROVED",
                "reentryapprovalconsumed": False,
                "reentry_approval_consumed": False,
                "activesessionid": None,
                "active_session_id": None,
                "lastheartbeatat": None,
                "last_heartbeat_at": None,
                # Preserve threshold history and evidence. Approval only grants
                # one new entry; it does not reset warning or violation counts.
                "thresholdreviewed": decision == "APPROVED",
                "threshold_reviewed": decision == "APPROVED",
                "thresholdreviewedby": user_id if decision == "APPROVED" else None,
                "threshold_reviewed_by": user_id if decision == "APPROVED" else None,
                "thresholdreviewedat": now if decision == "APPROVED" else None,
                "threshold_reviewed_at": now if decision == "APPROVED" else None,
            }
        )

    await db.assessments.update_one(
        _assessment_query(assessment_id),
        {"$set": update},
    )

    await _write_audit(
        db,
        user_id,
        exam_id,
        assessment_id,
        "ReviewRequest",
        reason or f"{request_type} {decision}",
        requestid,
    )

    updated_request = await db.requests.find_one(_request_query(requestid))
    updated_assessment = await db.assessments.find_one(
        _assessment_query(assessment_id)
    )
    request_payload = _serialize(updated_request)
    assessment_payload = _serialize(updated_assessment)

    await emit_request_event(
        "request_reviewed",
        request_payload,
        assessment_payload,
    )
    await emit_assessment_event(
        "assessment_updated",
        assessment_payload,
    )

    return {
        "message": f"Request {decision.lower()}",
        "requestid": requestid,
        "request_id": requestid,
        "status": decision,
        "reviewreason": reason or None,
        "review_reason": reason or None,
        "assessmentstatus": status,
        "assessment_status": status,
        "request": request_payload,
        "assessment": assessment_payload,
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
            "$and": [
                _exam_query(examid),
                {"status": "PENDING"},
            ]
        }
    ).sort("createdat", -1).to_list(None)

    result = []
    for request in requests:
        candidate_id = request.get("candidateid") or request.get("candidate_id")
        assessment_id = request.get("assessmentid") or request.get(
            "assessment_id"
        )
        user = await db.users.find_one(_user_query(candidate_id))
        assessment = await db.assessments.find_one(
            _assessment_query(assessment_id)
        )

        latest_violations = await db.violations.find(
            {
                "$and": [
                    _assessment_query(assessment_id),
                    {
                        "$or": [
                            {"candidateid": candidate_id},
                            {"candidate_id": candidate_id},
                        ]
                    },
                ]
            }
        ).sort("createdat", -1).limit(5).to_list(None)

        evidence_count = 0
        for violation in latest_violations:
            evidence_object = (
                violation.get("evidenceobject")
                or violation.get("evidence_object")
                or violation.get("screenshotpath")
                or violation.get("screenshot_path")
            )
            if evidence_object:
                evidence_count += 1

        warning_count = _int_field(
            assessment,
            "warningcount",
            "warning_count",
            default=_int_field(request, "warningcount", "warning_count"),
        )
        violation_count = _int_field(
            assessment,
            "violationcount",
            "violation_count",
            default=_int_field(request, "violationcount", "violation_count"),
        )
        violation_threshold = _int_field(
            assessment,
            "violationthreshold",
            "violation_threshold",
            default=_int_field(
                request,
                "violationthreshold",
                "violation_threshold",
                default=10,
            ),
        )
        credibility_score = _int_field(
            assessment,
            "credibilityscore",
            "credibility_score",
            default=_int_field(
                request,
                "credibilityscore",
                "credibility_score",
                default=100,
            ),
        )

        result.append(
            {
                "requestid": request.get("requestid")
                or request.get("request_id"),
                "request_id": request.get("requestid")
                or request.get("request_id"),
                "assessmentid": assessment_id,
                "assessment_id": assessment_id,
                "examid": request.get("examid") or request.get("exam_id"),
                "exam_id": request.get("examid") or request.get("exam_id"),
                "candidateid": candidate_id,
                "candidate_id": candidate_id,
                "candidatename": user["name"] if user else candidate_id,
                "candidate_name": user["name"] if user else candidate_id,
                "candidateemail": user["email"] if user else "",
                "candidate_email": user["email"] if user else "",
                "type": request.get("type") or request.get("requesttype"),
                "requesttype": request.get("type")
                or request.get("requesttype"),
                "reason": request.get("reason"),
                "status": _normalize_status(request.get("status")),
                "createdat": request.get("createdat")
                or request.get("created_at"),
                "created_at": request.get("createdat")
                or request.get("created_at"),
                "reviewedat": request.get("reviewedat")
                or request.get("reviewed_at"),
                "reviewed_at": request.get("reviewedat")
                or request.get("reviewed_at"),
                "reviewreason": request.get("reviewreason")
                or request.get("review_reason"),
                "review_reason": request.get("reviewreason")
                or request.get("review_reason"),
                "assessmentstatus": _normalize_status(
                    _field(assessment, "status", "assessmentstatus", default="")
                ),
                "assessment_status": _normalize_status(
                    _field(assessment, "status", "assessmentstatus", default="")
                ),
                "thresholdreached": _bool_field(
                    assessment,
                    "thresholdreached",
                    "threshold_reached",
                ),
                "threshold_reached": _bool_field(
                    assessment,
                    "thresholdreached",
                    "threshold_reached",
                ),
                "warningcount": warning_count,
                "warning_count": warning_count,
                "violationcount": violation_count,
                "violation_count": violation_count,
                "violationthreshold": violation_threshold,
                "violation_threshold": violation_threshold,
                "credibilityscore": credibility_score,
                "credibility_score": credibility_score,
                "evidencecount": evidence_count,
                "evidence_count": evidence_count,
                "latestevidenceviolations": [
                    _serialize(item) for item in latest_violations
                ],
                "latest_evidence_violations": [
                    _serialize(item) for item in latest_violations
                ],
            }
        )

    return result
