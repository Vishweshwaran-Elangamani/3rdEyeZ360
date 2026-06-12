from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ChatMessage(BaseModel):
    message_id: str
    exam_id: str
    candidate_id: str
    sender_id: str
    sender_role: str
    message: str
    is_broadcast: bool = False
    sent_at: datetime = None