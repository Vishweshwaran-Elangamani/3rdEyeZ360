from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException

from config.database import get_db
from middleware.auth import require_role
from utils.id_generator import generate_assessment_id

router = APIRouter(prefix="/api/exams", tags=["Exams"])


def _serialize(document: dict) -> dict:
    return {k: str(v) if k == "_id" else v for k, v in document.items() if k != "_id"}


def _get_exam_query(exam_id: str):
    return {"$or": [{"exam_id": exam_id}, {"examid": exam_id}]}


def _get_user_query(user_id: str):
    return {"$or": [{"user_id": user_id}, {"userid": user_id}]}


def _get_assessment_query(exam_id: str, candidate_id: str):
    return {
        "$or": [
            {"exam_id": exam_id, "candidate_id": candidate_id},
            {"examid": exam_id, "candidateid": candidate_id},
        ]
    }


def _normalize_status(value, default=""):
    return str(value or default).strip().upper()


def _clean_list(value):
    if not isinstance(value, list):
        return []
    return [item for item in value if item not in (None, "", [])]


def _exam_payload(exam: dict) -> dict:
    exam_data = _serialize(exam or {})
    exam_status = _normalize_status(exam.get("status") or exam.get("examstatus"))

    exam_data["status"] = exam_status
    exam_data["examstatus"] = exam_status
    exam_data["exam_status"] = exam_status

    exam_id = exam.get("exam_id") or exam.get("examid")
    examiner_id = exam.get("examiner_id") or exam.get("examinerid")

    exam_data["examid"] = exam_id
    exam_data["exam_id"] = exam_id
    exam_data["examinerid"] = examiner_id
    exam_data["examiner_id"] = examiner_id
    exam_data["name"] = exam.get("name") or exam.get("examname") or ""
    exam_data["description"] = exam.get("description") or exam.get("examdescription") or ""
    exam_data["date"] = exam.get("date") or exam.get("examdate") or ""
    exam_data["starttime"] = exam.get("starttime") or exam.get("start_time") or exam.get("examstarttime") or ""
    exam_data["endtime"] = exam.get("endtime") or exam.get("end_time") or exam.get("examendtime") or ""
    exam_data["durationminutes"] = exam.get("durationminutes", exam.get("duration_minutes", 0))
    exam_data["violationthreshold"] = exam.get("violationthreshold", exam.get("violation_threshold", 10))
    exam_data["instructions"] = exam.get("instructions") or ""
    exam_data["allowedwebsites"] = exam.get("allowedwebsites", exam.get("allowed_websites", [])) or []
    exam_data["allowedapplications"] = exam.get("allowedapplications", exam.get("allowed_applications", [])) or []

    return exam_data


def _assessment_payload(assessment: dict) -> dict:
    assessment_data = _serialize(assessment or {})
    assessment_status = _normalize_status(
        assessment.get("status") or assessment.get("assessmentstatus")
    )
    final_status = _normalize_status(
        assessment.get("final_status") or assessment.get("finalstatus")
    )

    assessment_data["status"] = assessment_status
    assessment_data["assessmentstatus"] = assessment_status
    assessment_data["assessment_status"] = assessment_status
    assessment_data["finalstatus"] = final_status
    assessment_data["final_status"] = final_status

    assessment_id = assessment.get("assessment_id") or assessment.get("assessmentid")
    exam_id = assessment.get("exam_id") or assessment.get("examid")
    candidate_id = assessment.get("candidate_id") or assessment.get("candidateid")
    examiner_id = assessment.get("examiner_id") or assessment.get("examinerid")

    assessment_data["assessmentid"] = assessment_id
    assessment_data["assessment_id"] = assessment_id
    assessment_data["examid"] = exam_id
    assessment_data["exam_id"] = exam_id
    assessment_data["candidateid"] = candidate_id
    assessment_data["candidate_id"] = candidate_id
    assessment_data["examinerid"] = examiner_id
    assessment_data["examiner_id"] = examiner_id
    assessment_data["allowedwebsites"] = assessment.get("allowedwebsites", assessment.get("allowed_websites", [])) or []
    assessment_data["allowedapplications"] = assessment.get("allowedapplications", assessment.get("allowed_applications", [])) or []

    return assessment_data


def _merge_exam_assessment(exam: dict, assessment: dict) -> dict:
    exam_data = _exam_payload(exam)
    assessment_data = _assessment_payload(assessment)

    merged = {
        **exam_data,
        **assessment_data,
        "examid": exam_data.get("examid"),
        "exam_id": exam_data.get("exam_id"),
        "assessmentid": assessment_data.get("assessmentid"),
        "assessment_id": assessment_data.get("assessment_id"),
        "candidateid": assessment_data.get("candidateid"),
        "candidate_id": assessment_data.get("candidate_id"),
        "examinerid": assessment_data.get("examinerid") or exam_data.get("examinerid"),
        "examiner_id": assessment_data.get("examiner_id") or exam_data.get("examiner_id"),
        "name": exam_data.get("name"),
        "description": exam_data.get("description", ""),
        "date": exam_data.get("date"),
        "starttime": exam_data.get("starttime"),
        "endtime": exam_data.get("endtime"),
        "durationminutes": exam_data.get("durationminutes", 0),
        "allowedwebsites": assessment_data.get("allowedwebsites") or exam_data.get("allowedwebsites") or [],
        "allowedapplications": assessment_data.get("allowedapplications") or exam_data.get("allowedapplications") or [],
        "examstatus": exam_data.get("examstatus", ""),
        "exam_status": exam_data.get("exam_status", ""),
        "assessmentstatus": assessment_data.get("assessmentstatus", ""),
        "assessment_status": assessment_data.get("assessment_status", ""),
        "finalstatus": assessment_data.get("finalstatus", ""),
        "final_status": assessment_data.get("final_status", ""),
        "status": assessment_data.get("assessmentstatus", ""),
    }

    return merged


async def _ensure_exam_access(db, exam_id: str, current_user: dict):
    exam = await db.exams.find_one(_get_exam_query(exam_id))
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    current_user_id = current_user.get("user_id") or current_user.get("userid")
    examiner_id = exam.get("examiner_id") or exam.get("examinerid")

    if current_user["role"] == "Examiner" and examiner_id != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return exam


@router.post("")
async def create_exam(
    body: dict,
    current_user=Depends(require_role("Examiner", "Admin"))
):
    db = get_db()
    examiner_id = current_user.get("user_id") or current_user.get("userid")

    name = (body.get("name") or "").strip()
    description = (body.get("description") or "").strip()
    date = (body.get("date") or "").strip()
    start_time = (body.get("start_time") or body.get("starttime") or "").strip()
    end_time = (body.get("end_time") or body.get("endtime") or "").strip()
    instructions = (body.get("instructions") or "").strip()

    duration_minutes = body.get("duration_minutes", body.get("durationminutes"))
    violation_threshold = body.get("violation_threshold", body.get("violationthreshold", 10))
    allowed_websites = _clean_list(body.get("allowed_websites", body.get("allowedwebsites", [])))
    allowed_applications = _clean_list(body.get("allowed_applications", body.get("allowedapplications", [])))
    status = _normalize_status(body.get("status"), "DRAFT")

    if not name:
        raise HTTPException(status_code=400, detail="Exam name is required")

    if not date or not start_time or not end_time:
        raise HTTPException(
            status_code=400,
            detail="Exam date, start_time, and end_time are required"
        )

    if duration_minutes is None:
        raise HTTPException(status_code=400, detail="duration_minutes is required")

    now = datetime.utcnow()
    exam_id = f"EXM-{uuid.uuid4().hex[:8].upper()}"

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
        "duration_minutes": int(duration_minutes),
        "durationminutes": int(duration_minutes),
        "violation_threshold": int(violation_threshold),
        "violationthreshold": int(violation_threshold),
        "allowed_websites": allowed_websites,
        "allowedwebsites": allowed_websites,
        "allowed_applications": allowed_applications,
        "allowedapplications": allowed_applications,
        "instructions": instructions,
        "status": status,
        "examstatus": status,
        "created_at": now,
        "createdat": now,
        "updated_at": now,
        "updatedat": now,
    }

    await db.exams.insert_one(exam_doc)

    await db.audit_logs.insert_one({
        "log_id": f"AUD-{uuid.uuid4().hex[:8].upper()}",
        "user_id": examiner_id,
        "userid": examiner_id,
        "exam_id": exam_id,
        "examid": exam_id,
        "action": "CreateExam",
        "reason": f"Created exam {name}",
        "timestamp": now,
    })

    return _exam_payload(exam_doc)


@router.get("")
async def get_my_exams(current_user=Depends(require_role("Examiner", "Admin"))):
    db = get_db()

    if current_user["role"] == "Admin":
        exams = await db.exams.find({}).sort("created_at", -1).to_list(None)
    else:
        current_user_id = current_user.get("user_id") or current_user.get("userid")
        exams = await db.exams.find({
            "$or": [
                {"examiner_id": current_user_id},
                {"examinerid": current_user_id},
            ]
        }).sort("created_at", -1).to_list(None)

    return [_exam_payload(exam) for exam in exams]


@router.get("/candidate/upcoming")
async def get_candidate_upcoming(current_user=Depends(require_role("Candidate"))):
    db = get_db()
    current_user_id = current_user.get("user_id") or current_user.get("userid")

    assessments = await db.assessments.find({
        "$or": [
            {"candidate_id": current_user_id},
            {"candidateid": current_user_id},
        ]
    }).sort("created_at", -1).to_list(None)

    result = []

    for assessment in assessments:
        exam_id = assessment.get("exam_id") or assessment.get("examid")
        if not exam_id:
            continue

        exam = await db.exams.find_one(_get_exam_query(exam_id))
        if not exam:
            continue

        result.append(_merge_exam_assessment(exam, assessment))

    return result


@router.get("/{exam_id}")
async def get_exam(
    exam_id: str,
    current_user=Depends(require_role("Examiner", "Admin", "Candidate"))
):
    db = get_db()
    exam = await db.exams.find_one(_get_exam_query(exam_id))
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    current_user_id = current_user.get("user_id") or current_user.get("userid")
    examiner_id = exam.get("examiner_id") or exam.get("examinerid")

    if current_user["role"] == "Examiner" and examiner_id != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if current_user["role"] == "Candidate":
        assignment = await db.assessments.find_one({
            "$or": [
                {"exam_id": exam_id, "candidate_id": current_user_id},
                {"examid": exam_id, "candidateid": current_user_id},
            ]
        })
        if not assignment:
            raise HTTPException(status_code=403, detail="Access denied")

    return _exam_payload(exam)


@router.patch("/{exam_id}/start")
async def start_exam(
    exam_id: str,
    current_user=Depends(require_role("Examiner", "Admin"))
):
    db = get_db()
    current_user_id = current_user.get("user_id") or current_user.get("userid")
    await _ensure_exam_access(db, exam_id, current_user)

    now = datetime.utcnow()

    await db.exams.update_one(
        _get_exam_query(exam_id),
        {
            "$set": {
                "status": "RUNNING",
                "examstatus": "RUNNING",
                "started_at": now,
                "startedat": now,
                "updated_at": now,
                "updatedat": now,
            }
        }
    )

    await db.audit_logs.insert_one({
        "log_id": f"AUD-{uuid.uuid4().hex[:8].upper()}",
        "user_id": current_user_id,
        "userid": current_user_id,
        "exam_id": exam_id,
        "examid": exam_id,
        "action": "StartExam",
        "reason": "Exam manually started",
        "timestamp": now,
    })

    return {"message": "Exam started", "exam_id": exam_id, "examstatus": "RUNNING"}


@router.patch("/{exam_id}/end")
async def end_exam(
    exam_id: str,
    current_user=Depends(require_role("Examiner", "Admin"))
):
    db = get_db()
    current_user_id = current_user.get("user_id") or current_user.get("userid")
    await _ensure_exam_access(db, exam_id, current_user)

    now = datetime.utcnow()

    await db.exams.update_one(
        _get_exam_query(exam_id),
        {
            "$set": {
                "status": "COMPLETED",
                "examstatus": "COMPLETED",
                "ended_at": now,
                "endedat": now,
                "updated_at": now,
                "updatedat": now,
            }
        }
    )

    endable_statuses = [
        "ACTIVE",
        "PAUSED",
        "READY",
        "ASSIGNED",
        "AVAILABLE",
        "REENTRYAPPROVED",
        "LATEENTRYAPPROVED",
        "REENTRY_APPROVED",
        "LATEENTRY_APPROVED",
    ]

    await db.assessments.update_many(
        {
            "$or": [
                {"exam_id": exam_id, "status": {"$in": endable_statuses}},
                {"examid": exam_id, "status": {"$in": endable_statuses}},
            ]
        },
        {
            "$set": {
                "status": "TERMINATED",
                "assessmentstatus": "TERMINATED",
                "final_status": "TERMINATED",
                "finalstatus": "TERMINATED",
                "exit_time": now,
                "exittime": now,
                "updated_at": now,
                "updatedat": now,
            }
        }
    )

    await db.audit_logs.insert_one({
        "log_id": f"AUD-{uuid.uuid4().hex[:8].upper()}",
        "user_id": current_user_id,
        "userid": current_user_id,
        "exam_id": exam_id,
        "examid": exam_id,
        "action": "EndExam",
        "reason": "Exam manually ended",
        "timestamp": now,
    })

    return {"message": "Exam ended", "exam_id": exam_id, "examstatus": "COMPLETED"}


@router.get("/{exam_id}/assessments")
async def get_exam_assessments(
    exam_id: str,
    current_user=Depends(require_role("Examiner", "Admin"))
):
    db = get_db()
    await _ensure_exam_access(db, exam_id, current_user)

    assessments = await db.assessments.find({
        "$or": [
            {"exam_id": exam_id},
            {"examid": exam_id},
        ]
    }).to_list(None)

    result = []
    for assessment in assessments:
        candidate_id = assessment.get("candidate_id") or assessment.get("candidateid")
        user = await db.users.find_one(_get_user_query(candidate_id))

        result.append({
            "assessment_id": assessment.get("assessment_id") or assessment.get("assessmentid"),
            "assessmentid": assessment.get("assessment_id") or assessment.get("assessmentid"),
            "candidate_id": candidate_id,
            "candidateid": candidate_id,
            "candidate_name": user.get("name") if user else candidate_id,
            "candidate_email": user.get("email") if user else "",
            "status": _normalize_status(assessment.get("status"), "ASSIGNED"),
            "assessmentstatus": _normalize_status(assessment.get("status"), "ASSIGNED"),
            "violation_count": assessment.get("violation_count", assessment.get("violationcount", 0)),
            "risk_score": assessment.get("risk_score", assessment.get("riskscore", 0)),
            "credibility_score": assessment.get("credibility_score", assessment.get("credibilityscore", 100)),
            "warning_count": assessment.get("warning_count", assessment.get("warningcount", 0)),
            "attendance_status": assessment.get("attendance_status", assessment.get("attendancestatus", "")),
        })

    return result


@router.post("/{exam_id}/assign")
async def assign_candidate(
    exam_id: str,
    body: dict,
    current_user=Depends(require_role("Examiner", "Admin"))
):
    db = get_db()
    await _ensure_exam_access(db, exam_id, current_user)

    current_user_id = current_user.get("user_id") or current_user.get("userid")
    candidate_id = (body.get("candidate_id") or body.get("candidateid") or "").strip()

    if not candidate_id:
        raise HTTPException(status_code=400, detail="candidate_id is required")

    user = await db.users.find_one(_get_user_query(candidate_id))
    if not user or user.get("role") != "Candidate":
        raise HTTPException(status_code=404, detail="Candidate not found")

    existing = await db.assessments.find_one(_get_assessment_query(exam_id, candidate_id))
    if existing:
        raise HTTPException(status_code=409, detail="Candidate already assigned")

    assessment_id = await generate_assessment_id()
    now = datetime.utcnow()

    await db.assessments.insert_one({
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
        "created_at": now,
        "createdat": now,
        "updated_at": now,
        "updatedat": now,
    })

    await db.audit_logs.insert_one({
        "log_id": f"AUD-{uuid.uuid4().hex[:8].upper()}",
        "user_id": current_user_id,
        "userid": current_user_id,
        "exam_id": exam_id,
        "examid": exam_id,
        "assessment_id": assessment_id,
        "assessmentid": assessment_id,
        "action": "AssignCandidate",
        "reason": f"Assigned candidate {candidate_id}",
        "timestamp": now,
    })

    return {"message": "Candidate assigned", "assessment_id": assessment_id}