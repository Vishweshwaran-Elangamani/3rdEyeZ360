from config.database import get_db
from datetime import datetime
import uuid

async def get_chat_history(exam_id: str, candidate_id: str):
    db = get_db()
    messages = await db.chats.find(
        {"exam_id": exam_id, "candidate_id": candidate_id}
    ).sort("sent_at", 1).to_list(None)
    return [{k: str(v) if k == "_id" else v for k, v in m.items() if k != "_id"} for m in messages]

async def save_message(exam_id: str, candidate_id: str, sender_id: str,
                       sender_role: str, message: str, is_broadcast: bool = False):
    db = get_db()
    msg = {
        "message_id": f"MSG-{uuid.uuid4().hex[:8].upper()}",
        "exam_id": exam_id,
        "candidate_id": candidate_id,
        "sender_id": sender_id,
        "sender_role": sender_role,
        "message": message,
        "is_broadcast": is_broadcast,
        "sent_at": datetime.utcnow()
    }
    await db.chats.insert_one(msg)
    return {k: str(v) if k == "_id" else v for k, v in msg.items() if k != "_id"}

async def get_all_candidates_in_exam(exam_id: str):
    db = get_db()
    assessments = await db.assessments.find({"exam_id": exam_id}).to_list(None)
    return [a["candidate_id"] for a in assessments]