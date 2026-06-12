from fastapi import APIRouter
from schemas.detection_request import FrameRequest
from schemas.detection_response import DetectionResult
from detectors.phone_detector import detect_phone
from utils.frame_utils import decode_frame, resize_frame

router = APIRouter()

@router.post("/detect/phone", response_model=DetectionResult)
async def phone_detection(req: FrameRequest):
    frame = decode_frame(req.frame)
    frame = resize_frame(frame)
    result = detect_phone(frame)
    return DetectionResult(type="phone", detected=result["detected"],
                           confidence=result["confidence"], detail=result["detail"])