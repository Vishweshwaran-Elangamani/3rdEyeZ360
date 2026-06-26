from datetime import datetime
import uuid

from fastapi import HTTPException

from config.database import get_db


def _serialize(document: dict) -> dict:
    return {k: str(v) if k == "_id" else v for k, v in document.items() if k != "_id"}


async def get_chat_history(exam_id: str, candidate_id: str):
    db = get_db()
    messages = await db.chats.find(
        {"exam_id": exam_id, "candidate_id": candidate_id}
    ).sort("sent_at", 1).to_list(None)
    return [_serialize(m) for m in messages]


async def save_message(
    exam_id: str,
    candidate_id: str,
    sender_id: str,
    sender_role: str,
    message: str,
    is_broadcast: bool = False
):
    db = get_db()

    clean_message = (message or "").strip()
    if not exam_id or not candidate_id:
        raise HTTPException(status_code=400, detail="exam_id and candidate_id are required")
    if not sender_id or not sender_role:
        raise HTTPException(status_code=400, detail="sender_id and sender_role are required")
    if not clean_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    msg = {
        "message_id": f"MSG-{uuid.uuid4().hex[:8].upper()}",
        "exam_id": exam_id,
        "candidate_id": candidate_id,
        "sender_id": sender_id,
        "sender_role": sender_role,
        "message": clean_message,
        "is_broadcast": bool(is_broadcast),
        "sent_at": datetime.utcnow(),
    }
    await db.chats.insert_one(msg)
    return _serialize(msg)


async def get_all_candidates_in_exam(exam_id: str):
    db = get_db()
    assessments = await db.assessments.find({"exam_id": exam_id}).to_list(None)
    return [a["candidate_id"] for a in assessments if a.get("candidate_id")]