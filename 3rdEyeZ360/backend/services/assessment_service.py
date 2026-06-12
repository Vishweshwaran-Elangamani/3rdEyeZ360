from config.database import get_db
from utils.constants import AssessmentStatus, AttendanceStatus
from datetime import datetime
import uuid

async def take_attendance_snapshot(exam_id: str):
    db = get_db()
    assessments = await db.assessments.find({"exam_id": exam_id}).to_list(None)
    for a in assessments:
        if a["status"] in [AssessmentStatus.READY, AssessmentStatus.ACTIVE]:
            status = AttendanceStatus.PRESENT
        else:
            status = AttendanceStatus.ABSENT
        await db.assessments.update_one(
            {"assessment_id": a["assessment_id"]},
            {"$set": {"attendance_status": status}}
        )
        await db.attendance.insert_one({
            "attendance_id": f"ATT-{uuid.uuid4().hex[:8].upper()}",
            "assessment_id": a["assessment_id"],
            "candidate_id": a["candidate_id"],
            "exam_id": exam_id,
            "attendance_status": status,
            "captured_at": datetime.utcnow()
        })

async def log_audit(user_id: str, action: str, reason: str = None,
                    exam_id: str = None, assessment_id: str = None, detail: str = None):
    db = get_db()
    await db.audit_logs.insert_one({
        "log_id": f"AUD-{uuid.uuid4().hex[:8].upper()}",
        "user_id": user_id,
        "exam_id": exam_id,
        "assessment_id": assessment_id,
        "action": action,
        "reason": reason,
        "detail": detail,
        "timestamp": datetime.utcnow()
    })