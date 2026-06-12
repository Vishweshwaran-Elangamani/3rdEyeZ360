from fastapi import APIRouter, Depends
from config.database import get_db
from middleware.auth import require_role
import uuid
from datetime import datetime

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

@router.get("/")
async def get_notifications(current_user=Depends(require_role("Admin", "Examiner", "Candidate"))):
    db = get_db()
    notifs = await db.notifications.find(
        {"user_id": current_user["user_id"]}
    ).sort("created_at", -1).to_list(50)
    return [{k: str(v) if k == "_id" else v for k, v in n.items() if k != "_id"} for n in notifs]

@router.patch("/{notification_id}/read")
async def mark_read(notification_id: str, current_user=Depends(require_role("Admin", "Examiner", "Candidate"))):
    db = get_db()
    await db.notifications.update_one({"notification_id": notification_id}, {"$set": {"read": True}})
    return {"message": "Marked as read"}