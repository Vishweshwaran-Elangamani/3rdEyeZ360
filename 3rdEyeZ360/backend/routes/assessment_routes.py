from datetime import datetime, timedelta
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from config.database import getdb
from middleware.auth import requirerole
from sockets.monitoring_socket import emit_assessment_event
from services.exam_session_service import is_assessment_finalized, is_multi_session_exam
from services.evidence_service import upload_screenshot
from config.minio_client import get_minio_bucket

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


class DetectionBody(BaseModel):
    assessmentid: str | None = None
    assessment_id: str | None = None
    candidateid: str | None = None
    candidate_id: str | None = None
    examid: str | None = None
    exam_id: str | None = None
    detectiontype: str | None = None
    detection_type: str | None = None
    detail: str | None = None
    confidence: float | None = 0.0
    screenshotb64: str | None = None
    screenshot_b64: str | None = None
    timestamp: str | None = None
    sessionid: str | None = None
    session_id: str | None = None

    # Detailed monitoring fields from Electron/Python detectors
    category: str | None = None
    issue: str | None = None
    message: str | None = None
    candidate_action: str | None = None
    candidateAction: str | None = None
    typing_sensitive: bool | None = False


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
    return {"$or": [{"assessmentid": assessment_id}, {"assessment_id": assessment_id}]}


def _exam_query(exam_id: str) -> dict:
    return {"$or": [{"examid": exam_id}, {"exam_id": exam_id}]}


def _assessment_status(document: dict, default="") -> str:
    """Return lifecycle status, preferring assessment-specific compatibility fields."""
    value = (
        (document or {}).get("assessmentstatus")
        or (document or {}).get("assessment_status")
        or (document or {}).get("status")
        or default
    )
    return _normalize_status(value, default)


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


def _positive_int_value(document: dict | None, *keys, default=0) -> int:
    document = document or {}
    for key in keys:
        value = document.get(key)
        if value is None or value == "":
            continue
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            continue
        if parsed > 0:
            return parsed
    return int(default or 0)


def _calculate_credibility(warning_count: int, violation_count: int) -> int:
    """Calculate assessment credibility from persisted monitoring events."""
    warning_penalty = max(0, int(warning_count or 0)) * 1
    violation_penalty = max(0, int(violation_count or 0)) * 10
    return max(0, min(100, 100 - warning_penalty - violation_penalty))


def _terminal_status(status: str) -> bool:
    return _normalize_status(status) in {"COMPLETED", "TERMINATED", "LOCKED"}


def _requires_reentry(document: dict) -> bool:
    return _bool_value(document, "requiresreentryapproval", "requires_reentry_approval")


def _has_entered(document: dict) -> bool:
    return _bool_value(document, "hasenteredexam", "has_entered_exam")


def _approval_consumed(document: dict) -> bool:
    return _bool_value(document, "reentryapprovalconsumed", "reentry_approval_consumed")


def _session_id(document: dict):
    return _field_value(document, "activesessionid", "active_session_id")


def _waiting_session_id(document: dict):
    return _field_value(document, "waitingsessionid", "waiting_session_id")


def _waiting_registered_at(document: dict):
    return _field_value(document, "waitingregisteredat", "waiting_registered_at")


def _heartbeat_time(document: dict):
    return _field_value(document, "lastheartbeatat", "last_heartbeat_at")


def _heartbeat_expired(document: dict) -> bool:
    heartbeat = _heartbeat_time(document)
    if not isinstance(heartbeat, datetime):
        return True
    return datetime.utcnow() - heartbeat > timedelta(seconds=HEARTBEAT_EXPIRY_SECONDS)


async def _mark_reentry_required(db, assessment_id: str, reason: str, source: str):
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


def _merge_exam_into_assessment(assessment: dict, exam: dict | None) -> dict:
    assessment = assessment or {}
    data = _serialize(assessment)

    assessment_id = assessment.get("assessmentid") or assessment.get("assessment_id")
    exam_id = assessment.get("examid") or assessment.get("exam_id")
    candidate_id = assessment.get("candidateid") or assessment.get("candidate_id")
    examiner_id = assessment.get("examinerid") or assessment.get("examiner_id")

    status = _assessment_status(assessment)
    final_status = _normalize_status(assessment.get("finalstatus") or assessment.get("final_status"))

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
            "isfinalized": is_assessment_finalized(assessment),
            "is_finalized": is_assessment_finalized(assessment),
            "enteredexamsession": _field_value(assessment, "enteredexamsession", "entered_exam_session"),
            "entered_exam_session": _field_value(assessment, "enteredexamsession", "entered_exam_session"),
            "lastrequeststatus": _field_value(
                assessment, "lastrequeststatus", "last_request_status", default=""
            ),
            "last_request_status": _field_value(
                assessment, "lastrequeststatus", "last_request_status", default=""
            ),
            "lastrequesttype": _field_value(
                assessment, "lastrequesttype", "last_request_type", default=""
            ),
            "last_request_type": _field_value(
                assessment, "lastrequesttype", "last_request_type", default=""
            ),
            "lastrequestreviewreason": _field_value(
                assessment,
                "lastrequestreviewreason",
                "last_request_review_reason",
                "rejectionreason",
                "rejection_reason",
                default="",
            ),
            "last_request_review_reason": _field_value(
                assessment,
                "lastrequestreviewreason",
                "last_request_review_reason",
                "rejectionreason",
                "rejection_reason",
                default="",
            ),
            "rejectionreason": _field_value(
                assessment,
                "rejectionreason",
                "rejection_reason",
                "lastrequestreviewreason",
                "last_request_review_reason",
                default="",
            ),
            "rejection_reason": _field_value(
                assessment,
                "rejectionreason",
                "rejection_reason",
                "lastrequestreviewreason",
                "last_request_review_reason",
                default="",
            ),
        }
    )

    if not exam:
        data["allowedwebsites"] = assessment.get("allowedwebsites", assessment.get("allowed_websites", [])) or []
        data["allowed_websites"] = data["allowedwebsites"]
        data["allowedapplications"] = assessment.get("allowedapplications", assessment.get("allowed_applications", [])) or []
        data["allowed_applications"] = data["allowedapplications"]
        exam_status = _normalize_status(assessment.get("examstatus") or assessment.get("exam_status") or assessment.get("statusexam"))
        data["examstatus"] = exam_status
        data["exam_status"] = exam_status
        return data

    exam_data = _serialize(exam)
    exam_status = _normalize_status(exam.get("status") or exam.get("examstatus"))

    data["name"] = assessment.get("name") or exam_data.get("name") or exam_data.get("examname") or ""
    data["description"] = assessment.get("description") or exam_data.get("description") or exam_data.get("examdescription") or ""
    data["date"] = assessment.get("date") or exam_data.get("date") or exam_data.get("examdate") or ""
    data["start_time"] = assessment.get("start_time") or assessment.get("starttime") or exam_data.get("start_time") or exam_data.get("starttime") or ""
    data["starttime"] = data["start_time"]
    data["end_time"] = assessment.get("end_time") or assessment.get("endtime") or exam_data.get("end_time") or exam_data.get("endtime") or ""
    data["endtime"] = data["end_time"]
    data["duration_minutes"] = assessment.get(
        "duration_minutes",
        assessment.get("durationminutes", exam_data.get("duration_minutes", exam_data.get("durationminutes", 0))),
    )
    data["durationminutes"] = data["duration_minutes"]
    data["violation_threshold"] = assessment.get(
        "violation_threshold",
        assessment.get("violationthreshold", exam_data.get("violation_threshold", exam_data.get("violationthreshold", 10))),
    )
    data["violationthreshold"] = data["violation_threshold"]
    data["instructions"] = assessment.get("instructions") or exam_data.get("instructions") or ""

    allowed_websites = assessment.get("allowedwebsites") or assessment.get("allowed_websites") or exam_data.get("allowedwebsites") or exam_data.get("allowed_websites") or []
    allowed_apps = assessment.get("allowedapplications") or assessment.get("allowed_applications") or exam_data.get("allowedapplications") or exam_data.get("allowed_applications") or []

    data["allowedwebsites"] = allowed_websites
    data["allowed_websites"] = allowed_websites
    data["allowedapplications"] = allowed_apps
    data["allowed_applications"] = allowed_apps
    data["examstatus"] = exam_status
    data["exam_status"] = exam_status
    exam_type = str(exam_data.get("examtype") or exam_data.get("exam_type") or "SINGLE_SESSION").upper()
    timeframes = exam_data.get("timeframes") or exam_data.get("flexibleintervals") or exam_data.get("flexible_intervals") or []
    data["examtype"] = exam_type
    data["exam_type"] = exam_type
    data["isflexible"] = exam_type == "MULTI_SESSION"
    data["is_flexible"] = exam_type == "MULTI_SESSION"
    data["timeframes"] = timeframes
    data["flexibleintervals"] = timeframes
    data["flexible_intervals"] = timeframes
    data["sessionnumber"] = int(exam_data.get("sessionnumber", exam_data.get("session_number", 0)) or 0)
    data["session_number"] = data["sessionnumber"]
    data["permanentlystopped"] = bool(exam_data.get("permanentlystopped", exam_data.get("permanently_stopped", False)))
    data["permanently_stopped"] = data["permanentlystopped"]
    return data


def _safe_key(value: str) -> str:
    return str(value or "unknown").strip().lower().replace(" ", "_").replace("-", "_").replace(".", "_").replace("$", "_")


def _body_dict(body):
    if hasattr(body, "model_dump"):
        return body.model_dump()
    return body.dict()


def _detection_body_value(body: DetectionBody, *keys, default=None):
    data = _body_dict(body)
    for key in keys:
        value = data.get(key)
        if value is not None and value != "":
            return value
    return default


def _detection_category(detail: str, fallback: str | None = None) -> str:
    key = _safe_key(detail)
    categories = {
        "face_missing": "face",
        "multiple_faces": "face",
        "multiple_face": "face",
        "looking_left": "head_pose",
        "looking_right": "head_pose",
        "looking_down": "head_pose",
        "head_looking_left": "head_pose",
        "head_looking_right": "head_pose",
        "head_looking_down": "head_pose",
        "eyes_closed": "eye",
        "eye_gaze_left": "eye",
        "eye_gaze_right": "eye",
        "eye_gaze_down": "eye",
        "phone_detected": "device",
        "mobile_phone": "device",
        "cell_phone": "device",
        "background_speech": "voice",
        "high_noise": "voice",
        "mic_silent": "voice",
        "charger_disconnected": "power",
        "charger_connected": "power",
        "battery_low": "power",
    }
    return fallback or categories.get(key, "monitoring")


def _detection_issue(detail: str, fallback: str | None = None) -> str:
    key = _safe_key(detail)
    issues = {
        "looking_left": "head_looking_left",
        "looking_right": "head_looking_right",
        "looking_down": "head_looking_down",
    }
    return fallback or issues.get(key, key or "monitoring_issue")


def _candidate_action(detail: str, fallback: str | None = None) -> str:
    key = _safe_key(detail)
    actions = {
        "face_missing": "Sit in front of the camera and keep your face visible.",
        "multiple_faces": "Ensure only you are visible in the camera frame.",
        "multiple_face": "Ensure only you are visible in the camera frame.",
        "looking_left": "Face the exam screen.",
        "looking_right": "Face the exam screen.",
        "looking_down": "Look back at the exam screen.",
        "head_looking_left": "Face the exam screen.",
        "head_looking_right": "Face the exam screen.",
        "head_looking_down": "Look back at the exam screen.",
        "eyes_closed": "Open your eyes and keep looking at the exam screen.",
        "eye_gaze_left": "Keep your eyes focused on the exam content.",
        "eye_gaze_right": "Keep your eyes focused on the exam content.",
        "eye_gaze_down": "Keep your eyes focused on the exam content.",
        "phone_detected": "Remove the phone from the camera view.",
        "mobile_phone": "Remove the phone from the camera view.",
        "cell_phone": "Remove the phone from the camera view.",
        "background_speech": "Move to a quiet place or ask others to stop speaking.",
        "high_noise": "Reduce surrounding noise.",
        "mic_silent": "Check that your microphone is connected and working.",
        "charger_disconnected": "Connect your charger.",
        "battery_low": "Connect your charger.",
        "charger_connected": "",
    }
    return fallback or actions.get(key, "Correct the monitoring issue shown on screen.")


def _detection_message(detail: str, fallback: str | None = None) -> str:
    key = _safe_key(detail)
    messages = {
        "looking_left": "Please look at the examination screen. Your head appears to be turned left.",
        "looking_right": "Please look at the examination screen. Your head appears to be turned right.",
        "looking_down": "Please keep your face directed towards the screen.",
        "head_looking_left": "Please look at the examination screen. Your head appears to be turned left.",
        "head_looking_right": "Please look at the examination screen. Your head appears to be turned right.",
        "head_looking_down": "Please keep your face directed towards the screen.",
        "face_missing": "Please remain visible in the camera frame.",
        "multiple_faces": "Another person appears to be visible. Only the candidate should be in view.",
        "multiple_face": "Another person appears to be visible. Only the candidate should be in view.",
        "phone_detected": "Mobile phone detected. Please remove the phone from view.",
        "mobile_phone": "Mobile phone detected. Please remove the phone from view.",
        "cell_phone": "Mobile phone detected. Please remove the phone from view.",
        "eyes_closed": "Please keep your eyes open and focused on the exam screen.",
        "eye_gaze_left": "Please keep your eyes on the exam screen. Eye movement to the left was detected.",
        "eye_gaze_right": "Please keep your eyes on the exam screen. Eye movement to the right was detected.",
        "eye_gaze_down": "Please keep your eyes on the exam screen. Downward eye movement was detected.",
        "background_speech": "Background speech detected. Please stay in a quiet environment.",
        "high_noise": "High background noise detected. Please reduce surrounding noise.",
        "mic_silent": "Microphone input is very low. Please check your microphone.",
        "charger_disconnected": "Charger is disconnected. Please connect your charger.",
        "charger_connected": "Charger connected.",
        "battery_low": "Battery level is low. Please connect your charger.",
    }
    return fallback or messages.get(key, "Please follow the exam monitoring instructions.")


def _detection_policy(detection_type: str, detail: str, count: int) -> dict:
    key = _safe_key(detail or detection_type)

    if key in {"ok", "no_face", "face_ok", "charger_connected"}:
        return {"action": "ignore", "severity": "none", "toast": False, "warning": False, "violation": False}

    serious = {"phone_detected", "mobile_phone", "cell_phone", "multiple_faces", "multiple_face", "multiple_persons", "multiple_people"}
    medium = {
        "face_missing",
        "looking_left",
        "looking_right",
        "looking_down",
        "head_looking_left",
        "head_looking_right",
        "head_looking_down",
        "eyes_closed",
        "eye_gaze_left",
        "eye_gaze_right",
        "eye_gaze_down",
        "background_speech",
    }
    low = {"high_noise", "mic_silent", "charger_disconnected", "battery_low"}

    if key in serious:
        if count == 1:
            return {"action": "toast", "severity": "high", "toast": True, "warning": False, "violation": False}
        violation_now = count == 2 or count % 5 == 0
        return {"action": "violation" if violation_now else "warning", "severity": "high", "toast": True, "warning": True, "violation": violation_now}

    if key in medium:
        if count >= 5:
            violation_now = count == 5 or count % 10 == 0
            return {"action": "violation" if violation_now else "warning", "severity": "medium", "toast": True, "warning": True, "violation": violation_now}
        if count >= 2:
            return {"action": "warning", "severity": "low", "toast": True, "warning": True, "violation": False}
        return {"action": "toast", "severity": "low", "toast": True, "warning": False, "violation": False}

    if key in low:
        if count >= 2:
            return {"action": "warning", "severity": "low", "toast": True, "warning": True, "violation": False}
        return {"action": "toast", "severity": "low", "toast": True, "warning": False, "violation": False}

    if count >= 5:
        violation_now = count == 5 or count % 10 == 0
        return {"action": "violation" if violation_now else "warning", "severity": "medium", "toast": True, "warning": True, "violation": violation_now}
    if count >= 2:
        return {"action": "warning", "severity": "low", "toast": True, "warning": True, "violation": False}
    return {"action": "toast", "severity": "low", "toast": True, "warning": False, "violation": False}


@router.post("/detect")
async def detect_assessment_activity(body: DetectionBody, current_user=Depends(requirerole("Candidate", "Examiner", "Admin"))):
    db = getdb()

    assessment_id = _detection_body_value(body, "assessmentid", "assessment_id")
    candidate_id = _detection_body_value(body, "candidateid", "candidate_id")
    exam_id = _detection_body_value(body, "examid", "exam_id")

    detection_type = str(_detection_body_value(body, "detectiontype", "detection_type", default="unknown") or "unknown")
    detail = str(_detection_body_value(body, "detail", default="unknown") or "unknown")
    screenshot_b64 = _detection_body_value(body, "screenshotb64", "screenshot_b64")
    session_id = _detection_body_value(body, "sessionid", "session_id")
    confidence = float(body.confidence or 0.0)

    category_from_body = _detection_body_value(body, "category")
    issue_from_body = _detection_body_value(body, "issue")
    message_from_body = _detection_body_value(body, "message")
    candidate_action_from_body = _detection_body_value(body, "candidate_action", "candidateAction")
    typing_sensitive = bool(_detection_body_value(body, "typing_sensitive", default=False))

    safe_detail = _safe_key(detail)
    category = _detection_category(safe_detail, category_from_body)
    issue = _detection_issue(safe_detail, issue_from_body)
    message = _detection_message(safe_detail, message_from_body)
    candidate_action = _candidate_action(safe_detail, candidate_action_from_body)

    if not assessment_id or not candidate_id or not exam_id:
        raise HTTPException(status_code=400, detail="assessmentid, candidateid and examid are required")

    assessment = await _get_assessment_doc(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    user_id = current_user.get("userid") or current_user.get("user_id")
    assessment_candidate_id = assessment.get("candidateid") or assessment.get("candidate_id")
    assessment_exam_id = assessment.get("examid") or assessment.get("exam_id")
    assessment_examiner_id = assessment.get("examinerid") or assessment.get("examiner_id")

    if str(assessment_candidate_id) != str(candidate_id):
        raise HTTPException(status_code=409, detail="Candidate does not match assessment")
    if str(assessment_exam_id) != str(exam_id):
        raise HTTPException(status_code=409, detail="Exam does not match assessment")
    if current_user["role"] == "Candidate" and str(user_id) != str(candidate_id):
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user["role"] == "Examiner" and str(user_id) != str(assessment_examiner_id):
        raise HTTPException(status_code=403, detail="Access denied")

    status = _assessment_status(assessment)
    if status not in {"ACTIVE", "PAUSED"}:
        return {
            "success": True,
            "action": "ignored",
            "reason": f"Assessment status is {status}",
            "assessmentid": assessment_id,
            "candidateid": candidate_id,
            "examid": exam_id,
            "detectiontype": detection_type,
            "detail": detail,
            "category": category,
            "issue": issue,
            "message": message,
            "candidateaction": candidate_action,
            "candidate_action": candidate_action,
            "typingsensitive": typing_sensitive,
            "typing_sensitive": typing_sensitive,
        }

    now = datetime.utcnow()
    detection_key = f"{_safe_key(detection_type)}:{_safe_key(detail)}"
    counter_filter = {"assessmentid": assessment_id, "candidateid": candidate_id, "examid": exam_id, "detectionkey": detection_key}

    await db.detection_counters.update_one(
        counter_filter,
        {
            "$inc": {"count": 1},
            "$set": {
                "assessment_id": assessment_id,
                "candidate_id": candidate_id,
                "exam_id": exam_id,
                "detectiontype": detection_type,
                "detection_type": detection_type,
                "detail": detail,
                "confidence": confidence,
                "category": category,
                "issue": issue,
                "message": message,
                "candidateaction": candidate_action,
                "candidate_action": candidate_action,
                "typingsensitive": typing_sensitive,
                "typing_sensitive": typing_sensitive,
                "lastseenat": now,
                "last_seen_at": now,
                "updatedat": now,
                "updated_at": now,
                "sessionid": session_id,
                "session_id": session_id,
            },
            "$setOnInsert": {"createdat": now, "created_at": now},
        },
        upsert=True,
    )

    counter = await db.detection_counters.find_one(counter_filter)
    count = int((counter or {}).get("count", 1))
    policy = _detection_policy(detection_type, detail, count)

    event_doc = {
        "eventid": f"DET-{uuid.uuid4().hex.upper()}",
        "assessmentid": assessment_id,
        "assessment_id": assessment_id,
        "candidateid": candidate_id,
        "candidate_id": candidate_id,
        "examid": exam_id,
        "exam_id": exam_id,
        "detectiontype": detection_type,
        "detection_type": detection_type,
        "detail": detail,
        "confidence": confidence,
        "count": count,
        "action": policy["action"],
        "severity": policy["severity"],
        "message": message,
        "category": category,
        "issue": issue,
        "candidateaction": candidate_action,
        "candidate_action": candidate_action,
        "typingsensitive": typing_sensitive,
        "typing_sensitive": typing_sensitive,
        "createdat": now,
        "created_at": now,
        "sessionid": session_id,
        "session_id": session_id,
    }
    event_doc["event_id"] = event_doc["eventid"]
    await db.detection_events.insert_one(event_doc)

    update_assessment = {
        "$set": {
            "lastdetectionat": now,
            "last_detection_at": now,
            "lastdetectiondetail": detail,
            "last_detection_detail": detail,
            "lastdetectioncategory": category,
            "last_detection_category": category,
            "lastdetectionissue": issue,
            "last_detection_issue": issue,
            "updatedat": now,
            "updated_at": now,
        }
    }

    if policy["warning"]:
        warning_doc = {
            "warningid": f"WRN-{uuid.uuid4().hex.upper()}",
            "assessmentid": assessment_id,
            "assessment_id": assessment_id,
            "candidateid": candidate_id,
            "candidate_id": candidate_id,
            "examid": exam_id,
            "exam_id": exam_id,
            "detectiontype": detection_type,
            "detection_type": detection_type,
            "detail": detail,
            "confidence": confidence,
            "count": count,
            "message": message,
            "category": category,
            "issue": issue,
            "candidateaction": candidate_action,
            "candidate_action": candidate_action,
            "typingsensitive": typing_sensitive,
            "typing_sensitive": typing_sensitive,
            "createdat": now,
            "created_at": now,
            "sessionid": session_id,
            "session_id": session_id,
        }
        warning_doc["warning_id"] = warning_doc["warningid"]
        await db.warnings.insert_one(warning_doc)
        update_assessment.setdefault("$inc", {})["warningcount"] = 1
        update_assessment.setdefault("$inc", {})["warning_count"] = 1

    violation_doc = None
    evidence_object = None
    evidence_status = "not_available"
    evidence_error = None

    if policy["violation"]:
        violation_id = f"VIO-{uuid.uuid4().hex.upper()}"

        if screenshot_b64:
            try:
                evidence_object = await run_in_threadpool(
                    upload_screenshot,
                    exam_id,
                    candidate_id,
                    detail,
                    screenshot_b64,
                    assessment_id,
                    violation_id,
                )
                evidence_status = "available"
            except Exception as error:
                # Evidence storage must never prevent the violation, credibility
                # update, threshold lock, or candidate logout.
                evidence_status = "upload_failed"
                evidence_error = str(error)
                print(
                    "[Evidence] Violation screenshot upload failed:",
                    violation_id,
                    error,
                )

        violation_doc = {
            "violationid": violation_id,
            "violation_id": violation_id,
            "assessmentid": assessment_id,
            "assessment_id": assessment_id,
            "candidateid": candidate_id,
            "candidate_id": candidate_id,
            "examid": exam_id,
            "exam_id": exam_id,
            "detectiontype": detection_type,
            "detection_type": detection_type,
            "detail": detail,
            "confidence": confidence,
            "count": count,
            "severity": policy["severity"],
            "message": message,
            "category": category,
            "issue": issue,
            "candidateaction": candidate_action,
            "candidate_action": candidate_action,
            "typingsensitive": typing_sensitive,
            "typing_sensitive": typing_sensitive,
            "evidencestatus": evidence_status,
            "evidence_status": evidence_status,
            "evidenceavailable": evidence_status == "available",
            "evidence_available": evidence_status == "available",
            "evidencebucket": get_minio_bucket() if evidence_object else None,
            "evidence_bucket": get_minio_bucket() if evidence_object else None,
            "evidenceobject": evidence_object,
            "evidence_object": evidence_object,
            "screenshotpath": evidence_object,
            "screenshot_path": evidence_object,
            "evidencemimetype": "image/jpeg" if evidence_object else None,
            "evidence_mime_type": "image/jpeg" if evidence_object else None,
            "evidenceerror": evidence_error,
            "evidence_error": evidence_error,
            "createdat": now,
            "created_at": now,
            "sessionid": session_id,
            "session_id": session_id,
        }
        await db.violations.insert_one(violation_doc)
        update_assessment.setdefault("$inc", {})["violationcount"] = 1
        update_assessment.setdefault("$inc", {})["violation_count"] = 1

    await db.assessments.update_one(_assessment_query(assessment_id), update_assessment)

    updated = await _get_assessment_doc(db, assessment_id)
    exam = await _get_exam_doc(db, exam_id)

    warning_count = _positive_int_value(
        updated,
        "warningcount",
        "warning_count",
        default=0,
    )
    violation_count = _positive_int_value(
        updated,
        "violationcount",
        "violation_count",
        default=0,
    )
    credibility_score = _calculate_credibility(
        warning_count,
        violation_count,
    )
    await db.assessments.update_one(
        _assessment_query(assessment_id),
        {
            "$set": {
                "credibilityscore": credibility_score,
                "credibility_score": credibility_score,
                "updatedat": now,
                "updated_at": now,
            }
        },
    )
    updated = await _get_assessment_doc(db, assessment_id)

    violation_count = _positive_int_value(
        updated,
        "violationcount",
        "violation_count",
        default=0,
    )
    violation_threshold = _positive_int_value(
        exam,
        "violationthreshold",
        "violation_threshold",
        "threshold",
        default=10,
    )
    threshold_reached = False

    # The threshold belongs to the selected exam. Only a newly persisted
    # violation can trigger the automatic lock. Warnings never count toward it.
    if policy["violation"] and violation_count >= violation_threshold:
        current_status = _normalize_status(
            updated.get("status") or updated.get("assessmentstatus")
        )
        already_threshold_locked = _bool_value(
            updated,
            "thresholdreached",
            "threshold_reached",
            default=False,
        )

        if current_status not in {"COMPLETED", "TERMINATED"}:
            threshold_update = {
                "status": "LOCKED",
                "assessmentstatus": "LOCKED",
                "assessment_status": "LOCKED",
                "thresholdreached": True,
                "threshold_reached": True,
                "thresholdreachedat": now,
                "threshold_reached_at": now,
                "thresholdviolationcount": violation_count,
                "threshold_violation_count": violation_count,
                "violationthreshold": violation_threshold,
                "violation_threshold": violation_threshold,
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
                "interruptionreason": "Violation threshold reached",
                "interruption_reason": "Violation threshold reached",
                "interruptionsource": "VIOLATION_THRESHOLD",
                "interruption_source": "VIOLATION_THRESHOLD",
                "exittime": now,
                "exit_time": now,
                "updatedat": now,
                "updated_at": now,
            }
            await db.assessments.update_one(
                _assessment_query(assessment_id),
                {"$set": threshold_update},
            )
            updated = await _get_assessment_doc(db, assessment_id)
            threshold_reached = not already_threshold_locked

    payload = _merge_exam_into_assessment(updated, exam)
    payload["warningcount"] = warning_count
    payload["warning_count"] = warning_count
    payload["violationcount"] = violation_count
    payload["violation_count"] = violation_count
    payload["credibilityscore"] = credibility_score
    payload["credibility_score"] = credibility_score
    payload["violationthreshold"] = violation_threshold
    payload["violation_threshold"] = violation_threshold
    payload["thresholdreached"] = _bool_value(
        updated,
        "thresholdreached",
        "threshold_reached",
        default=False,
    )
    payload["threshold_reached"] = payload["thresholdreached"]

    socket_payload = {
        "assessmentid": assessment_id,
        "assessment_id": assessment_id,
        "candidateid": candidate_id,
        "candidate_id": candidate_id,
        "examid": exam_id,
        "exam_id": exam_id,
        "detectiontype": detection_type,
        "detection_type": detection_type,
        "detail": detail,
        "confidence": confidence,
        "count": count,
        "action": policy["action"],
        "severity": policy["severity"],
        "message": message,
        "category": category,
        "issue": issue,
        "candidateaction": candidate_action,
        "candidate_action": candidate_action,
        "typingsensitive": typing_sensitive,
        "typing_sensitive": typing_sensitive,
        "toast": policy["toast"],
        "warning": policy["warning"],
        "violation": policy["violation"],
        "warningcount": warning_count,
        "warning_count": warning_count,
        "violationcount": violation_count,
        "violation_count": violation_count,
        "violationthreshold": violation_threshold,
        "violation_threshold": violation_threshold,
        "credibilityscore": credibility_score,
        "credibility_score": credibility_score,
        "evidenceavailable": evidence_status == "available",
        "evidence_available": evidence_status == "available",
        "evidencestatus": evidence_status,
        "evidence_status": evidence_status,
        "evidenceobject": evidence_object,
        "evidence_object": evidence_object,
        "violationrecord": _serialize(violation_doc) if violation_doc else None,
        "violation_record": _serialize(violation_doc) if violation_doc else None,
        "thresholdreached": payload["thresholdreached"],
        "threshold_reached": payload["threshold_reached"],
        "status": payload.get("status"),
        "assessment": payload,
    }

    await emit_assessment_event("detection_event", socket_payload)
    if policy["warning"]:
        await emit_assessment_event("warning_created", socket_payload)
    if policy["violation"]:
        await emit_assessment_event("violation_created", socket_payload)
    if threshold_reached:
        threshold_payload = {
            **socket_payload,
            "action": "THRESHOLD_REACHED",
            "status": "LOCKED",
            "reason": "Violation threshold reached",
        }
        await emit_assessment_event("threshold_reached", threshold_payload)
        await emit_assessment_event("assessment_locked", threshold_payload)
        await emit_assessment_event("assessment_updated", payload)
    return {
        "success": True,
        "assessmentid": assessment_id,
        "candidateid": candidate_id,
        "examid": exam_id,
        "detectiontype": detection_type,
        "detail": detail,
        "confidence": confidence,
        "count": count,
        "action": policy["action"],
        "severity": policy["severity"],
        "toast": policy["toast"],
        "warning": policy["warning"],
        "violation": policy["violation"],
        "warningcount": warning_count,
        "warning_count": warning_count,
        "violationcount": violation_count,
        "violation_count": violation_count,
        "violationthreshold": violation_threshold,
        "violation_threshold": violation_threshold,
        "credibilityscore": credibility_score,
        "credibility_score": credibility_score,
        "evidenceavailable": evidence_status == "available",
        "evidence_available": evidence_status == "available",
        "evidencestatus": evidence_status,
        "evidence_status": evidence_status,
        "evidenceobject": evidence_object,
        "evidence_object": evidence_object,
        "violationrecord": _serialize(violation_doc) if violation_doc else None,
        "violation_record": _serialize(violation_doc) if violation_doc else None,
        "thresholdreached": payload["thresholdreached"],
        "threshold_reached": payload["threshold_reached"],
        "status": payload.get("status"),
        "message": message,
        "category": category,
        "issue": issue,
        "candidateaction": candidate_action,
        "candidate_action": candidate_action,
        "typingsensitive": typing_sensitive,
        "typing_sensitive": typing_sensitive,
        "assessment": payload,
    }


@router.get("/{assessment_id}")
async def get_assessment(assessment_id: str, current_user=Depends(requirerole("Candidate", "Examiner", "Admin"))):
    db = getdb()
    assessment = await _get_assessment_doc(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    user_id = current_user.get("userid") or current_user.get("user_id")
    candidate_id = assessment.get("candidateid") or assessment.get("candidate_id")
    examiner_id = assessment.get("examinerid") or assessment.get("examiner_id")

    if current_user["role"] == "Candidate" and candidate_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user["role"] == "Examiner" and examiner_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    status = _assessment_status(assessment)
    if current_user["role"] == "Candidate" and _has_entered(assessment) and status in {"ACTIVE", "PAUSED"} and _session_id(assessment) and _heartbeat_expired(assessment):
        await _mark_reentry_required(db, assessment_id, "Previous assessment session stopped responding", "HEARTBEAT_TIMEOUT")
        assessment = await _get_assessment_doc(db, assessment_id)

    exam_id = assessment.get("examid") or assessment.get("exam_id")
    latest_rejected_request = await db.requests.find_one(
        {
            "$and": [
                _assessment_query(assessment_id),
                {"status": "REJECTED"},
            ]
        },
        sort=[("reviewedat", -1), ("reviewed_at", -1), ("createdat", -1)],
    )
    if latest_rejected_request:
        rejection_reason = (
            latest_rejected_request.get("reviewreason")
            or latest_rejected_request.get("review_reason")
            or ""
        )
        assessment = {
            **assessment,
            "lastrequeststatus": "REJECTED",
            "last_request_status": "REJECTED",
            "lastrequestreviewreason": rejection_reason,
            "last_request_review_reason": rejection_reason,
            "rejectionreason": rejection_reason,
            "rejection_reason": rejection_reason,
        }
    exam = await _get_exam_doc(db, exam_id) if exam_id else None
    return _merge_exam_into_assessment(assessment, exam)


@router.post("/{assessment_id}/enter")
async def enter_assessment(assessment_id: str, body: EnterAssessmentBody, current_user=Depends(requirerole("Candidate"))):
    db = getdb()
    assessment = await _get_assessment_doc(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    user_id = current_user.get("userid") or current_user.get("user_id")
    candidate_id = assessment.get("candidateid") or assessment.get("candidate_id")
    if candidate_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    current_status = _assessment_status(assessment)
    if _terminal_status(current_status):
        raise HTTPException(status_code=400, detail=f"Assessment cannot be entered while status is {current_status}")

    exam_id = assessment.get("examid") or assessment.get("exam_id")
    exam = await _get_exam_doc(db, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    exam_status = _normalize_status(exam.get("status") or exam.get("examstatus"))
    if exam_status == "STOPPED" or bool(exam.get("permanentlystopped", exam.get("permanently_stopped", False))):
        raise HTTPException(status_code=403, detail="This multi-session exam was permanently stopped")
    if is_assessment_finalized(assessment):
        raise HTTPException(status_code=403, detail="This assessment was already finalized and cannot be entered again")
    now = datetime.utcnow()
    session_id = body.sessionid or f"SES-{uuid.uuid4().hex.upper()}"
    has_entered = _has_entered(assessment)

    if exam_status != "RUNNING":
        if not body.fromwaitingroom:
            raise HTTPException(status_code=400, detail="The exam is not running")
        if has_entered or _requires_reentry(assessment):
            raise HTTPException(status_code=403, detail="This candidate previously entered the active exam. Examiner re-entry approval is required.")
        if current_status not in {"ASSIGNED", "AVAILABLE", "READY"}:
            raise HTTPException(status_code=400, detail=f"This assessment cannot enter the waiting room while its status is {current_status}.")

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
        if not (assessment.get("jointime") or assessment.get("join_time")):
            waiting_update["jointime"] = now
            waiting_update["join_time"] = now

        await db.assessments.update_one(_assessment_query(assessment_id), {"$set": waiting_update})
        updated = await _get_assessment_doc(db, assessment_id)
        payload = _merge_exam_into_assessment(updated, exam)
        await emit_assessment_event("assessment_updated", payload)
        return {"success": True, "waiting": True, "sessionid": session_id, "session_id": session_id, "assessment": payload}

    waiting_session_id = _waiting_session_id(assessment)
    waiting_registered_at = _waiting_registered_at(assessment)
    valid_waiting_session = body.fromwaitingroom and bool(waiting_session_id) and bool(waiting_registered_at) and bool(body.sessionid) and str(waiting_session_id) == str(body.sessionid)

    if not has_entered:
        late_entry_approved = current_status in {"LATEENTRYAPPROVED", "LATEENTRY_APPROVED"}
        if not valid_waiting_session and not late_entry_approved:
            raise HTTPException(status_code=403, detail="The candidate was not registered in the waiting room. Late-entry permission is required.")
    else:
        if current_status not in {"REENTRYAPPROVED", "REENTRY_APPROVED"}:
            raise HTTPException(status_code=403, detail="Examiner re-entry approval is required before entering this assessment.")
        if _approval_consumed(assessment):
            raise HTTPException(status_code=403, detail="This re-entry approval has already been used. Submit a new re-entry request.")

    count = int(assessment.get("reentrycount", assessment.get("re_entry_count", 0)) or 0)
    update = {
        "status": "ACTIVE",
        "assessmentstatus": "ACTIVE",
        "assessment_status": "ACTIVE",
        "hasenteredexam": True,
        "has_entered_exam": True,
        "enteredexamsession": int(exam.get("sessionnumber", exam.get("session_number", 1)) or 1),
        "entered_exam_session": int(exam.get("sessionnumber", exam.get("session_number", 1)) or 1),
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

    if not (assessment.get("activetime") or assessment.get("active_time")):
        update["activetime"] = now
        update["active_time"] = now
    if has_entered:
        update["reentrycount"] = count + 1
        update["re_entry_count"] = count + 1

    await db.assessments.update_one(_assessment_query(assessment_id), {"$set": update})
    updated = await _get_assessment_doc(db, assessment_id)
    payload = _merge_exam_into_assessment(updated, exam)
    await emit_assessment_event("assessment_updated", payload)
    return {"success": True, "waiting": False, "sessionid": session_id, "session_id": session_id, "assessment": payload}


@router.post("/{assessment_id}/heartbeat")
async def heartbeat(assessment_id: str, body: HeartbeatBody, current_user=Depends(requirerole("Candidate"))):
    db = getdb()
    assessment = await _get_assessment_doc(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    user_id = current_user.get("userid") or current_user.get("user_id")
    if (assessment.get("candidateid") or assessment.get("candidate_id")) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if _session_id(assessment) != body.sessionid:
        raise HTTPException(status_code=409, detail="Assessment session is no longer valid")

    status = _assessment_status(assessment)
    if status not in {"ACTIVE", "PAUSED"}:
        raise HTTPException(status_code=409, detail="Assessment session is not active")

    now = datetime.utcnow()
    await db.assessments.update_one(_assessment_query(assessment_id), {"$set": {"lastheartbeatat": now, "last_heartbeat_at": now, "updatedat": now, "updated_at": now}})
    return {"success": True, "timestamp": now}


@router.post("/{assessment_id}/interrupt")
async def interrupt(assessment_id: str, body: InterruptAssessmentBody, current_user=Depends(requirerole("Candidate"))):
    db = getdb()
    assessment = await _get_assessment_doc(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    user_id = current_user.get("userid") or current_user.get("user_id")
    if (assessment.get("candidateid") or assessment.get("candidate_id")) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    status = _assessment_status(assessment)
    if _terminal_status(status) or not _has_entered(assessment):
        return {"success": True, "status": status}
    if body.sessionid and _session_id(assessment) and body.sessionid != _session_id(assessment):
        return {"success": True, "status": status}

    await _mark_reentry_required(db, assessment_id, body.reason or "Candidate left the secured assessment session", body.source or "CLIENT_EXIT")
    updated = await _get_assessment_doc(db, assessment_id)
    exam = await _get_exam_doc(db, updated.get("examid") or updated.get("exam_id"))
    payload = _merge_exam_into_assessment(updated, exam)
    await emit_assessment_event("assessment_updated", payload)
    return {"success": True, "status": "REENTRY_REQUIRED", "assessment": payload}


@router.patch("/{assessment_id}/status")
async def update_assessment_status(assessment_id: str, body: dict, current_user=Depends(requirerole("Candidate", "Examiner", "Admin"))):
    db = getdb()
    assessment = await _get_assessment_doc(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    user_id = current_user.get("userid") or current_user.get("user_id")
    candidate_id = assessment.get("candidateid") or assessment.get("candidate_id")
    examiner_id = assessment.get("examinerid") or assessment.get("examiner_id")
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

    exam_status = _normalize_status(exam.get("status") or exam.get("examstatus"))
    current_status = _assessment_status(assessment)

    if current_user["role"] == "Candidate":
        if new_status != "READY":
            raise HTTPException(status_code=403, detail="Candidate cannot set this status")
        if exam_status == "RUNNING":
            raise HTTPException(status_code=400, detail="Exam already started. Candidate must request permission.")
        if current_status not in {"ASSIGNED", "AVAILABLE", "READY"}:
            raise HTTPException(status_code=400, detail=f"Cannot move assessment from {current_status or 'UNKNOWN'} to READY")

    now = datetime.utcnow()
    update = {"status": new_status, "assessmentstatus": new_status, "assessment_status": new_status, "updatedat": now, "updated_at": now}
    if new_status == "READY" and not (assessment.get("jointime") or assessment.get("join_time")):
        update["jointime"] = now
        update["join_time"] = now

    await db.assessments.update_one(_assessment_query(assessment_id), {"$set": update})
    updated = await _get_assessment_doc(db, assessment_id)
    payload = _merge_exam_into_assessment(updated, exam)
    await emit_assessment_event("assessment_updated", payload)
    return payload


@router.post("/{assessment_id}/action")
async def assessment_action(assessment_id: str, body: dict, current_user=Depends(requirerole("Examiner", "Admin"))):
    db = getdb()
    assessment = await _get_assessment_doc(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    user_id = current_user.get("userid") or current_user.get("user_id")
    examiner_id = assessment.get("examinerid") or assessment.get("examiner_id")
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

    exam_status = _normalize_status(exam.get("status") or exam.get("examstatus"))
    current_status = _assessment_status(assessment)
    now = datetime.utcnow()
    update = {"updatedat": now, "updated_at": now, "lastaction": action, "lastactionby": user_id}
    if reason:
        update["actionreason"] = reason

    if action == "terminate":
        if current_status in {"TERMINATED", "COMPLETED", "LOCKED"} or is_assessment_finalized(assessment):
            raise HTTPException(status_code=409, detail="Finalized assessment cannot be modified")
        update.update({"status": "TERMINATED", "assessmentstatus": "TERMINATED", "assessment_status": "TERMINATED", "finalstatus": "TERMINATED", "final_status": "TERMINATED", "isfinalized": True, "is_finalized": True, "finalizedreason": "EXAMINER_TERMINATED", "finalized_reason": "EXAMINER_TERMINATED", "finalizedat": now, "finalized_at": now, "activesessionid": None, "active_session_id": None, "waitingsessionid": None, "waiting_session_id": None, "exittime": now, "exit_time": now})
    elif action == "pause":
        if current_status == "PAUSED":
            raise HTTPException(status_code=409, detail="Assessment is already paused")
        if current_status != "ACTIVE":
            raise HTTPException(status_code=409, detail=f"Only an active assessment can be paused; current status is {current_status or 'UNKNOWN'}")
        update.update({"status": "PAUSED", "assessmentstatus": "PAUSED", "assessment_status": "PAUSED"})
    else:
        if exam_status != "RUNNING":
            raise HTTPException(status_code=400, detail="Exam must be RUNNING to resume assessment")
        if current_status == "ACTIVE":
            raise HTTPException(status_code=409, detail="Assessment is already active")
        if current_status != "PAUSED":
            raise HTTPException(status_code=409, detail=f"Only a paused assessment can be resumed; current status is {current_status or 'UNKNOWN'}")
        update.update({"status": "ACTIVE", "assessmentstatus": "ACTIVE", "assessment_status": "ACTIVE"})
        if not (assessment.get("activetime") or assessment.get("active_time")):
            update["activetime"] = now
            update["active_time"] = now

    await db.assessments.update_one(_assessment_query(assessment_id), {"$set": update})
    updated = await _get_assessment_doc(db, assessment_id)
    payload = _merge_exam_into_assessment(updated, exam)
    await emit_assessment_event("assessment_updated", payload)
    return {"message": f"Assessment action '{action}' applied", "assessment": payload}
