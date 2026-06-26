from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException

from config.database import get_db
from middleware.auth import require_role
from utils.id_generator import generate_exam_id, generate_assessment_id

router = APIRouter(prefix="/api/exams", tags=["Exams"])


def _serialize(document: dict) -> dict:
    return {k: str(v) if k == "_id" else v for k, v in document.items() if k != "_id"}


async def _ensure_exam_access(db, exam_id: str, current_user: dict):
    exam = await db.exams.find_one({"exam_id": exam_id})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    if current_user["role"] == "Examiner" and exam.get("examiner_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    return exam


@router.get("/candidate/upcoming")
async def candidate_upcoming(
    current_user=Depends(require_role("Candidate"))
):
    db = get_db()
    candidate_id = current_user["user_id"]

    assessments = await db.assessments.find(
        {"candidate_id": candidate_id}
    ).sort("created_at", -1).to_list(None)

    result = []
    for assessment in assessments:
        exam = await db.exams.find_one({"exam_id": assessment.get("exam_id")})
        if not exam:
            continue

        result.append({
            "assessment_id": assessment.get("assessment_id"),
            "exam_id": exam.get("exam_id"),
            "name": exam.get("name"),
            "description": exam.get("description", ""),
            "date": exam.get("date"),
            "start_time": exam.get("start_time"),
            "end_time": exam.get("end_time"),
            "duration_minutes": exam.get("duration_minutes"),
            "status": assessment.get("status"),
            "exam_status": exam.get("status"),
            "instructions": exam.get("instructions", ""),
            "allowed_websites": exam.get("allowed_websites", []),
            "allowed_applications": exam.get("allowed_applications", []),
            "violation_threshold": exam.get("violation_threshold", 10),
        })

    return result


@router.get("")
async def list_exams(
    current_user=Depends(require_role("Examiner", "Admin"))
):
    db = get_db()
    query = {}

    if current_user["role"] == "Examiner":
        query["examiner_id"] = current_user["user_id"]

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

    exam = {
        "exam_id": exam_id,
        "examiner_id": current_user["user_id"],
        "name": name,
        "description": (body.get("description") or "").strip(),
        "date": body.get("date", ""),
        "start_time": body.get("start_time") or body.get("starttime", ""),
        "end_time": body.get("end_time") or body.get("endtime", ""),
        "duration_minutes": int(body.get("duration_minutes", body.get("durationminutes", 120))),
        "violation_threshold": int(body.get("violation_threshold", body.get("violationthreshold", 10))),
        "instructions": body.get("instructions", ""),
        "allowed_websites": body.get("allowed_websites", body.get("allowedwebsites", [])) or [],
        "allowed_applications": body.get("allowed_applications", body.get("allowedapplications", [])) or [],
        "status": body.get("status", "Draft"),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    await db.exams.insert_one(exam)

    await db.audit_logs.insert_one({
        "log_id": f"AUD-{uuid.uuid4().hex[:8].upper()}",
        "user_id": current_user["user_id"],
        "exam_id": exam_id,
        "action": "CreateExam",
        "reason": f"Created exam: {exam['name']}",
        "timestamp": datetime.utcnow(),
    })

    return _serialize(exam)


@router.get("/{exam_id}")
async def get_exam(
    exam_id: str,
    current_user=Depends(require_role("Examiner", "Admin", "Candidate"))
):
    db = get_db()
    exam = await db.exams.find_one({"exam_id": exam_id})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    if current_user["role"] == "Examiner" and exam.get("examiner_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    if current_user["role"] == "Candidate":
        assignment = await db.assessments.find_one({
            "exam_id": exam_id,
            "candidate_id": current_user["user_id"],
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
    await _ensure_exam_access(db, exam_id, current_user)

    now = datetime.utcnow()

    await db.exams.update_one(
        {"exam_id": exam_id},
        {"$set": {"status": "Running", "started_at": now, "updated_at": now}},
    )

    await db.assessments.update_many(
        {"exam_id": exam_id, "status": {"$in": ["READY", "ASSIGNED", "AVAILABLE"]}},
        {"$set": {"status": "ACTIVE", "started_at": now, "updated_at": now}},
    )

    await db.audit_logs.insert_one({
        "log_id": f"AUD-{uuid.uuid4().hex[:8].upper()}",
        "user_id": current_user["user_id"],
        "exam_id": exam_id,
        "action": "StartExam",
        "reason": "Exam manually started",
        "timestamp": now,
    })

    return {"message": "Exam started", "exam_id": exam_id}


@router.get("/{exam_id}/assessments")
async def get_exam_assessments(
    exam_id: str,
    current_user=Depends(require_role("Examiner", "Admin"))
):
    db = get_db()
    await _ensure_exam_access(db, exam_id, current_user)

    assessments = await db.assessments.find({"exam_id": exam_id}).to_list(None)

    result = []
    for assessment in assessments:
        user = await db.users.find_one({"user_id": assessment.get("candidate_id")})
        result.append({
            "assessment_id": assessment.get("assessment_id"),
            "candidate_id": assessment.get("candidate_id"),
            "candidate_name": user["name"] if user else assessment.get("candidate_id"),
            "candidate_email": user["email"] if user else "",
            "status": assessment.get("status", "ASSIGNED"),
            "violation_count": assessment.get("violation_count", 0),
            "risk_score": assessment.get("risk_score", 0),
            "credibility_score": assessment.get("credibility_score", 100),
            "warning_count": assessment.get("warning_count", 0),
            "attendance_status": assessment.get("attendance_status", ""),
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

    candidate_id = body.get("candidate_id") or body.get("candidateid") or ""
    candidate_id = candidate_id.strip()

    if not candidate_id:
        raise HTTPException(status_code=400, detail="candidate_id is required")

    user = await db.users.find_one({"user_id": candidate_id})
    if not user or user.get("role") != "Candidate":
        raise HTTPException(status_code=404, detail="Candidate not found")

    existing = await db.assessments.find_one({
        "exam_id": exam_id,
        "candidate_id": candidate_id,
    })
    if existing:
        raise HTTPException(status_code=409, detail="Candidate already assigned")

    assessment_id = await generate_assessment_id()
    now = datetime.utcnow()

    await db.assessments.insert_one({
        "assessment_id": assessment_id,
        "exam_id": exam_id,
        "candidate_id": candidate_id,
        "examiner_id": current_user["user_id"],
        "status": "ASSIGNED",
        "violation_count": 0,
        "warning_count": 0,
        "risk_score": 0,
        "credibility_score": 100,
        "integrity_score": 100,
        "attendance_status": None,
        "join_time": None,
        "active_time": None,
        "exit_time": None,
        "threshold_reached": False,
        "re_entry_count": 0,
        "final_status": None,
        "created_at": now,
        "updated_at": now,
    })

    await db.audit_logs.insert_one({
        "log_id": f"AUD-{uuid.uuid4().hex[:8].upper()}",
        "user_id": current_user["user_id"],
        "exam_id": exam_id,
        "assessment_id": assessment_id,
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
    await _ensure_exam_access(db, exam_id, current_user)

    assessment = await db.assessments.find_one({
        "exam_id": exam_id,
        "candidate_id": candidate_id,
    })
    if not assessment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if assessment.get("status") not in {"ASSIGNED", "AVAILABLE"}:
        raise HTTPException(
            status_code=400,
            detail="Candidate cannot be removed after assessment has started",
        )

    await db.assessments.delete_one({"assessment_id": assessment["assessment_id"]})

    await db.audit_logs.insert_one({
        "log_id": f"AUD-{uuid.uuid4().hex[:8].upper()}",
        "user_id": current_user["user_id"],
        "exam_id": exam_id,
        "assessment_id": assessment["assessment_id"],
        "action": "RemoveCandidate",
        "reason": f"Removed candidate {candidate_id}",
        "timestamp": datetime.utcnow(),
    })

    return {"message": "Candidate removed from exam"}


@router.get("/{exam_id}/requests")
async def get_requests(
    exam_id: str,
    current_user=Depends(require_role("Examiner", "Admin"))
):
    db = get_db()
    await _ensure_exam_access(db, exam_id, current_user)

    requests = await db.requests.find(
        {"exam_id": exam_id}
    ).sort("created_at", -1).to_list(None)

    result = []
    for request in requests:
        user = await db.users.find_one({"user_id": request.get("candidate_id")})
        result.append({
            "request_id": request.get("request_id"),
            "assessment_id": request.get("assessment_id"),
            "candidate_id": request.get("candidate_id"),
            "candidate_name": user["name"] if user else request.get("candidate_id"),
            "candidate_email": user["email"] if user else "",
            "reason": request.get("reason", ""),
            "status": request.get("status", "PENDING"),
            "type": request.get("type", "REENTRY"),
            "created_at": request.get("created_at"),
            "reviewed_by": request.get("reviewed_by"),
            "reviewed_at": request.get("reviewed_at"),
        })

    return result


@router.delete("/{exam_id}")
async def delete_exam(
    exam_id: str,
    current_user=Depends(require_role("Examiner", "Admin"))
):
    db = get_db()
    exam = await _ensure_exam_access(db, exam_id, current_user)

    if exam.get("status") == "Running":
        raise HTTPException(status_code=400, detail="Cannot delete a running exam")

    await db.exams.delete_one({"exam_id": exam_id})
    await db.assessments.delete_many({"exam_id": exam_id})
    await db.requests.delete_many({"exam_id": exam_id})
    await db.reentry_requests.delete_many({"exam_id": exam_id})

    await db.audit_logs.insert_one({
        "log_id": f"AUD-{uuid.uuid4().hex[:8].upper()}",
        "user_id": current_user["user_id"],
        "exam_id": exam_id,
        "action": "DeleteExam",
        "reason": f"Deleted exam: {exam.get('name', exam_id)}",
        "timestamp": datetime.utcnow(),
    })

    return {"message": "Exam deleted"}