from datetime import datetime
import uuid

from config.database import get_db

VIOLATION_SCORES = {
    "phone_detected": 5,
    "multiple_face": 8,
    "multiple_faces": 8,
    "face_missing": 2,
    "looking_away": 2,
    "looking_left": 2,
    "looking_right": 2,
    "looking_down": 2,
    "noise_violation": 2,
    "background_speech": 2,
    "loud_noise": 2,
    "restricted_app": 6,
    "multiple_monitor": 4,
    "charger_removed": 1,
    "mic_silent": 1,
}


async def log_warning(assessment_id: str, candidate_id: str, exam_id: str, detail: str):
    db = get_db()
    existing = await db.warnings.find_one({
        "assessment_id": assessment_id,
        "detail": detail
    })
    if existing:
        await db.warnings.update_one(
            {"_id": existing["_id"]},
            {"$inc": {"count": 1}, "$set": {"timestamp": datetime.utcnow()}}
        )
        return existing["count"] + 1

    warning = {
        "warning_id": f"WRN-{uuid.uuid4().hex[:8].upper()}",
        "assessment_id": assessment_id,
        "candidate_id": candidate_id,
        "exam_id": exam_id,
        "type": detail,
        "detail": detail,
        "count": 1,
        "timestamp": datetime.utcnow()
    }
    await db.warnings.insert_one(warning)
    return 1


async def log_violation(
    assessment_id: str,
    candidate_id: str,
    exam_id: str,
    vtype: str,
    detail: str,
    confidence: float,
    screenshot_path: str = None,
    clip_path: str = None
):
    db = get_db()
    risk = VIOLATION_SCORES.get(vtype, 5)

    violation = {
        "violation_id": f"VIO-{uuid.uuid4().hex[:8].upper()}",
        "assessment_id": assessment_id,
        "candidate_id": candidate_id,
        "exam_id": exam_id,
        "type": vtype,
        "detail": detail,
        "confidence": confidence,
        "risk_score": risk,
        "screenshot_path": screenshot_path,
        "clip_path": clip_path,
        "timestamp": datetime.utcnow(),
        "reviewed": False
    }
    await db.violations.insert_one(violation)

    await db.assessments.update_one(
        {"assessment_id": assessment_id},
        {
            "$inc": {
                "violation_count": 1,
                "risk_score": risk,
                "credibility_score": -risk
            },
            "$set": {"updated_at": datetime.utcnow()}
        }
    )

    assessment = await db.assessments.find_one({"assessment_id": assessment_id})
    exam = await db.exams.find_one({"exam_id": exam_id})

    if exam and assessment and assessment.get("risk_score", 0) >= exam.get("violation_threshold", 10):
        await db.assessments.update_one(
            {"assessment_id": assessment_id},
            {"$set": {"status": "LOCKED", "threshold_reached": True, "updated_at": datetime.utcnow()}}
        )
        return {"locked": True, "violation": violation}

    return {"locked": False, "violation": violation}


async def get_warning_count(assessment_id: str, detail: str) -> int:
    db = get_db()
    result = await db.warnings.find_one({"assessment_id": assessment_id, "detail": detail})
    return result["count"] if result else 0