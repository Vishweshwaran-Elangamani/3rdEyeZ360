from config.database import get_db
from datetime import datetime
import uuid

async def create_notification(user_id: str, title: str, message: str, ntype: str = "Info"):
    db = get_db()
    notif = {
        "notification_id": f"NOT-{uuid.uuid4().hex[:8].upper()}",
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": ntype,
        "read": False,
        "created_at": datetime.utcnow()
    }
    await db.notifications.insert_one(notif)
    return notif