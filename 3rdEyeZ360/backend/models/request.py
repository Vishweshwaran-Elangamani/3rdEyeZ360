from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from utils.constants import RequestStatus


class RequestModel(BaseModel):
    request_id: str
    assessment_id: str
    exam_id: str
    candidate_id: str
    type: Literal["LATEENTRY", "REENTRY"]
    reason: str
    status: str = Field(default=RequestStatus.PENDING)
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True