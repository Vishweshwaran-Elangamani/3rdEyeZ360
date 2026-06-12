from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class AssessmentModel(BaseModel):
    assessment_id: str
    exam_id: str
    candidate_id: str
    status: str = "ASSIGNED"
    attendance_status: Optional[str] = None
    join_time: Optional[datetime] = None
    active_time: Optional[datetime] = None
    exit_time: Optional[datetime] = None
    violation_count: int = 0
    warning_count: int = 0
    risk_score: int = 0
    credibility_score: int = 100
    integrity_score: int = 100
    threshold_reached: bool = False
    re_entry_count: int = 0
    final_status: Optional[str] = None
    created_at: datetime = None