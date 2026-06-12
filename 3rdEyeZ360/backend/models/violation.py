from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ViolationModel(BaseModel):
    violation_id: str
    assessment_id: str
    candidate_id: str
    exam_id: str
    type: str
    detail: str
    confidence: float
    risk_score: int
    screenshot_path: Optional[str] = None
    clip_path: Optional[str] = None
    timestamp: datetime = None
    reviewed: bool = False