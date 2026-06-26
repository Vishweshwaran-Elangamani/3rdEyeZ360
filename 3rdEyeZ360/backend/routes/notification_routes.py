from fastapi import APIRouter, Depends, HTTPException

from config.database import get_db
from middleware.auth import require_role

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


def _serialize(document: dict) -> dict:
    return {k: str(v) if k == "_id" else v for k, v in document.items() if k != "_id"}


@router.get("/")
async def get_notifications(
    current_user=Depends(require_role("Admin", "Examiner", "Candidate"))
):
    db = get_db()
    notifs = (
        await db.notifications.find({"user_id": current_user["user_id"]})
        .sort("created_at", -1)
        .to_list(50)
    )
    return [_serialize(n) for n in notifs]


@router.patch("/{notification_id}/read")
async def mark_read(
    notification_id: str,
    current_user=Depends(require_role("Admin", "Examiner", "Candidate")),
):
    db = get_db()

    notification = await db.notifications.find_one({
        "notification_id": notification_id,
        "user_id": current_user["user_id"],
    })
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    await db.notifications.update_one(
        {"notification_id": notification_id},
        {"$set": {"read": True}},
    )
    return {"message": "Marked as read"}


@router.patch("/read-all")
async def mark_all_read(
    current_user=Depends(require_role("Admin", "Examiner", "Candidate")),
):
    db = get_db()
    await db.notifications.update_many(
        {"user_id": current_user["user_id"], "read": False},
        {"$set": {"read": True}},
    )
    return {"message": "All notifications marked as read"}


@router.get("/unread-count")
async def unread_count(
    current_user=Depends(require_role("Admin", "Examiner", "Candidate")),
):
    db = get_db()
    count = await db.notifications.count_documents({
        "user_id": current_user["user_id"],
        "read": False,
    })
    return {"unread_count": count}