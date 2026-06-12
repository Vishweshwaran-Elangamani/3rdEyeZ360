from pydantic import BaseModel
from typing import Optional

class DetectionResult(BaseModel):
    type: str
    detected: bool
    confidence: float
    detail: Optional[str] = None