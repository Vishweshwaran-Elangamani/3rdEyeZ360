from datetime import datetime
import uuid

from config.database import get_db
from utils.constants import AssessmentStatus, AttendanceStatus


async def take_attendance_snapshot(exam_id: str):
    db = get_db()
    assessments = await db.assessments.find({"exam_id": exam_id}).to_list(None)

    for assessment in assessments:
        if assessment.get("status") in (AssessmentStatus.READY, AssessmentStatus.ACTIVE):
            attendance_status = AttendanceStatus.PRESENT
        else:
            attendance_status = AttendanceStatus.ABSENT

        now = datetime.utcnow()

        await db.assessments.update_one(
            {"assessment_id": assessment["assessment_id"]},
            {
                "$set": {
                    "attendance_status": attendance_status,
                    "updated_at": now,
                }
            },
        )

        await db.attendance.insert_one({
            "attendance_id": f"ATT-{uuid.uuid4().hex[:8].upper()}",
            "assessment_id": assessment["assessment_id"],
            "candidate_id": assessment["candidate_id"],
            "exam_id": exam_id,
            "attendance_status": attendance_status,
            "captured_at": now,
        })


async def log_audit(
    user_id: str,
    action: str,
    reason: str = None,
    exam_id: str = None,
    assessment_id: str = None,
    detail: str = None,
):
    db = get_db()
    await db.audit_logs.insert_one({
        "log_id": f"AUD-{uuid.uuid4().hex[:8].upper()}",
        "user_id": user_id,
        "exam_id": exam_id,
        "assessment_id": assessment_id,
        "action": action,
        "reason": reason,
        "detail": detail,
        "timestamp": datetime.utcnow(),
    })


async def finalize_assessment(assessment_id: str, final_status: str, reviewed_by: str):
    db = get_db()
    now = datetime.utcnow()
    await db.assessments.update_one(
        {"assessment_id": assessment_id},
        {
            "$set": {
                "status": final_status,
                "final_status": final_status,
                "finalized_by": reviewed_by,
                "finalized_at": now,
                "updated_at": now,
            }
        },
    )
    await log_audit(
        user_id=reviewed_by,
        action="FinalizeAssessment",
        assessment_id=assessment_id,
        reason=f"Finalized with status: {final_status}",
    )