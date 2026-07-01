from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException

from config.database import get_db
from middleware.auth import require_role
from utils.id_generator import generate_exam_id, generate_assessment_id

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


async def _ensure_exam_access(db, exam_id: str, current_user: dict):
    exam = await db.exams.find_one(_get_exam_query(exam_id))
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    examiner_id = exam.get("examiner_id") or exam.get("examinerid")
    current_user_id = current_user.get("user_id") or current_user.get("userid")

    if current_user["role"] == "Examiner" and examiner_id != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return exam


@router.get("/candidate/upcoming")
async def candidate_upcoming(
    current_user=Depends(require_role("Candidate"))
):
    db = get_db()
    candidate_id = current_user.get("user_id") or current_user.get("userid")

    assessments = await db.assessments.find({
        "$or": [
            {"candidate_id": candidate_id},
            {"candidateid": candidate_id},
        ]
    }).sort("created_at", -1).to_list(None)

    result = []
    for assessment in assessments:
        exam_id = assessment.get("exam_id") or assessment.get("examid")
        exam = await db.exams.find_one(_get_exam_query(exam_id))
        if not exam:
            continue

        result.append({
            "assessment_id": assessment.get("assessment_id") or assessment.get("assessmentid"),
            "exam_id": exam.get("exam_id") or exam.get("examid"),
            "name": exam.get("name", ""),
            "description": exam.get("description", ""),
            "date": exam.get("date", ""),
            "start_time": exam.get("start_time") or exam.get("starttime", ""),
            "end_time": exam.get("end_time") or exam.get("endtime", ""),
            "duration_minutes": exam.get("duration_minutes") or exam.get("durationminutes", 120),
            "status": assessment.get("status", "ASSIGNED"),
            "exam_status": exam.get("status", "Draft"),
            "instructions": exam.get("instructions", ""),
            "allowed_websites": exam.get("allowed_websites") or exam.get("allowedwebsites", []),
            "allowed_applications": exam.get("allowed_applications") or exam.get("allowedapplications", []),
            "violation_threshold": exam.get("violation_threshold") or exam.get("violationthreshold", 10),
        })

    return result


@router.get("")
async def list_exams(
    current_user=Depends(require_role("Examiner", "Admin"))
):
    db = get_db()
    current_user_id = current_user.get("user_id") or current_user.get("userid")

    query = {}
    if current_user["role"] == "Examiner":
        query = {
            "$or": [
                {"examiner_id": current_user_id},
                {"examinerid": current_user_id},
            ]
        }

    exams = await db.exams.find(query).sort("date", -1).to_list(None)
    return [_serialize(exam) for exam in exams]


@router.post("")
async def create_exam(
    body: dict,
    current_user=Depends(require_role("Examiner", "Admin"))
):
    db = get_db()

    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Exam name is required")

    exam_id = await generate_exam_id()
    now = datetime.utcnow()
    current_user_id = current_user.get("user_id") or current_user.get("userid")
    violation_threshold = body.get("violation_threshold", body.get("threshold", 10))

    exam = {
        "exam_id": exam_id,
        "examid": exam_id,
        "examiner_id": current_user_id,
        "examinerid": current_user_id,
        "name": name,
        "description": (body.get("description") or "").strip(),
        "date": body.get("date", ""),
        "start_time": body.get("start_time", ""),
        "starttime": body.get("start_time", ""),
        "end_time": body.get("end_time", ""),
        "endtime": body.get("end_time", ""),
        "duration_minutes": int(body.get("duration_minutes", 120)),
        "durationminutes": int(body.get("duration_minutes", 120)),
        "violation_threshold": int(violation_threshold),
        "violationthreshold": int(violation_threshold),
        "instructions": body.get("instructions", ""),
        "allowed_websites": body.get("allowed_websites", []) or [],
        "allowedwebsites": body.get("allowed_websites", []) or [],
        "allowed_applications": body.get("allowed_applications", []) or [],
        "allowedapplications": body.get("allowed_applications", []) or [],
        "status": body.get("status", "Draft"),
        "created_at": now,
        "createdat": now,
        "updated_at": now,
        "updatedat": now,
    }

    await db.exams.insert_one(exam)

    await db.audit_logs.insert_one({
        "log_id": f"AUD-{uuid.uuid4().hex[:8].upper()}",
        "user_id": current_user_id,
        "userid": current_user_id,
        "exam_id": exam_id,
        "examid": exam_id,
        "action": "CreateExam",
        "reason": f"Created exam: {name}",
        "timestamp": now,
    })

    return _serialize(exam)


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

    return _serialize(exam)


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
                "status": "Running",
                "started_at": now,
                "startedat": now,
                "updated_at": now,
                "updatedat": now,
            }
        }
    )

    await db.assessments.update_many(
        {
            "$or": [
                {"exam_id": exam_id, "status": {"$in": ["READY", "ASSIGNED", "AVAILABLE"]}},
                {"examid": exam_id, "status": {"$in": ["READY", "ASSIGNED", "AVAILABLE"]}},
            ]
        },
        {
            "$set": {
                "status": "ACTIVE",
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

    return {"message": "Exam started", "exam_id": exam_id}


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
                "status": "Completed",
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

    return {"message": "Exam ended", "exam_id": exam_id}


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
            "candidate_id": candidate_id,
            "candidate_name": user.get("name") if user else candidate_id,
            "candidate_email": user.get("email") if user else "",
            "status": assessment.get("status", "ASSIGNED"),
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


@router.delete("/{exam_id}/assign/{candidate_id}")
async def remove_candidate(
    exam_id: str,
    candidate_id: str,
    current_user=Depends(require_role("Examiner", "Admin"))
):
    db = get_db()
    current_user_id = current_user.get("user_id") or current_user.get("userid")
    await _ensure_exam_access(db, exam_id, current_user)

    assessment = await db.assessments.find_one(_get_assessment_query(exam_id, candidate_id))

    if not assessment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    status = assessment.get("status")
    if status not in ["ASSIGNED", "AVAILABLE"]:
        raise HTTPException(
            status_code=400,
            detail="Candidate cannot be removed after assessment has started"
        )

    assessment_id = assessment.get("assessment_id") or assessment.get("assessmentid")

    await db.assessments.delete_one({"_id": assessment["_id"]})

    now = datetime.utcnow()

    await db.audit_logs.insert_one({
        "log_id": f"AUD-{uuid.uuid4().hex[:8].upper()}",
        "user_id": current_user_id,
        "userid": current_user_id,
        "exam_id": exam_id,
        "examid": exam_id,
        "assessment_id": assessment_id,
        "assessmentid": assessment_id,
        "action": "RemoveCandidate",
        "reason": f"Removed candidate {candidate_id}",
        "timestamp": now,
    })

    return {
        "message": "Candidate removed from exam",
        "candidate_id": candidate_id,
        "exam_id": exam_id,
    }