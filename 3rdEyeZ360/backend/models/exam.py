from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ExamModel(BaseModel):
    exam_id: str
    name: str
    description: Optional[str] = ""
    examiner_id: str
    date: str
    start_time: str
    end_time: str
    duration_minutes: int
    violation_threshold: int = 10
    allowed_websites: List[str] = []
    instructions: Optional[str] = ""
    status: str = "Draft"
    created_at: datetime = None 