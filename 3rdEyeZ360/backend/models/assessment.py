from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from utils.constants import AssessmentStatus


class AssessmentModel(BaseModel):
    assessment_id: str
    exam_id: str
    candidate_id: str
    status: str = Field(default=AssessmentStatus.ASSIGNED)
    attendance_status: Optional[str] = None
    join_time: Optional[datetime] = None
    active_time: Optional[datetime] = None
    exit_time: Optional[datetime] = None
    violation_count: int = Field(default=0, ge=0)
    warning_count: int = Field(default=0, ge=0)
    risk_score: int = Field(default=0, ge=0)
    credibility_score: int = Field(default=100, ge=0, le=100)
    integrity_score: int = Field(default=100, ge=0, le=100)
    threshold_reached: bool = False
    re_entry_count: int = Field(default=0, ge=0)
    final_status: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True