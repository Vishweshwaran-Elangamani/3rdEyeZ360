from datetime import datetime

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    message_id: str
    exam_id: str
    candidate_id: str
    sender_id: str
    sender_role: str
    message: str
    is_broadcast: bool = False
    sent_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True