from config.database import get_db
from utils.id_generator import generate_exam_id
from datetime import datetime

async def create_exam(data: dict, examiner_id: str):
    db = get_db()
    exam_id = await generate_exam_id()
    exam = {
        "exam_id": exam_id,
        "name": data["name"],
        "description": data.get("description", ""),
        "examiner_id": examiner_id,
        "date": data["date"],
        "start_time": data["start_time"],
        "end_time": data["end_time"],
        "duration_minutes": data["duration_minutes"],
        "violation_threshold": data.get("violation_threshold", 10),
        "allowed_websites": data.get("allowed_websites", []),
        "instructions": data.get("instructions", ""),
        "status": "Draft",
        "created_at": datetime.utcnow()
    }
    await db.exams.insert_one(exam)
    return {k: str(v) if k == "_id" else v for k, v in exam.items() if k != "_id"}

async def get_exams_by_examiner(examiner_id: str):
    db = get_db()
    exams = await db.exams.find({"examiner_id": examiner_id}).to_list(None)
    return [{k: str(v) if k == "_id" else v for k, v in e.items() if k != "_id"} for e in exams]

async def get_exam(exam_id: str):
    db = get_db()
    exam = await db.exams.find_one({"exam_id": exam_id})
    if not exam:
        return None
    return {k: str(v) if k == "_id" else v for k, v in exam.items() if k != "_id"}

async def assign_candidates(exam_id: str, candidate_ids: list, examiner_id: str):
    db = get_db()
    from utils.id_generator import generate_assessment_id
    results = []
    for cid in candidate_ids:
        existing = await db.assessments.find_one({"exam_id": exam_id, "candidate_id": cid})
        if not existing:
            aid = await generate_assessment_id()
            assessment = {
                "assessment_id": aid,
                "exam_id": exam_id,
                "candidate_id": cid,
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
                "created_at": datetime.utcnow()
            }
            await db.assessments.insert_one(assessment)
            results.append(aid)
    return results

async def publish_exam(exam_id: str):
    db = get_db()
    await db.exams.update_one({"exam_id": exam_id}, {"$set": {"status": "Published"}})
    return {"message": "Exam published"}