from datetime import datetime, timedelta
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from config.database import getdb
from middleware.auth import requirerole

router = APIRouter(prefix="/api/assessments", tags=["Assessments"])

HEARTBEAT_EXPIRY_SECONDS = 30


class EnterAssessmentBody(BaseModel):
    sessionid: str | None = None
    fromwaitingroom: bool = False


class InterruptAssessmentBody(BaseModel):
    reason: str | None = None
    source: str | None = None
    sessionid: str | None = None


class HeartbeatBody(BaseModel):
    sessionid: str


def _serialize(document: dict) -> dict:
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


def _assessment_query(assessment_id: str) -> dict:
    return {
        "$or": [
            {"assessmentid": assessment_id},
            {"assessment_id": assessment_id},
        ]
    }


def _exam_query(exam_id: str) -> dict:
    return {
        "$or": [
            {"examid": exam_id},
            {"exam_id": exam_id},
        ]
    }


async def _get_assessment_doc(db, assessment_id: str):
    return await db.assessments.find_one(_assessment_query(assessment_id))


async def _get_exam_doc(db, exam_id: str):
    return await db.exams.find_one(_exam_query(exam_id))


def _bool_value(document: dict, *keys, default=False) -> bool:
    for key in keys:
        if key in document:
            return bool(document.get(key))
    return default


def _field_value(document: dict, *keys, default=None):
    for key in keys:
        value = document.get(key)
        if value is not None:
            return value
    return default


def _terminal_status(status: str) -> bool:
    return _normalize_status(status) in {
        "COMPLETED",
        "TERMINATED",
        "LOCKED",
    }


def _requires_reentry(document: dict) -> bool:
    return _bool_value(
        document,
        "requiresreentryapproval",
        "requires_reentry_approval",
    )


def _has_entered(document: dict) -> bool:
    return _bool_value(
        document,
        "hasenteredexam",
        "has_entered_exam",
    )


def _approval_consumed(document: dict) -> bool:
    return _bool_value(
        document,
        "reentryapprovalconsumed",
        "reentry_approval_consumed",
    )


def _session_id(document: dict):
    return _field_value(
        document,
        "activesessionid",
        "active_session_id",
    )


def _waiting_session_id(document: dict):
    return _field_value(
        document,
        "waitingsessionid",
        "waiting_session_id",
    )


def _waiting_registered_at(document: dict):
    return _field_value(
        document,
        "waitingregisteredat",
        "waiting_registered_at",
    )


def _heartbeat_time(document: dict):
    return _field_value(
        document,
        "lastheartbeatat",
        "last_heartbeat_at",
    )


def _heartbeat_expired(document: dict) -> bool:
    heartbeat = _heartbeat_time(document)
    if not isinstance(heartbeat, datetime):
        return True
    return datetime.utcnow() - heartbeat > timedelta(
        seconds=HEARTBEAT_EXPIRY_SECONDS
    )


async def _mark_reentry_required(
    db,
    assessment_id: str,
    reason: str,
    source: str,
):
    now = datetime.utcnow()
    await db.assessments.update_one(
        _assessment_query(assessment_id),
        {
            "$set": {
                "status": "REENTRY_REQUIRED",
                "assessmentstatus": "REENTRY_REQUIRED",
                "assessment_status": "REENTRY_REQUIRED",
                "requiresreentryapproval": True,
                "requires_reentry_approval": True,
                "reentryapprovalconsumed": False,
                "reentry_approval_consumed": False,
                "activesessionid": None,
                "active_session_id": None,
                "lastheartbeatat": None,
                "last_heartbeat_at": None,
                "interruptedat": now,
                "interrupted_at": now,
                "interruptionreason": reason,
                "interruption_reason": reason,
                "interruptionsource": source,
                "interruption_source": source,
                "exittime": now,
                "exit_time": now,
                "updatedat": now,
                "updated_at": now,
            }
        },
    )


def _merge_exam_into_assessment(
    assessment: dict,
    exam: dict | None,
) -> dict:
    assessment = assessment or {}
    data = _serialize(assessment)

    assessment_id = assessment.get("assessmentid") or assessment.get(
        "assessment_id"
    )
    exam_id = assessment.get("examid") or assessment.get("exam_id")
    candidate_id = assessment.get("candidateid") or assessment.get(
        "candidate_id"
    )
    examiner_id = assessment.get("examinerid") or assessment.get(
        "examiner_id"
    )

    status = _normalize_status(
        assessment.get("status") or assessment.get("assessmentstatus")
    )
    final_status = _normalize_status(
        assessment.get("finalstatus") or assessment.get("final_status")
    )

    data.update(
        {
            "assessmentid": assessment_id,
            "assessment_id": assessment_id,
            "examid": exam_id,
            "exam_id": exam_id,
            "candidateid": candidate_id,
            "candidate_id": candidate_id,
            "examinerid": examiner_id,
            "examiner_id": examiner_id,
            "status": status,
            "assessmentstatus": status,
            "assessment_status": status,
            "finalstatus": final_status,
            "final_status": final_status,
            "hasenteredexam": _has_entered(assessment),
            "has_entered_exam": _has_entered(assessment),
            "requiresreentryapproval": _requires_reentry(assessment),
            "requires_reentry_approval": _requires_reentry(assessment),
            "reentryapprovalconsumed": _approval_consumed(assessment),
            "reentry_approval_consumed": _approval_consumed(assessment),
            "activesessionid": _session_id(assessment),
            "active_session_id": _session_id(assessment),
            "waitingsessionid": _waiting_session_id(assessment),
            "waiting_session_id": _waiting_session_id(assessment),
            "waitingregisteredat": _waiting_registered_at(assessment),
            "waiting_registered_at": _waiting_registered_at(assessment),
            "lastheartbeatat": _heartbeat_time(assessment),
            "last_heartbeat_at": _heartbeat_time(assessment),
        }
    )

    if not exam:
        data["allowedwebsites"] = assessment.get(
            "allowedwebsites",
            assessment.get("allowed_websites", []),
        ) or []
        data["allowed_websites"] = data["allowedwebsites"]
        data["allowedapplications"] = assessment.get(
            "allowedapplications",
            assessment.get("allowed_applications", []),
        ) or []
        data["allowed_applications"] = data["allowedapplications"]
        exam_status = _normalize_status(
            assessment.get("examstatus")
            or assessment.get("exam_status")
            or assessment.get("statusexam")
        )
        data["examstatus"] = exam_status
        data["exam_status"] = exam_status
        return data

    exam_data = _serialize(exam)
    exam_status = _normalize_status(
        exam.get("status") or exam.get("examstatus")
    )

    data["name"] = (
        assessment.get("name")
        or exam_data.get("name")
        or exam_data.get("examname")
        or ""
    )
    data["description"] = (
        assessment.get("description")
        or exam_data.get("description")
        or exam_data.get("examdescription")
        or ""
    )
    data["date"] = (
        assessment.get("date")
        or exam_data.get("date")
        or exam_data.get("examdate")
        or ""
    )
    data["start_time"] = (
        assessment.get("start_time")
        or assessment.get("starttime")
        or exam_data.get("start_time")
        or exam_data.get("starttime")
        or ""
    )
    data["starttime"] = data["start_time"]
    data["end_time"] = (
        assessment.get("end_time")
        or assessment.get("endtime")
        or exam_data.get("end_time")
        or exam_data.get("endtime")
        or ""
    )
    data["endtime"] = data["end_time"]
    data["duration_minutes"] = assessment.get(
        "duration_minutes",
        assessment.get(
            "durationminutes",
            exam_data.get(
                "duration_minutes",
                exam_data.get("durationminutes", 0),
            ),
        ),
    )
    data["durationminutes"] = data["duration_minutes"]
    data["violation_threshold"] = assessment.get(
        "violation_threshold",
        assessment.get(
            "violationthreshold",
            exam_data.get(
                "violation_threshold",
                exam_data.get("violationthreshold", 10),
            ),
        ),
    )
    data["violationthreshold"] = data["violation_threshold"]
    data["instructions"] = (
        assessment.get("instructions")
        or exam_data.get("instructions")
        or ""
    )

    allowed_websites = (
        assessment.get("allowedwebsites")
        or assessment.get("allowed_websites")
        or exam_data.get("allowedwebsites")
        or exam_data.get("allowed_websites")
        or []
    )
    allowed_apps = (
        assessment.get("allowedapplications")
        or assessment.get("allowed_applications")
        or exam_data.get("allowedapplications")
        or exam_data.get("allowed_applications")
        or []
    )

    data["allowedwebsites"] = allowed_websites
    data["allowed_websites"] = allowed_websites
    data["allowedapplications"] = allowed_apps
    data["allowed_applications"] = allowed_apps
    data["examstatus"] = exam_status
    data["exam_status"] = exam_status
    return data


@router.get("/{assessment_id}")
async def get_assessment(
    assessment_id: str,
    current_user=Depends(
        requirerole("Candidate", "Examiner", "Admin")
    ),
):
    db = getdb()
    assessment = await _get_assessment_doc(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    user_id = current_user.get("userid") or current_user.get("user_id")
    candidate_id = assessment.get("candidateid") or assessment.get(
        "candidate_id"
    )
    examiner_id = assessment.get("examinerid") or assessment.get(
        "examiner_id"
    )

    if current_user["role"] == "Candidate" and candidate_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user["role"] == "Examiner" and examiner_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    status = _normalize_status(
        assessment.get("status") or assessment.get("assessmentstatus")
    )

    if (
        current_user["role"] == "Candidate"
        and _has_entered(assessment)
        and status in {"ACTIVE", "PAUSED"}
        and _session_id(assessment)
        and _heartbeat_expired(assessment)
    ):
        await _mark_reentry_required(
            db,
            assessment_id,
            "Previous assessment session stopped responding",
            "HEARTBEAT_TIMEOUT",
        )
        assessment = await _get_assessment_doc(db, assessment_id)

    exam_id = assessment.get("examid") or assessment.get("exam_id")
    exam = await _get_exam_doc(db, exam_id) if exam_id else None
    return _merge_exam_into_assessment(assessment, exam)


@router.post("/{assessment_id}/enter")
async def enter_assessment(
    assessment_id: str,
    body: EnterAssessmentBody,
    current_user=Depends(requirerole("Candidate")),
):
    db = getdb()
    assessment = await _get_assessment_doc(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    user_id = current_user.get("userid") or current_user.get("user_id")
    candidate_id = assessment.get("candidateid") or assessment.get(
        "candidate_id"
    )
    if candidate_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    current_status = _normalize_status(
        assessment.get("status") or assessment.get("assessmentstatus")
    )
    if _terminal_status(current_status):
        raise HTTPException(
            status_code=400,
            detail=(
                "Assessment cannot be entered while status is "
                f"{current_status}"
            ),
        )

    exam_id = assessment.get("examid") or assessment.get("exam_id")
    exam = await _get_exam_doc(db, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    exam_status = _normalize_status(
        exam.get("status") or exam.get("examstatus")
    )
    now = datetime.utcnow()
    session_id = body.sessionid or f"SES-{uuid.uuid4().hex.upper()}"
    has_entered = _has_entered(assessment)

    # Waiting-room registration is allowed only before the first active entry.
    if exam_status != "RUNNING":
        if not body.fromwaitingroom:
            raise HTTPException(
                status_code=400,
                detail="The exam is not running",
            )
        if has_entered or _requires_reentry(assessment):
            raise HTTPException(
                status_code=403,
                detail=(
                    "This candidate previously entered the active exam. "
                    "Examiner re-entry approval is required."
                ),
            )
        if current_status not in {"ASSIGNED", "AVAILABLE", "READY"}:
            raise HTTPException(
                status_code=400,
                detail=(
                    "This assessment cannot enter the waiting room "
                    f"while its status is {current_status}."
                ),
            )

        waiting_update = {
            "status": "READY",
            "assessmentstatus": "READY",
            "assessment_status": "READY",
            "waitingsessionid": session_id,
            "waiting_session_id": session_id,
            "waitingregisteredat": now,
            "waiting_registered_at": now,
            "updatedat": now,
            "updated_at": now,
        }
        if not (
            assessment.get("jointime") or assessment.get("join_time")
        ):
            waiting_update["jointime"] = now
            waiting_update["join_time"] = now

        await db.assessments.update_one(
            _assessment_query(assessment_id),
            {"$set": waiting_update},
        )
        updated = await _get_assessment_doc(db, assessment_id)
        return {
            "success": True,
            "waiting": True,
            "sessionid": session_id,
            "session_id": session_id,
            "assessment": _merge_exam_into_assessment(updated, exam),
        }

    waiting_session_id = _waiting_session_id(assessment)
    waiting_registered_at = _waiting_registered_at(assessment)
    valid_waiting_session = (
        body.fromwaitingroom
        and bool(waiting_session_id)
        and bool(waiting_registered_at)
        and bool(body.sessionid)
        and str(waiting_session_id) == str(body.sessionid)
    )

    # First active entry requires either prior waiting-room registration or
    # an explicit late-entry approval.
    if not has_entered:
        late_entry_approved = current_status in {
            "LATEENTRYAPPROVED",
            "LATEENTRY_APPROVED",
        }
        if not valid_waiting_session and not late_entry_approved:
            raise HTTPException(
                status_code=403,
                detail=(
                    "The candidate was not registered in the waiting room. "
                    "Late-entry permission is required."
                ),
            )
    else:
        # Every entry after the first active session must consume a new,
        # unused REENTRY approval. The requires flag alone is not sufficient.
        if current_status not in {
            "REENTRYAPPROVED",
            "REENTRY_APPROVED",
        }:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Examiner re-entry approval is required before entering "
                    "this assessment."
                ),
            )
        if _approval_consumed(assessment):
            raise HTTPException(
                status_code=403,
                detail=(
                    "This re-entry approval has already been used. "
                    "Submit a new re-entry request."
                ),
            )

    count = int(
        assessment.get(
            "reentrycount",
            assessment.get("re_entry_count", 0),
        )
        or 0
    )

    update = {
        "status": "ACTIVE",
        "assessmentstatus": "ACTIVE",
        "assessment_status": "ACTIVE",
        "hasenteredexam": True,
        "has_entered_exam": True,
        "requiresreentryapproval": False,
        "requires_reentry_approval": False,
        "reentryapprovalconsumed": has_entered,
        "reentry_approval_consumed": has_entered,
        "activesessionid": session_id,
        "active_session_id": session_id,
        "lastheartbeatat": now,
        "last_heartbeat_at": now,
        "waitingsessionid": None,
        "waiting_session_id": None,
        "waitingregisteredat": None,
        "waiting_registered_at": None,
        "interruptedat": None,
        "interrupted_at": None,
        "interruptionreason": None,
        "interruption_reason": None,
        "interruptionsource": None,
        "interruption_source": None,
        "updatedat": now,
        "updated_at": now,
    }

    if not (
        assessment.get("activetime") or assessment.get("active_time")
    ):
        update["activetime"] = now
        update["active_time"] = now

    if has_entered:
        update["reentrycount"] = count + 1
        update["re_entry_count"] = count + 1

    await db.assessments.update_one(
        _assessment_query(assessment_id),
        {"$set": update},
    )
    updated = await _get_assessment_doc(db, assessment_id)
    return {
        "success": True,
        "waiting": False,
        "sessionid": session_id,
        "session_id": session_id,
        "assessment": _merge_exam_into_assessment(updated, exam),
    }


@router.post("/{assessment_id}/heartbeat")
async def heartbeat(
    assessment_id: str,
    body: HeartbeatBody,
    current_user=Depends(requirerole("Candidate")),
):
    db = getdb()
    assessment = await _get_assessment_doc(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    user_id = current_user.get("userid") or current_user.get("user_id")
    if (
        assessment.get("candidateid") or assessment.get("candidate_id")
    ) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if _session_id(assessment) != body.sessionid:
        raise HTTPException(
            status_code=409,
            detail="Assessment session is no longer valid",
        )

    status = _normalize_status(
        assessment.get("status") or assessment.get("assessmentstatus")
    )
    if status not in {"ACTIVE", "PAUSED"}:
        raise HTTPException(
            status_code=409,
            detail="Assessment session is not active",
        )

    now = datetime.utcnow()
    await db.assessments.update_one(
        _assessment_query(assessment_id),
        {
            "$set": {
                "lastheartbeatat": now,
                "last_heartbeat_at": now,
                "updatedat": now,
                "updated_at": now,
            }
        },
    )
    return {"success": True, "timestamp": now}


@router.post("/{assessment_id}/interrupt")
async def interrupt(
    assessment_id: str,
    body: InterruptAssessmentBody,
    current_user=Depends(requirerole("Candidate")),
):
    db = getdb()
    assessment = await _get_assessment_doc(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    user_id = current_user.get("userid") or current_user.get("user_id")
    if (
        assessment.get("candidateid") or assessment.get("candidate_id")
    ) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    status = _normalize_status(
        assessment.get("status") or assessment.get("assessmentstatus")
    )
    if _terminal_status(status) or not _has_entered(assessment):
        return {"success": True, "status": status}

    if (
        body.sessionid
        and _session_id(assessment)
        and body.sessionid != _session_id(assessment)
    ):
        return {"success": True, "status": status}

    await _mark_reentry_required(
        db,
        assessment_id,
        body.reason or "Candidate left the secured assessment session",
        body.source or "CLIENT_EXIT",
    )
    return {"success": True, "status": "REENTRY_REQUIRED"}


@router.patch("/{assessment_id}/status")
async def update_assessment_status(
    assessment_id: str,
    body: dict,
    current_user=Depends(
        requirerole("Candidate", "Examiner", "Admin")
    ),
):
    db = getdb()
    assessment = await _get_assessment_doc(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    user_id = current_user.get("userid") or current_user.get("user_id")
    candidate_id = assessment.get("candidateid") or assessment.get(
        "candidate_id"
    )
    examiner_id = assessment.get("examinerid") or assessment.get(
        "examiner_id"
    )
    exam_id = assessment.get("examid") or assessment.get("exam_id")

    if current_user["role"] == "Candidate" and candidate_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user["role"] == "Examiner" and examiner_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    new_status = _normalize_status(body.get("status"))
    if not new_status:
        raise HTTPException(status_code=400, detail="status is required")

    exam = await _get_exam_doc(db, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    exam_status = _normalize_status(
        exam.get("status") or exam.get("examstatus")
    )
    current_status = _normalize_status(
        assessment.get("status") or assessment.get("assessmentstatus")
    )

    if current_user["role"] == "Candidate":
        if new_status != "READY":
            raise HTTPException(
                status_code=403,
                detail="Candidate cannot set this status",
            )
        if exam_status == "RUNNING":
            raise HTTPException(
                status_code=400,
                detail=(
                    "Exam already started. Candidate must request permission."
                ),
            )
        if current_status not in {"ASSIGNED", "AVAILABLE", "READY"}:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Cannot move assessment from "
                    f"{current_status or 'UNKNOWN'} to READY"
                ),
            )

    now = datetime.utcnow()
    update = {
        "status": new_status,
        "assessmentstatus": new_status,
        "assessment_status": new_status,
        "updatedat": now,
        "updated_at": now,
    }
    if new_status == "READY" and not (
        assessment.get("jointime") or assessment.get("join_time")
    ):
        update["jointime"] = now
        update["join_time"] = now

    await db.assessments.update_one(
        _assessment_query(assessment_id),
        {"$set": update},
    )
    updated = await _get_assessment_doc(db, assessment_id)
    return _merge_exam_into_assessment(updated, exam)


@router.post("/{assessment_id}/action")
async def assessment_action(
    assessment_id: str,
    body: dict,
    current_user=Depends(requirerole("Examiner", "Admin")),
):
    db = getdb()
    assessment = await _get_assessment_doc(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    user_id = current_user.get("userid") or current_user.get("user_id")
    examiner_id = assessment.get("examinerid") or assessment.get(
        "examiner_id"
    )
    exam_id = assessment.get("examid") or assessment.get("exam_id")

    if current_user["role"] == "Examiner" and examiner_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    action = str(body.get("action") or "").strip().lower()
    reason = str(body.get("reason") or "").strip()
    if action not in {"pause", "resume", "terminate"}:
        raise HTTPException(status_code=400, detail="Invalid action")

    exam = await _get_exam_doc(db, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    exam_status = _normalize_status(
        exam.get("status") or exam.get("examstatus")
    )
    current_status = _normalize_status(
        assessment.get("status") or assessment.get("assessmentstatus")
    )
    now = datetime.utcnow()
    update = {
        "updatedat": now,
        "updated_at": now,
        "lastaction": action,
        "lastactionby": user_id,
    }
    if reason:
        update["actionreason"] = reason

    if action == "terminate":
        update.update(
            {
                "status": "TERMINATED",
                "assessmentstatus": "TERMINATED",
                "assessment_status": "TERMINATED",
                "finalstatus": "TERMINATED",
                "final_status": "TERMINATED",
                "activesessionid": None,
                "active_session_id": None,
                "waitingsessionid": None,
                "waiting_session_id": None,
                "exittime": now,
                "exit_time": now,
            }
        )
    elif action == "pause":
        if current_status in {"TERMINATED", "COMPLETED", "LOCKED"}:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot pause assessment in {current_status}",
            )
        update.update(
            {
                "status": "PAUSED",
                "assessmentstatus": "PAUSED",
                "assessment_status": "PAUSED",
            }
        )
    else:
        if exam_status != "RUNNING":
            raise HTTPException(
                status_code=400,
                detail="Exam must be RUNNING to resume assessment",
            )
        if current_status in {"TERMINATED", "COMPLETED", "LOCKED"}:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot resume assessment in {current_status}",
            )
        update.update(
            {
                "status": "ACTIVE",
                "assessmentstatus": "ACTIVE",
                "assessment_status": "ACTIVE",
            }
        )
        if not (
            assessment.get("activetime")
            or assessment.get("active_time")
        ):
            update["activetime"] = now
            update["active_time"] = now

    await db.assessments.update_one(
        _assessment_query(assessment_id),
        {"$set": update},
    )
    updated = await _get_assessment_doc(db, assessment_id)
    return {
        "message": f"Assessment action '{action}' applied",
        "assessment": _merge_exam_into_assessment(updated, exam),
    }
