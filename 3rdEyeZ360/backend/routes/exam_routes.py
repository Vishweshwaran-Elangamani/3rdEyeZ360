from datetime import datetime
import asyncio
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException

from config.database import get_db
from middleware.auth import require_role
from utils.id_generator import generate_assessment_id
from sockets.monitoring_socket import emit_exam_event, emit_assessment_event
from services.email_service import (
    send_exam_assignment_email,
    send_exam_removal_email,
)
from services.exam_session_service import (
    is_assessment_finalized,
    is_multi_session_exam,
    participated_in_current_session,
    prepare_exam_schedule,
)


router = APIRouter(
    prefix="/api/exams",
    tags=["Exams"],
)

logger = logging.getLogger(__name__)
MAX_CANDIDATES_PER_EXAM = 25


def _serialize(document: dict) -> dict:
    return {
        key: str(value) if key == "_id" else value
        for key, value in document.items()
        if key != "_id"
    }


def _get_exam_query(exam_id: str):
    return {
        "$or": [
            {"exam_id": exam_id},
            {"examid": exam_id},
        ]
    }


def _get_user_query(user_id: str):
    return {
        "$or": [
            {"user_id": user_id},
            {"userid": user_id},
        ]
    }


def _get_assessment_query(
    exam_id: str,
    candidate_id: str,
):
    return {
        "$or": [
            {
                "exam_id": exam_id,
                "candidate_id": candidate_id,
            },
            {
                "exam_id": exam_id,
                "candidateid": candidate_id,
            },
            {
                "examid": exam_id,
                "candidate_id": candidate_id,
            },
            {
                "examid": exam_id,
                "candidateid": candidate_id,
            },
        ]
    }


def _normalize_status(value, default=""):
    return str(value or default).strip().upper()


def _clean_list(value):
    if not isinstance(value, list):
        return []

    return [
        item
        for item in value
        if item not in (None, "", [])
    ]


def _exam_payload(exam: dict) -> dict:
    exam = exam or {}
    exam_data = _serialize(exam)

    exam_status = _normalize_status(
        exam.get("status")
        or exam.get("examstatus")
    )

    exam_data["status"] = exam_status
    exam_data["examstatus"] = exam_status
    exam_data["exam_status"] = exam_status

    exam_id = (
        exam.get("exam_id")
        or exam.get("examid")
    )

    examiner_id = (
        exam.get("examiner_id")
        or exam.get("examinerid")
    )

    exam_data["examid"] = exam_id
    exam_data["exam_id"] = exam_id
    exam_data["examinerid"] = examiner_id
    exam_data["examiner_id"] = examiner_id

    exam_data["name"] = (
        exam.get("name")
        or exam.get("examname")
        or ""
    )

    exam_data["description"] = (
        exam.get("description")
        or exam.get("examdescription")
        or ""
    )

    exam_data["date"] = (
        exam.get("date")
        or exam.get("examdate")
        or ""
    )

    exam_data["starttime"] = (
        exam.get("starttime")
        or exam.get("start_time")
        or exam.get("examstarttime")
        or ""
    )

    exam_data["endtime"] = (
        exam.get("endtime")
        or exam.get("end_time")
        or exam.get("examendtime")
        or ""
    )
    exam_type = str(
        exam.get("examtype")
        or exam.get("exam_type")
        or "SINGLE_SESSION"
    ).upper()
    timeframes = (
        exam.get("timeframes")
        or exam.get("flexibleintervals")
        or exam.get("flexible_intervals")
        or []
    )
    exam_data["examtype"] = exam_type
    exam_data["exam_type"] = exam_type
    exam_data["isflexible"] = exam_type == "MULTI_SESSION"
    exam_data["is_flexible"] = exam_type == "MULTI_SESSION"
    exam_data["timeframes"] = timeframes
    exam_data["flexibleintervals"] = timeframes
    exam_data["flexible_intervals"] = timeframes
    session_number = int(exam.get("sessionnumber", exam.get("session_number", 0)) or 0)
    permanently_stopped = bool(exam.get("permanentlystopped", exam.get("permanently_stopped", False)))
    exam_data["sessionnumber"] = session_number
    exam_data["session_number"] = session_number
    exam_data["permanentlystopped"] = permanently_stopped
    exam_data["permanently_stopped"] = permanently_stopped

    exam_data["durationminutes"] = exam.get(
        "durationminutes",
        exam.get("duration_minutes", 0),
    )

    exam_data["violationthreshold"] = exam.get(
        "violationthreshold",
        exam.get("violation_threshold", 10),
    )

    exam_data["instructions"] = (
        exam.get("instructions")
        or ""
    )

    exam_data["allowedwebsites"] = (
        exam.get(
            "allowedwebsites",
            exam.get("allowed_websites", []),
        )
        or []
    )

    exam_data["allowedapplications"] = (
        exam.get(
            "allowedapplications",
            exam.get("allowed_applications", []),
        )
        or []
    )

    return exam_data


def _assessment_payload(
    assessment: dict,
) -> dict:
    assessment = assessment or {}
    assessment_data = _serialize(assessment)

    assessment_status = _normalize_status(
        assessment.get("status")
        or assessment.get("assessmentstatus")
        or assessment.get("assessment_status")
    )

    final_status = _normalize_status(
        assessment.get("final_status")
        or assessment.get("finalstatus")
    )

    assessment_data["status"] = assessment_status
    assessment_data["assessmentstatus"] = (
        assessment_status
    )
    assessment_data["assessment_status"] = (
        assessment_status
    )

    assessment_data["finalstatus"] = final_status
    assessment_data["final_status"] = final_status

    assessment_id = (
        assessment.get("assessment_id")
        or assessment.get("assessmentid")
    )

    exam_id = (
        assessment.get("exam_id")
        or assessment.get("examid")
    )

    candidate_id = (
        assessment.get("candidate_id")
        or assessment.get("candidateid")
    )

    examiner_id = (
        assessment.get("examiner_id")
        or assessment.get("examinerid")
    )

    assessment_data["assessmentid"] = (
        assessment_id
    )
    assessment_data["assessment_id"] = (
        assessment_id
    )

    assessment_data["examid"] = exam_id
    assessment_data["exam_id"] = exam_id

    assessment_data["candidateid"] = candidate_id
    assessment_data["candidate_id"] = candidate_id

    assessment_data["examinerid"] = examiner_id
    assessment_data["examiner_id"] = examiner_id

    assessment_data["allowedwebsites"] = (
        assessment.get(
            "allowedwebsites",
            assessment.get("allowed_websites", []),
        )
        or []
    )

    assessment_data["allowedapplications"] = (
        assessment.get(
            "allowedapplications",
            assessment.get(
                "allowed_applications",
                [],
            ),
        )
        or []
    )

    rejection_reason = (
        assessment.get("rejectionreason")
        or assessment.get("rejection_reason")
        or assessment.get("lastrequestreviewreason")
        or assessment.get("last_request_review_reason")
        or ""
    )
    last_request_status = (
        assessment.get("lastrequeststatus")
        or assessment.get("last_request_status")
        or ""
    )
    assessment_data["rejectionreason"] = rejection_reason
    assessment_data["rejection_reason"] = rejection_reason
    assessment_data["lastrequestreviewreason"] = rejection_reason
    assessment_data["last_request_review_reason"] = rejection_reason
    assessment_data["lastrequeststatus"] = last_request_status
    assessment_data["last_request_status"] = last_request_status
    return assessment_data


def _merge_exam_assessment(
    exam: dict,
    assessment: dict,
) -> dict:
    exam_data = _exam_payload(exam)
    assessment_data = _assessment_payload(
        assessment
    )

    return {
        **exam_data,
        **assessment_data,
        "examid": exam_data.get("examid"),
        "exam_id": exam_data.get("exam_id"),
        "assessmentid": assessment_data.get(
            "assessmentid"
        ),
        "assessment_id": assessment_data.get(
            "assessment_id"
        ),
        "candidateid": assessment_data.get(
            "candidateid"
        ),
        "candidate_id": assessment_data.get(
            "candidate_id"
        ),
        "examinerid": (
            assessment_data.get("examinerid")
            or exam_data.get("examinerid")
        ),
        "examiner_id": (
            assessment_data.get("examiner_id")
            or exam_data.get("examiner_id")
        ),
        "name": exam_data.get("name"),
        "description": exam_data.get(
            "description",
            "",
        ),
        "date": exam_data.get("date"),
        "starttime": exam_data.get("starttime"),
        "endtime": exam_data.get("endtime"),
        "durationminutes": exam_data.get(
            "durationminutes",
            0,
        ),
        "allowedwebsites": (
            assessment_data.get("allowedwebsites")
            or exam_data.get("allowedwebsites")
            or []
        ),
        "allowedapplications": (
            assessment_data.get(
                "allowedapplications"
            )
            or exam_data.get(
                "allowedapplications"
            )
            or []
        ),
        "examstatus": exam_data.get(
            "examstatus",
            "",
        ),
        "exam_status": exam_data.get(
            "exam_status",
            "",
        ),
        "examtype": exam_data.get("examtype", "SINGLE_SESSION"),
        "exam_type": exam_data.get("exam_type", "SINGLE_SESSION"),
        "isflexible": exam_data.get("isflexible", False),
        "is_flexible": exam_data.get("is_flexible", False),
        "timeframes": exam_data.get("timeframes", []),
        "flexibleintervals": exam_data.get("flexibleintervals", []),
        "flexible_intervals": exam_data.get("flexible_intervals", []),
        "sessionnumber": exam_data.get("sessionnumber", 0),
        "session_number": exam_data.get("session_number", 0),
        "permanentlystopped": exam_data.get("permanentlystopped", False),
        "permanently_stopped": exam_data.get("permanently_stopped", False),
        "assessmentstatus": assessment_data.get(
            "assessmentstatus",
            "",
        ),
        "assessment_status": assessment_data.get(
            "assessment_status",
            "",
        ),
        "finalstatus": assessment_data.get(
            "finalstatus",
            "",
        ),
        "final_status": assessment_data.get(
            "final_status",
            "",
        ),
        "status": assessment_data.get(
            "assessmentstatus",
            "",
        ),
    }


async def _ensure_exam_access(
    db,
    exam_id: str,
    current_user: dict,
):
    exam = await db.exams.find_one(
        _get_exam_query(exam_id)
    )

    if not exam:
        raise HTTPException(
            status_code=404,
            detail="Exam not found",
        )

    current_user_id = (
        current_user.get("user_id")
        or current_user.get("userid")
    )

    examiner_id = (
        exam.get("examiner_id")
        or exam.get("examinerid")
    )

    if (
        current_user.get("role") == "Examiner"
        and str(examiner_id)
        != str(current_user_id)
    ):
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    return exam


@router.post("")
async def create_exam(
    body: dict,
    current_user=Depends(
        require_role("Examiner", "Admin")
    ),
):
    db = get_db()

    examiner_id = (
        current_user.get("user_id")
        or current_user.get("userid")
    )

    name = str(
        body.get("name")
        or ""
    ).strip()

    description = str(
        body.get("description")
        or ""
    ).strip()

    date = str(
        body.get("date")
        or ""
    ).strip()

    start_time = str(
        body.get("start_time")
        or body.get("starttime")
        or ""
    ).strip()

    end_time = str(
        body.get("end_time")
        or body.get("endtime")
        or ""
    ).strip()

    instructions = str(
        body.get("instructions")
        or ""
    ).strip()
    schedule = prepare_exam_schedule(body)
    date = schedule["date"]
    start_time = schedule["start_time"]
    end_time = schedule["end_time"]

    duration_minutes = body.get(
        "duration_minutes",
        body.get("durationminutes"),
    )

    violation_threshold = body.get(
        "violation_threshold",
        body.get("violationthreshold", 10),
    )

    allowed_websites = _clean_list(
        body.get(
            "allowed_websites",
            body.get("allowedwebsites", []),
        )
    )

    allowed_applications = _clean_list(
        body.get(
            "allowed_applications",
            body.get("allowedapplications", []),
        )
    )

    status = _normalize_status(
        body.get("status"),
        "DRAFT",
    )

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Exam name is required",
        )


    if duration_minutes is None:
        raise HTTPException(
            status_code=400,
            detail="duration_minutes is required",
        )

    now = datetime.utcnow()

    exam_id = (
        f"EXM-{uuid.uuid4().hex[:8].upper()}"
    )

    exam_doc = {
        "exam_id": exam_id,
        "examid": exam_id,
        "name": name,
        "description": description,
        "examiner_id": examiner_id,
        "examinerid": examiner_id,
        "date": date,
        "start_time": start_time,
        "starttime": start_time,
        "end_time": end_time,
        "endtime": end_time,
        "exam_type": schedule["exam_type"],
        "examtype": schedule["examtype"],
        "is_flexible": schedule["is_flexible"],
        "isflexible": schedule["isflexible"],
        "timeframes": schedule["timeframes"],
        "flexible_intervals": schedule["flexible_intervals"],
        "flexibleintervals": schedule["flexibleintervals"],
        "duration_minutes": int(
            duration_minutes
        ),
        "durationminutes": int(
            duration_minutes
        ),
        "violation_threshold": int(
            violation_threshold
        ),
        "violationthreshold": int(
            violation_threshold
        ),
        "allowed_websites": allowed_websites,
        "allowedwebsites": allowed_websites,
        "allowed_applications": (
            allowed_applications
        ),
        "allowedapplications": (
            allowed_applications
        ),
        "instructions": instructions,
        "status": status,
        "examstatus": status,
        "sessionnumber": 0,
        "session_number": 0,
        "permanentlystopped": False,
        "permanently_stopped": False,
        "created_at": now,
        "createdat": now,
        "updated_at": now,
        "updatedat": now,
    }

    await db.exams.insert_one(exam_doc)

    await db.audit_logs.insert_one(
        {
            "log_id": (
                f"AUD-{uuid.uuid4().hex[:8].upper()}"
            ),
            "user_id": examiner_id,
            "userid": examiner_id,
            "exam_id": exam_id,
            "examid": exam_id,
            "action": "CreateExam",
            "reason": f"Created exam {name}",
            "timestamp": now,
        }
    )

    payload = _exam_payload(exam_doc)
    await emit_exam_event("exam_created", payload, examiner_id)
    return payload


@router.get("")
async def get_my_exams(
    current_user=Depends(
        require_role("Examiner", "Admin")
    ),
):
    db = get_db()

    if current_user.get("role") == "Admin":
        exams = (
            await db.exams.find({})
            .sort("created_at", -1)
            .to_list(None)
        )
    else:
        current_user_id = (
            current_user.get("user_id")
            or current_user.get("userid")
        )

        exams = (
            await db.exams.find(
                {
                    "$or": [
                        {
                            "examiner_id":
                                current_user_id
                        },
                        {
                            "examinerid":
                                current_user_id
                        },
                    ]
                }
            )
            .sort("created_at", -1)
            .to_list(None)
        )

    return [
        _exam_payload(exam)
        for exam in exams
    ]


@router.get("/candidate/upcoming")
async def get_candidate_upcoming(
    current_user=Depends(
        require_role("Candidate")
    ),
):
    db = get_db()

    current_user_id = (
        current_user.get("user_id")
        or current_user.get("userid")
    )

    assessments = (
        await db.assessments.find(
            {
                "$or": [
                    {
                        "candidate_id":
                            current_user_id
                    },
                    {
                        "candidateid":
                            current_user_id
                    },
                ]
            }
        )
        .sort("created_at", -1)
        .to_list(None)
    )

    result = []

    for assessment in assessments:
        exam_id = (
            assessment.get("exam_id")
            or assessment.get("examid")
        )

        if not exam_id:
            continue

        exam = await db.exams.find_one(
            _get_exam_query(exam_id)
        )

        if not exam:
            continue

        merged = _merge_exam_assessment(
            exam,
            assessment,
        )
        latest_rejected_request = await db.requests.find_one(
            {
                "$and": [
                    {
                        "$or": [
                            {"assessmentid": merged.get("assessmentid")},
                            {"assessment_id": merged.get("assessment_id")},
                        ]
                    },
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
            merged.update(
                {
                    "lastrequeststatus": "REJECTED",
                    "last_request_status": "REJECTED",
                    "lastrequestreviewreason": rejection_reason,
                    "last_request_review_reason": rejection_reason,
                    "rejectionreason": rejection_reason,
                    "rejection_reason": rejection_reason,
                }
            )
        result.append(merged)

    return result


@router.get("/{exam_id}")
async def get_exam(
    exam_id: str,
    current_user=Depends(
        require_role(
            "Examiner",
            "Admin",
            "Candidate",
        )
    ),
):
    db = get_db()

    exam = await db.exams.find_one(
        _get_exam_query(exam_id)
    )

    if not exam:
        raise HTTPException(
            status_code=404,
            detail="Exam not found",
        )

    current_user_id = (
        current_user.get("user_id")
        or current_user.get("userid")
    )

    examiner_id = (
        exam.get("examiner_id")
        or exam.get("examinerid")
    )

    if (
        current_user.get("role") == "Examiner"
        and str(examiner_id)
        != str(current_user_id)
    ):
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    if current_user.get("role") == "Candidate":
        assignment = (
            await db.assessments.find_one(
                _get_assessment_query(
                    exam_id,
                    current_user_id,
                )
            )
        )

        if not assignment:
            raise HTTPException(
                status_code=403,
                detail="Access denied",
            )

    return _exam_payload(exam)


@router.patch("/{exam_id}/start")
async def start_exam(
    exam_id: str,
    current_user=Depends(require_role("Examiner", "Admin")),
):
    db = get_db()
    current_user_id = current_user.get("user_id") or current_user.get("userid")
    exam = await _ensure_exam_access(db, exam_id, current_user)
    status = _normalize_status(exam.get("status") or exam.get("examstatus"))
    multi_session = is_multi_session_exam(exam)
    if status == "STOPPED" or bool(exam.get("permanentlystopped", exam.get("permanently_stopped", False))):
        raise HTTPException(status_code=400, detail="This exam was permanently stopped and cannot be started again")
    if status == "RUNNING":
        raise HTTPException(status_code=400, detail="The exam is already running")
    if status == "COMPLETED" and not multi_session:
        raise HTTPException(status_code=400, detail="A completed single-session exam cannot be restarted")
    if status not in {"DRAFT", "PUBLISHED", "SCHEDULED", "COMPLETED"}:
        raise HTTPException(status_code=400, detail=f"Exam cannot be started while status is {status}")
    current_session = int(exam.get("sessionnumber", exam.get("session_number", 0)) or 0)
    next_session = current_session + 1 if multi_session else 1
    now = datetime.utcnow()
    await db.exams.update_one(
        _get_exam_query(exam_id),
        {"$set": {
            "status": "RUNNING", "examstatus": "RUNNING",
            "sessionnumber": next_session, "session_number": next_session,
            "started_at": now, "startedat": now, "updated_at": now, "updatedat": now,
        }},
    )
    if multi_session:
        await db.assessments.update_many(
            {
                "$and": [
                    {"$or": [{"exam_id": exam_id}, {"examid": exam_id}]},
                    {"isfinalized": {"$ne": True}},
                    {"is_finalized": {"$ne": True}},
                    {"finalstatus": {"$nin": ["COMPLETED", "TERMINATED", "LOCKED"]}},
                    {"final_status": {"$nin": ["COMPLETED", "TERMINATED", "LOCKED"]}},
                ]
            },
            {"$set": {
                # Preserve READY status and the valid waiting-session token. A candidate
                # already in WaitScreen must use that token when the examiner starts.
                "requiresreentryapproval": False, "requires_reentry_approval": False,
                "reentryapprovalconsumed": False, "reentry_approval_consumed": False,
                "activesessionid": None, "active_session_id": None,
                "lastheartbeatat": None, "last_heartbeat_at": None,
                "enteredexamsession": None, "entered_exam_session": None,
                "updatedat": now, "updated_at": now,
            }}
        )
    await db.audit_logs.insert_one({
        "log_id": f"AUD-{uuid.uuid4().hex[:8].upper()}",
        "user_id": current_user_id, "userid": current_user_id,
        "exam_id": exam_id, "examid": exam_id,
        "action": "StartNextSession" if multi_session and current_session else "StartExam",
        "reason": "Multi-session exam session started" if multi_session else "Exam manually started",
        "timestamp": now,
    })
    updated_exam = await db.exams.find_one(_get_exam_query(exam_id))
    payload = _exam_payload(updated_exam)
    await emit_exam_event("exam_started", payload)
    await emit_exam_event("exam_updated", payload)
    return {"message": "Exam started", "exam": payload, **payload}

@router.patch("/{exam_id}/end")
async def end_exam(exam_id: str, current_user=Depends(require_role("Examiner", "Admin"))):
    db = get_db()
    current_user_id = current_user.get("user_id") or current_user.get("userid")
    exam = await _ensure_exam_access(db, exam_id, current_user)
    status = _normalize_status(exam.get("status") or exam.get("examstatus"))
    if status != "RUNNING":
        raise HTTPException(status_code=400, detail="Only a running exam can be ended")
    multi_session = is_multi_session_exam(exam)
    session_number = int(exam.get("sessionnumber", exam.get("session_number", 0)) or 0)
    now = datetime.utcnow()
    await db.exams.update_one(_get_exam_query(exam_id), {"$set": {
        "status": "COMPLETED", "examstatus": "COMPLETED",
        "ended_at": now, "endedat": now, "updated_at": now, "updatedat": now,
    }})
    assessments = await db.assessments.find({"$or": [{"exam_id": exam_id}, {"examid": exam_id}]}).to_list(None)
    for assessment in assessments:
        if multi_session and not participated_in_current_session(assessment, session_number):
            continue
        if is_assessment_finalized(assessment):
            continue
        await db.assessments.update_one({"_id": assessment["_id"]}, {"$set": {
            "status": "TERMINATED", "assessmentstatus": "TERMINATED", "assessment_status": "TERMINATED",
            "final_status": "TERMINATED", "finalstatus": "TERMINATED",
            "isfinalized": True, "is_finalized": True,
            "finalizedreason": "EXAM_ENDED", "finalized_reason": "EXAM_ENDED",
            "finalizedat": now, "finalized_at": now,
            "activesessionid": None, "active_session_id": None,
            "waitingsessionid": None, "waiting_session_id": None,
            "exit_time": now, "exittime": now, "updated_at": now, "updatedat": now,
        }})
    await db.audit_logs.insert_one({
        "log_id": f"AUD-{uuid.uuid4().hex[:8].upper()}", "user_id": current_user_id, "userid": current_user_id,
        "exam_id": exam_id, "examid": exam_id, "action": "EndSession" if multi_session else "EndExam",
        "reason": "Current multi-session run ended" if multi_session else "Exam manually ended", "timestamp": now,
    })
    updated_exam = await db.exams.find_one(_get_exam_query(exam_id))
    payload = _exam_payload(updated_exam)
    await emit_exam_event("exam_updated", payload)
    updated_assessments = await db.assessments.find({"$or": [{"exam_id": exam_id}, {"examid": exam_id}]}).to_list(None)
    for item in updated_assessments:
        await emit_assessment_event("assessment_updated", _assessment_payload(item))
    return {"message": "Current session ended" if multi_session else "Exam ended", "exam": payload, **payload}

@router.patch("/{exam_id}/stop")
async def stop_exam(exam_id: str, current_user=Depends(require_role("Examiner", "Admin"))):
    db = get_db()
    current_user_id = current_user.get("user_id") or current_user.get("userid")
    exam = await _ensure_exam_access(db, exam_id, current_user)
    if not is_multi_session_exam(exam):
        raise HTTPException(status_code=400, detail="Only a multi-session exam can be permanently stopped")
    status = _normalize_status(exam.get("status") or exam.get("examstatus"))
    if bool(exam.get("permanentlystopped", exam.get("permanently_stopped", False))):
        raise HTTPException(status_code=400, detail="This exam is already permanently completed")
    now = datetime.utcnow()
    await db.exams.update_one(_get_exam_query(exam_id), {"$set": {
        "status": "COMPLETED", "examstatus": "COMPLETED",
        "permanentlystopped": True, "permanently_stopped": True,
        "stoppedat": now, "stopped_at": now, "updatedat": now, "updated_at": now,
    }})
    await db.audit_logs.insert_one({
        "log_id": f"AUD-{uuid.uuid4().hex[:8].upper()}", "user_id": current_user_id, "userid": current_user_id,
        "exam_id": exam_id, "examid": exam_id, "action": "StopExam",
        "reason": "Multi-session exam permanently stopped", "timestamp": now,
    })
    updated_exam = await db.exams.find_one(_get_exam_query(exam_id))
    payload = _exam_payload(updated_exam)
    await emit_exam_event("exam_updated", payload)
    return {"message": "Exam completed permanently", "exam": payload, **payload}

@router.get("/{exam_id}/assessments")
async def get_exam_assessments(
    exam_id: str,
    current_user=Depends(
        require_role("Examiner", "Admin")
    ),
):
    db = get_db()

    await _ensure_exam_access(
        db,
        exam_id,
        current_user,
    )

    assessments = await db.assessments.find(
        {
            "$or": [
                {"exam_id": exam_id},
                {"examid": exam_id},
            ]
        }
    ).to_list(None)

    result = []

    for assessment in assessments:
        candidate_id = (
            assessment.get("candidate_id")
            or assessment.get("candidateid")
        )

        user = await db.users.find_one(
            _get_user_query(candidate_id)
        )

        assessment_status = _normalize_status(
            assessment.get("status")
            or assessment.get(
                "assessmentstatus"
            ),
            "ASSIGNED",
        )

        result.append(
            {
                "assessment_id": (
                    assessment.get(
                        "assessment_id"
                    )
                    or assessment.get(
                        "assessmentid"
                    )
                ),
                "assessmentid": (
                    assessment.get(
                        "assessment_id"
                    )
                    or assessment.get(
                        "assessmentid"
                    )
                ),
                "candidate_id": candidate_id,
                "candidateid": candidate_id,
                "candidate_name": (
                    user.get("name")
                    if user
                    else candidate_id
                ),
                "candidate_email": (
                    user.get("email")
                    if user
                    else ""
                ),
                "status": assessment_status,
                "assessmentstatus": (
                    assessment_status
                ),
                "violation_count": (
                    assessment.get(
                        "violation_count",
                        assessment.get(
                            "violationcount",
                            0,
                        ),
                    )
                ),
                "risk_score": (
                    assessment.get(
                        "risk_score",
                        assessment.get(
                            "riskscore",
                            0,
                        ),
                    )
                ),
                "credibility_score": (
                    assessment.get(
                        "credibility_score",
                        assessment.get(
                            "credibilityscore",
                            100,
                        ),
                    )
                ),
                "warning_count": (
                    assessment.get(
                        "warning_count",
                        assessment.get(
                            "warningcount",
                            0,
                        ),
                    )
                ),
                "attendance_status": (
                    assessment.get(
                        "attendance_status",
                        assessment.get(
                            "attendancestatus",
                            "",
                        ),
                    )
                ),
            }
        )

    return result


@router.delete("/{exam_id}/assign/{candidate_id}")
async def unassign_candidate(
    exam_id: str,
    candidate_id: str,
    current_user=Depends(
        require_role("Examiner", "Admin")
    ),
):
    db = get_db()

    exam_id = str(exam_id or "").strip()
    candidate_id = str(
        candidate_id or ""
    ).strip()

    if not exam_id:
        raise HTTPException(
            status_code=400,
            detail="exam_id is required",
        )

    if not candidate_id:
        raise HTTPException(
            status_code=400,
            detail="candidate_id is required",
        )

    exam = await _ensure_exam_access(
        db,
        exam_id,
        current_user,
    )

    candidate = await db.users.find_one(
        _get_user_query(candidate_id)
    )

    assessment = (
        await db.assessments.find_one(
            _get_assessment_query(
                exam_id,
                candidate_id,
            )
        )
    )

    if not assessment:
        raise HTTPException(
            status_code=404,
            detail=(
                "Candidate assignment was not found."
            ),
        )

    assessment_id = (
        assessment.get("assessment_id")
        or assessment.get("assessmentid")
    )

    result = (
        await db.assessments.delete_one(
            {
                "_id": assessment["_id"],
            }
        )
    )

    if result.deleted_count != 1:
        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to remove candidate assignment."
            ),
        )

    current_user_id = (
        current_user.get("user_id")
        or current_user.get("userid")
    )

    now = datetime.utcnow()

    await db.audit_logs.insert_one(
        {
            "log_id": (
                f"AUD-"
                f"{uuid.uuid4().hex[:8].upper()}"
            ),
            "user_id": current_user_id,
            "userid": current_user_id,
            "exam_id": exam_id,
            "examid": exam_id,
            "assessment_id": assessment_id,
            "assessmentid": assessment_id,
            "candidate_id": candidate_id,
            "candidateid": candidate_id,
            "action": "UnassignCandidate",
            "reason": (
                f"Removed candidate "
                f"{candidate_id} from exam "
                f"{exam_id}"
            ),
            "timestamp": now,
        }
    )

    email_sent = False
    email_error = None
    candidate_email = (candidate or {}).get("email", "")
    if candidate_email:
        try:
            await send_exam_removal_email(
                candidate_email=candidate_email,
                candidate_name=(candidate or {}).get("name", candidate_id),
                exam=exam,
            )
            email_sent = True
        except Exception as exc:
            email_error = str(exc)
            logger.exception("Removal email failed for candidate %s and exam %s", candidate_id, exam_id)
    else:
        email_error = "Candidate email address is unavailable"
        logger.warning("No email available for removed candidate %s", candidate_id)

    removed_payload = _assessment_payload(assessment)
    await emit_assessment_event("assessment_removed", removed_payload)
    return {
        "email_sent": email_sent,
        "email_error": email_error,
        "message": (
            "Candidate removed successfully."
        ),
        "exam_id": exam_id,
        "examid": exam_id,
        "candidate_id": candidate_id,
        "candidateid": candidate_id,
        "assessment_id": assessment_id,
        "assessmentid": assessment_id,
    }


@router.post("/{exam_id}/remove-candidates")
async def remove_candidates_bulk(
    exam_id: str,
    body: dict,
    current_user=Depends(
        require_role("Examiner", "Admin")
    ),
):
    """Remove multiple candidate assignments using the existing safe removal flow."""
    raw_candidate_ids = (
        body.get("candidate_ids")
        or body.get("candidateids")
        or []
    )
    if not isinstance(raw_candidate_ids, list):
        raise HTTPException(
            status_code=400,
            detail="candidate_ids must be an array",
        )

    candidate_ids = []
    seen = set()
    for value in raw_candidate_ids:
        candidate_id = str(value or "").strip()
        if candidate_id and candidate_id not in seen:
            seen.add(candidate_id)
            candidate_ids.append(candidate_id)

    if not candidate_ids:
        raise HTTPException(
            status_code=400,
            detail="Select at least one assigned candidate to remove.",
        )

    # Reuse the individual endpoint so access checks, audit logs, events,
    # assignment cleanup, and removal emails remain identical.
    results = await asyncio.gather(
        *[
            unassign_candidate(
                exam_id=exam_id,
                candidate_id=candidate_id,
                current_user=current_user,
            )
            for candidate_id in candidate_ids
        ],
        return_exceptions=True,
    )

    removed = []
    failed = []
    email_failures = []
    for candidate_id, result in zip(candidate_ids, results):
        if isinstance(result, Exception):
            detail = (
                result.detail
                if isinstance(result, HTTPException)
                else str(result)
            )
            failed.append({
                "candidate_id": candidate_id,
                "error": detail,
            })
            continue

        removed.append(candidate_id)
        if not result.get("email_sent", False):
            email_failures.append({
                "candidate_id": candidate_id,
                "error": result.get("email_error")
                or "Removal email was not sent",
            })

    if not removed and failed:
        raise HTTPException(
            status_code=400,
            detail="No selected candidate assignments could be removed.",
        )

    return {
        "message": f"{len(removed)} candidate(s) removed successfully.",
        "removed_candidate_ids": removed,
        "failed": failed,
        "email_failures": email_failures,
    }


@router.post("/{exam_id}/assign-candidates")
async def assign_candidates_bulk(
    exam_id: str,
    body: dict,
    current_user=Depends(
        require_role("Examiner", "Admin")
    ),
):
    """Assign multiple unique candidates in one request, up to the exam limit."""
    db = get_db()
    exam = await _ensure_exam_access(db, exam_id, current_user)
    current_user_id = (
        current_user.get("user_id")
        or current_user.get("userid")
    )

    raw_candidate_ids = (
        body.get("candidate_ids")
        or body.get("candidateids")
        or body.get("candidate_ids")
        or []
    )
    if not isinstance(raw_candidate_ids, list):
        raise HTTPException(
            status_code=400,
            detail="candidate_ids must be an array",
        )

    candidate_ids = []
    seen = set()
    for value in raw_candidate_ids:
        candidate_id = str(value or "").strip()
        if candidate_id and candidate_id not in seen:
            seen.add(candidate_id)
            candidate_ids.append(candidate_id)

    if not candidate_ids:
        raise HTTPException(
            status_code=400,
            detail="Select at least one candidate to assign.",
        )

    assigned_documents = await db.assessments.find(
        {"$or": [{"exam_id": exam_id}, {"examid": exam_id}]},
        {"_id": 0, "candidate_id": 1, "candidateid": 1},
    ).to_list(None)
    assigned_ids = {
        str(item.get("candidate_id") or item.get("candidateid") or "").strip()
        for item in assigned_documents
    }
    assigned_ids.discard("")

    new_candidate_ids = [
        candidate_id
        for candidate_id in candidate_ids
        if candidate_id not in assigned_ids
    ]
    skipped_ids = [
        candidate_id
        for candidate_id in candidate_ids
        if candidate_id in assigned_ids
    ]

    if len(assigned_ids) + len(new_candidate_ids) > MAX_CANDIDATES_PER_EXAM:
        available_slots = max(0, MAX_CANDIDATES_PER_EXAM - len(assigned_ids))
        raise HTTPException(
            status_code=409,
            detail=(
                f"Only {available_slots} assignment slot(s) remain. "
                f"A maximum of {MAX_CANDIDATES_PER_EXAM} candidates "
                "can be assigned to an exam."
            ),
        )

    users = []
    invalid_ids = []
    for candidate_id in new_candidate_ids:
        user = await db.users.find_one(_get_user_query(candidate_id))
        if not user or user.get("role") != "Candidate":
            invalid_ids.append(candidate_id)
        else:
            users.append((candidate_id, user))

    if invalid_ids:
        raise HTTPException(
            status_code=404,
            detail=(
                "Candidate record not found for: "
                + ", ".join(invalid_ids)
            ),
        )

    if not users:
        return {
            "message": "All selected candidates are already assigned.",
            "assigned": [],
            "skipped_candidate_ids": skipped_ids,
            "email_failures": [],
        }

    now = datetime.utcnow()
    assessment_documents = []
    audit_documents = []
    hydrated_payloads = []

    for candidate_id, user in users:
        assessment_id = await generate_assessment_id()
        assessment_document = {
            "assessment_id": assessment_id,
            "assessmentid": assessment_id,
            "exam_id": exam_id,
            "examid": exam_id,
            "candidate_id": candidate_id,
            "candidateid": candidate_id,
            "examiner_id": current_user_id,
            "examinerid": current_user_id,
            "status": "ASSIGNED",
            "assessmentstatus": "ASSIGNED",
            "assessment_status": "ASSIGNED",
            "violation_count": 0,
            "violationcount": 0,
            "warning_count": 0,
            "warningcount": 0,
            "risk_score": 0,
            "riskscore": 0,
            "credibility_score": 100,
            "credibilityscore": 100,
            "integrity_score": 100,
            "integrityscore": 100,
            "attendance_status": None,
            "attendancestatus": None,
            "join_time": None,
            "jointime": None,
            "active_time": None,
            "activetime": None,
            "exit_time": None,
            "exittime": None,
            "threshold_reached": False,
            "thresholdreached": False,
            "re_entry_count": 0,
            "reentrycount": 0,
            "final_status": None,
            "finalstatus": None,
            "isfinalized": False,
            "is_finalized": False,
            "enteredexamsession": None,
            "entered_exam_session": None,
            "created_at": now,
            "createdat": now,
            "updated_at": now,
            "updatedat": now,
        }
        assessment_documents.append(assessment_document)
        audit_documents.append({
            "log_id": f"AUD-{uuid.uuid4().hex[:8].upper()}",
            "user_id": current_user_id,
            "userid": current_user_id,
            "exam_id": exam_id,
            "examid": exam_id,
            "assessment_id": assessment_id,
            "assessmentid": assessment_id,
            "candidate_id": candidate_id,
            "candidateid": candidate_id,
            "action": "AssignCandidate",
            "reason": f"Bulk assigned candidate {candidate_id}",
            "timestamp": now,
        })
        payload = _merge_exam_assessment(exam or {}, assessment_document)
        payload["candidate_name"] = user.get("name", candidate_id)
        payload["candidate_email"] = user.get("email", "")
        hydrated_payloads.append(payload)

    await db.assessments.insert_many(assessment_documents)
    if audit_documents:
        await db.audit_logs.insert_many(audit_documents)

    await asyncio.gather(*[
        emit_assessment_event("assessment_created", payload)
        for payload in hydrated_payloads
    ])

    async def send_assignment_email(candidate_id, user):
        candidate_email = user.get("email", "")
        if not candidate_email:
            return {
                "candidate_id": candidate_id,
                "error": "Candidate email address is unavailable",
            }
        try:
            await send_exam_assignment_email(
                candidate_email=candidate_email,
                candidate_name=user.get("name", candidate_id),
                exam=exam,
            )
            return None
        except Exception as exc:
            logger.exception(
                "Bulk assignment email failed for candidate %s and exam %s",
                candidate_id,
                exam_id,
            )
            return {"candidate_id": candidate_id, "error": str(exc)}

    email_results = await asyncio.gather(*[
        send_assignment_email(candidate_id, user)
        for candidate_id, user in users
    ])
    email_failures = [item for item in email_results if item]

    return {
        "message": f"{len(hydrated_payloads)} candidate(s) assigned successfully.",
        "assigned": hydrated_payloads,
        "assigned_candidate_ids": [item[0] for item in users],
        "skipped_candidate_ids": skipped_ids,
        "email_failures": email_failures,
    }


@router.post("/{exam_id}/assign")
async def assign_candidate(
    exam_id: str,
    body: dict,
    current_user=Depends(
        require_role("Examiner", "Admin")
    ),
):
    db = get_db()

    exam = await _ensure_exam_access(
        db,
        exam_id,
        current_user,
    )

    current_user_id = (
        current_user.get("user_id")
        or current_user.get("userid")
    )

    candidate_id = str(
        body.get("candidate_id")
        or body.get("candidateid")
        or ""
    ).strip()

    if not candidate_id:
        raise HTTPException(
            status_code=400,
            detail="candidate_id is required",
        )

    user = await db.users.find_one(
        _get_user_query(candidate_id)
    )

    if (
        not user
        or user.get("role") != "Candidate"
    ):
        raise HTTPException(
            status_code=404,
            detail="Candidate not found",
        )

    existing = (
        await db.assessments.find_one(
            _get_assessment_query(
                exam_id,
                candidate_id,
            )
        )
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Candidate already assigned",
        )

    assigned_documents = await db.assessments.find(
        {
            "$or": [
                {"exam_id": exam_id},
                {"examid": exam_id},
            ]
        },
        {
            "_id": 0,
            "candidate_id": 1,
            "candidateid": 1,
        },
    ).to_list(None)
    assigned_candidate_ids = {
        str(
            item.get("candidate_id")
            or item.get("candidateid")
            or ""
        ).strip()
        for item in assigned_documents
    }
    assigned_candidate_ids.discard("")

    if len(assigned_candidate_ids) >= MAX_CANDIDATES_PER_EXAM:
        raise HTTPException(
            status_code=409,
            detail=(
                f"A maximum of {MAX_CANDIDATES_PER_EXAM} "
                "candidates can be assigned to an exam."
            ),
        )

    assessment_id = (
        await generate_assessment_id()
    )

    now = datetime.utcnow()

    assessment_document = {
        "assessment_id": assessment_id,
        "assessmentid": assessment_id,
        "exam_id": exam_id,
        "examid": exam_id,
        "candidate_id": candidate_id,
        "candidateid": candidate_id,
        "examiner_id": current_user_id,
        "examinerid": current_user_id,
        "status": "ASSIGNED",
        "assessmentstatus": "ASSIGNED",
        "assessment_status": "ASSIGNED",
        "violation_count": 0,
        "violationcount": 0,
        "warning_count": 0,
        "warningcount": 0,
        "risk_score": 0,
        "riskscore": 0,
        "credibility_score": 100,
        "credibilityscore": 100,
        "integrity_score": 100,
        "integrityscore": 100,
        "attendance_status": None,
        "attendancestatus": None,
        "join_time": None,
        "jointime": None,
        "active_time": None,
        "activetime": None,
        "exit_time": None,
        "exittime": None,
        "threshold_reached": False,
        "thresholdreached": False,
        "re_entry_count": 0,
        "reentrycount": 0,
        "final_status": None,
        "finalstatus": None,
        "isfinalized": False,
        "is_finalized": False,
        "enteredexamsession": None,
        "entered_exam_session": None,
        "created_at": now,
        "createdat": now,
        "updated_at": now,
        "updatedat": now,
    }

    await db.assessments.insert_one(
        assessment_document
    )

    await db.audit_logs.insert_one(
        {
            "log_id": (
                f"AUD-{uuid.uuid4().hex[:8].upper()}"
            ),
            "user_id": current_user_id,
            "userid": current_user_id,
            "exam_id": exam_id,
            "examid": exam_id,
            "assessment_id": assessment_id,
            "assessmentid": assessment_id,
            "candidate_id": candidate_id,
            "candidateid": candidate_id,
            "action": "AssignCandidate",
            "reason": (
                f"Assigned candidate {candidate_id}"
            ),
            "timestamp": now,
        }
    )

    # Send the candidate the same fully hydrated assessment shape returned by
    # /candidate/upcoming, so the live card never renders placeholder values.
    assessment_payload = _merge_exam_assessment(
        exam or {},
        assessment_document,
    )
    assessment_payload["candidate_name"] = user.get("name", candidate_id)
    assessment_payload["candidate_email"] = user.get("email", "")

    email_sent = False
    email_error = None
    candidate_email = user.get("email", "")
    if candidate_email:
        try:
            await send_exam_assignment_email(
                candidate_email=candidate_email,
                candidate_name=user.get("name", candidate_id),
                exam=exam,
            )
            email_sent = True
        except Exception as exc:
            email_error = str(exc)
            logger.exception("Assignment email failed for candidate %s and exam %s", candidate_id, exam_id)
    else:
        email_error = "Candidate email address is unavailable"
        logger.warning("No email available for assigned candidate %s", candidate_id)

    await emit_assessment_event("assessment_created", assessment_payload)
    return {
        "message": "Candidate assigned",
        "email_sent": email_sent,
        "email_error": email_error,
        "assessment": assessment_payload,
        **assessment_payload,
    }
