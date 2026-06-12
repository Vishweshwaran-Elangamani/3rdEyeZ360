from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class RequestModel(BaseModel):
    request_id: str
    assessment_id: str
    exam_id: str
    candidate_id: str
    type: str
    reason: str
    status: str = "PENDING"
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime = None