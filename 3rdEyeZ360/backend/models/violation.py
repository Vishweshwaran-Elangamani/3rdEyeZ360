from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ViolationModel(BaseModel):
    violation_id: str
    assessment_id: str
    candidate_id: str
    exam_id: str
    type: str
    detail: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0)
    risk_score: int = Field(ge=0)
    screenshot_b64: Optional[str] = None
    status: str = "Open"
    reviewed: bool = False
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True