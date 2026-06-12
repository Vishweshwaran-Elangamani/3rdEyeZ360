from fastapi import APIRouter, Depends
from controllers.chat_controller import get_chat_history
from middleware.auth import require_role
import uuid
from datetime import datetime
router = APIRouter(prefix="/api/chat", tags=["Chat"])

@router.get("/{exam_id}/{candidate_id}")
async def history(exam_id: str, candidate_id: str,
                  current_user=Depends(require_role("Examiner", "Candidate"))):
    return await get_chat_history(exam_id, candidate_id)