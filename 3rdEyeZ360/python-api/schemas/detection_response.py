from pydantic import BaseModel
from typing import Optional


class DetectionResult(BaseModel):
    type: str
    detected: bool
    confidence: float
    detail: Optional[str] = None

    # Detailed monitoring fields used by Electron and backend toast/policy flow
    category: Optional[str] = None
    issue: Optional[str] = None
    message: Optional[str] = None
    candidate_action: Optional[str] = None
    typing_sensitive: bool = False
