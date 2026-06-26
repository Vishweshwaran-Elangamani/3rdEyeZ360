from datetime import datetime
from fastapi import HTTPException

from config.database import get_db
from utils.id_generator import generate_exam_id, generate_assessment_id


def _serialize(document: dict) -> dict:
    return {k: str(v) if k == "_id" else v for k, v in document.items() if k != "_id"}


async def create_exam(data: dict, examiner_id: str):
    db = get_db()

    name = (data.get("name") or "").strip()
    date = data.get("date")
    start_time = data.get("start_time")
    end_time = data.get("end_time")
    duration_minutes = data.get("duration_minutes")

    if not name:
        raise HTTPException(status_code=400, detail="Exam name is required")
    if not date or not start_time or not end_time:
        raise HTTPException(status_code=400, detail="Exam date, start_time, and end_time are required")
    if duration_minutes is None:
        raise HTTPException(status_code=400, detail="duration_minutes is required")

    exam_id = await generate_exam_id()
    exam = {
        "exam_id": exam_id,
        "name": name,
        "description": data.get("description", ""),
        "examiner_id": examiner_id,
        "date": date,
        "start_time": start_time,
        "end_time": end_time,
        "duration_minutes": int(duration_minutes),
        "violation_threshold": int(data.get("violation_threshold", 10)),
        "allowed_websites": data.get("allowed_websites", []),
        "allowed_applications": data.get("allowed_applications", []),
        "instructions": data.get("instructions", ""),
        "status": data.get("status", "Draft"),
        "created_at": datetime.utcnow(),
    }

    await db.exams.insert_one(exam)
    return _serialize(exam)


async def get_exams_by_examiner(examiner_id: str):
    db = get_db()
    exams = await db.exams.find({"examiner_id": examiner_id}).sort("created_at", -1).to_list(None)
    return [_serialize(e) for e in exams]


async def get_exam(exam_id: str):
    db = get_db()
    exam = await db.exams.find_one({"exam_id": exam_id})
    if not exam:
        return None
    return _serialize(exam)


async def assign_candidates(exam_id: str, candidate_ids: list, examiner_id: str):
    db = get_db()

    exam = await db.exams.find_one({"exam_id": exam_id})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    results = []

    for candidate_id in candidate_ids:
        candidate = await db.users.find_one({"user_id": candidate_id, "role": "Candidate"})
        if not candidate:
            continue

        existing = await db.assessments.find_one(
            {"exam_id": exam_id, "candidate_id": candidate_id}
        )
        if existing:
            continue

        assessment_id = await generate_assessment_id()
        assessment = {
            "assessment_id": assessment_id,
            "exam_id": exam_id,
            "candidate_id": candidate_id,
            "examiner_id": examiner_id,
            "status": "ASSIGNED",
            "attendance_status": None,
            "join_time": None,
            "active_time": None,
            "exit_time": None,
            "violation_count": 0,
            "warning_count": 0,
            "risk_score": 0,
            "credibility_score": 100,
            "integrity_score": 100,
            "threshold_reached": False,
            "re_entry_count": 0,
            "final_status": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        await db.assessments.insert_one(assessment)
        results.append(assessment_id)

    return results


async def publish_exam(exam_id: str):
    db = get_db()

    result = await db.exams.update_one(
        {"exam_id": exam_id},
        {
            "$set": {
                "status": "Published",
                "updated_at": datetime.utcnow(),
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Exam not found")

    return {"message": "Exam published"}