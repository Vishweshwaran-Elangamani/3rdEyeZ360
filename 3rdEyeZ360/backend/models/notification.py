from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class NotificationModel(BaseModel):
    notification_id: str
    user_id: str
    title: str
    message: str
    type: str = "Info"
    read: bool = False
    created_at: datetime = None