from pydantic import BaseModel
from datetime import datetime

class WarningModel(BaseModel):
    warning_id: str
    assessment_id: str
    candidate_id: str
    exam_id: str
    type: str
    detail: str
    count: int = 1
    timestamp: datetime = None