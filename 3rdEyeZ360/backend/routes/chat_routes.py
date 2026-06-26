from fastapi import APIRouter, Depends, HTTPException

from config.database import get_db
from controllers.chat_controller import get_chat_history
from middleware.auth import require_role

router = APIRouter(prefix="/api/chat", tags=["Chat"])


async def _ensure_chat_access(db, exam_id: str, candidate_id: str, current_user: dict):
    if current_user["role"] == "Candidate":
        if current_user["user_id"] != candidate_id:
            raise HTTPException(status_code=403, detail="Access denied")

        assessment = await db.assessments.find_one({
            "exam_id": exam_id,
            "candidate_id": candidate_id,
        })
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        return

    if current_user["role"] == "Examiner":
        exam = await db.exams.find_one({"exam_id": exam_id})
        if not exam or exam.get("examiner_id") != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        return


@router.get("/{exam_id}/{candidate_id}")
async def history(
    exam_id: str,
    candidate_id: str,
    current_user=Depends(require_role("Examiner", "Admin", "Candidate")),
):
    db = get_db()
    await _ensure_chat_access(db, exam_id, candidate_id, current_user)
    return await get_chat_history(exam_id, candidate_id)