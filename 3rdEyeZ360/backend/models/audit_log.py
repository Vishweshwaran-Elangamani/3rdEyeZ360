from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class AuditLogModel(BaseModel):
    log_id: str
    exam_id: Optional[str] = None
    assessment_id: Optional[str] = None
    user_id: str
    action: str
    reason: Optional[str] = None
    detail: Optional[str] = None
    timestamp: datetime = None