from fastapi import APIRouter, Depends, HTTPException
from config.database import get_db
from middleware.auth import require_role
import uuid
from datetime import datetime

router = APIRouter(prefix="/api/exams", tags=["Exams"])


# ── THIS MUST BE ABOVE /{exam_id} — order matters in FastAPI ─────────────────
@router.get("/candidate/upcoming")
async def candidate_upcoming(
    current_user=Depends(require_role("Candidate"))
):
    db = get_db()
    candidate_id = current_user["user_id"]

    assessments = await db.assessments.find(
        {"candidate_id": candidate_id}
    ).to_list(None)

    result = []
    for a in assessments:
        exam = await db.exams.find_one({"exam_id": a.get("exam_id")})
        if exam:
            result.append({
                "assessment_id":    a.get("assessment_id"),
                "exam_id":          exam.get("exam_id"),
                "name":             exam.get("name"),
                "date":             exam.get("date"),
                "start_time":       exam.get("start_time"),
                "end_time":         exam.get("end_time"),
                "duration_minutes": exam.get("duration_minutes"),
                "status":           a.get("status"),
                "exam_status":      exam.get("status"),
                "instructions":     exam.get("instructions", ""),
                "allowed_websites": exam.get("allowed_websites", []),
                "threshold":        exam.get("threshold", 10),
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
    return [{k: v for k, v in e.items() if k != "_id"} for e in exams]


@router.post("")
async def create_exam(
    body: dict,
    current_user=Depends(require_role("Examiner", "Admin"))
):
    db = get_db()
    exam_id = str(uuid.uuid4())

    exam = {
        "exam_id":            exam_id,
        "examiner_id":        current_user["user_id"],
        "name":               body.get("name", "").strip(),
        "description":        body.get("description", ""),
        "date":               body.get("date", ""),
        "start_time":         body.get("start_time", ""),
        "end_time":           body.get("end_time", ""),
        "duration_minutes":   int(body.get("duration_minutes", 120)),
        "threshold":          int(body.get("threshold", 10)),
        "instructions":       body.get("instructions", ""),
        "allowed_websites":   body.get("allowed_websites", []),
        "allowed_applications": body.get("allowed_applications", []),
        "status":             body.get("status", "Published"),
        "created_at":         datetime.utcnow().isoformat(),
    }

    if not exam["name"]:
        raise HTTPException(status_code=400, detail="Exam name is required")

    await db.exams.insert_one(exam)

    await db.audit_logs.insert_one({
        "audit_id":  str(uuid.uuid4()),
        "user_id":   current_user["user_id"],
        "action":    "CreateExam",
        "target_id": exam_id,
        "reason":    f"Created exam: {exam['name']}",
        "timestamp": datetime.utcnow().isoformat()
    })

    return {k: v for k, v in exam.items() if k != "_id"}


@router.get("/{exam_id}")
async def get_exam(
    exam_id: str,
    current_user=Depends(require_role("Examiner", "Admin", "Candidate"))
):
    db = get_db()
    exam = await db.exams.find_one({"exam_id": exam_id})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return {k: v for k, v in exam.items() if k != "_id"}


@router.patch("/{exam_id}/start")
async def start_exam(
    exam_id: str,
    current_user=Depends(require_role("Examiner", "Admin"))
):
    db = get_db()
    exam = await db.exams.find_one({"exam_id": exam_id})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    await db.exams.update_one(
        {"exam_id": exam_id},
        {"$set": {"status": "Running", "started_at": datetime.utcnow().isoformat()}}
    )

    # Activate all READY assessments for this exam
    await db.assessments.update_many(
        {"exam_id": exam_id, "status": {"$in": ["READY", "ASSIGNED", "AVAILABLE"]}},
        {"$set": {"status": "ACTIVE", "started_at": datetime.utcnow().isoformat()}}
    )

    await db.audit_logs.insert_one({
        "audit_id":  str(uuid.uuid4()),
        "user_id":   current_user["user_id"],
        "action":    "StartExam",
        "target_id": exam_id,
        "reason":    "Exam manually started",
        "timestamp": datetime.utcnow().isoformat()
    })

    return {"message": "Exam started", "exam_id": exam_id}


@router.get("/{exam_id}/assessments")
async def get_exam_assessments(
    exam_id: str,
    current_user=Depends(require_role("Examiner", "Admin"))
):
    db = get_db()
    assessments = await db.assessments.find({"exam_id": exam_id}).to_list(None)

    result = []
    for a in assessments:
        user = await db.users.find_one({"user_id": a.get("candidate_id")})
        result.append({
            "assessment_id":    a.get("assessment_id"),
            "candidate_id":     a.get("candidate_id"),
            "candidate_name":   user["name"] if user else a.get("candidate_id"),
            "candidate_email":  user["email"] if user else "",
            "status":           a.get("status", "ASSIGNED"),
            "violation_count":  a.get("violation_count", 0),
            "risk_score":       a.get("risk_score", 0),
            "credibility_score": a.get("credibility_score", 100),
            "warning_count":    a.get("warning_count", 0),
            "attendance_status": a.get("attendance_status", ""),
        })
    return result


@router.post("/{exam_id}/assign")
async def assign_candidate(
    exam_id: str,
    body: dict,
    current_user=Depends(require_role("Examiner", "Admin"))
):
    db = get_db()
    candidate_id = body.get("candidate_id", "")

    if not candidate_id:
        raise HTTPException(status_code=400, detail="candidate_id is required")

    # Check exam exists
    exam = await db.exams.find_one({"exam_id": exam_id})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Check candidate exists
    user = await db.users.find_one({"user_id": candidate_id})
    if not user:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Prevent duplicate assignment
    existing = await db.assessments.find_one({
        "exam_id": exam_id,
        "candidate_id": candidate_id
    })
    if existing:
        raise HTTPException(status_code=409, detail="Candidate already assigned")

    assessment_id = str(uuid.uuid4())
    await db.assessments.insert_one({
        "assessment_id":    assessment_id,
        "exam_id":          exam_id,
        "candidate_id":     candidate_id,
        "examiner_id":      current_user["user_id"],
        "status":           "ASSIGNED",
        "violation_count":  0,
        "warning_count":    0,
        "risk_score":       0,
        "credibility_score": 100,
        "attendance_status": "",
        "created_at":       datetime.utcnow().isoformat()
    })

    return {"message": "Candidate assigned", "assessment_id": assessment_id}


@router.delete("/{exam_id}/assign/{candidate_id}")
async def remove_candidate(
    exam_id: str,
    candidate_id: str,
    current_user=Depends(require_role("Examiner", "Admin"))
):
    db = get_db()
    result = await db.assessments.delete_one({
        "exam_id": exam_id,
        "candidate_id": candidate_id,
        "status": "ASSIGNED"  # Only allow removal if not yet active
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404,
            detail="Assignment not found or assessment already active")
    return {"message": "Candidate removed from exam"}


@router.get("/{exam_id}/requests")
async def get_requests(
    exam_id: str,
    current_user=Depends(require_role("Examiner", "Admin"))
):
    db = get_db()
    assessments = await db.assessments.find({"exam_id": exam_id}).to_list(None)
    assessment_ids = [a["assessment_id"] for a in assessments]

    requests = await db.reentry_requests.find(
        {"assessment_id": {"$in": assessment_ids}}
    ).sort("created_at", -1).to_list(None)

    result = []
    for r in requests:
        user = await db.users.find_one({"user_id": r.get("candidate_id")})
        result.append({
            "request_id":     r.get("request_id"),
            "assessment_id":  r.get("assessment_id"),
            "candidate_id":   r.get("candidate_id"),
            "candidate_name": user["name"] if user else r.get("candidate_id"),
            "reason":         r.get("reason", ""),
            "status":         r.get("status", "Pending"),
            "type":           r.get("type", "reentry"),
            "created_at":     r.get("created_at", ""),
        })
    return result


@router.delete("/{exam_id}")
async def delete_exam(
    exam_id: str,
    current_user=Depends(require_role("Examiner", "Admin"))
):
    db = get_db()
    exam = await db.exams.find_one({"exam_id": exam_id})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if exam.get("status") == "Running":
        raise HTTPException(status_code=400, detail="Cannot delete a running exam")

    await db.exams.delete_one({"exam_id": exam_id})
    await db.assessments.delete_many({"exam_id": exam_id})
    return {"message": "Exam deleted"}