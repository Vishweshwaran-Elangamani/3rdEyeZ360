from datetime import datetime
import uuid

from config.database import get_db


def _serialize(document: dict) -> dict:
    return {k: str(v) if k == "_id" else v for k, v in document.items() if k != "_id"}


async def create_notification(user_id: str, title: str, message: str, ntype: str = "Info"):
    db = get_db()

    clean_user_id = (user_id or "").strip()
    clean_title = (title or "").strip()
    clean_message = (message or "").strip()
    clean_type = (ntype or "Info").strip()

    notif = {
        "notification_id": f"NOT-{uuid.uuid4().hex[:8].upper()}",
        "user_id": clean_user_id,
        "title": clean_title,
        "message": clean_message,
        "type": clean_type,
        "read": False,
        "created_at": datetime.utcnow(),
    }
    await db.notifications.insert_one(notif)
    return _serialize(notif)