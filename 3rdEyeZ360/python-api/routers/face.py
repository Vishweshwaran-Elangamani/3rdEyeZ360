from fastapi import APIRouter
from schemas.detection_request import FrameRequest
from schemas.detection_response import DetectionResult
from detectors.face_detector import detect_faces
from utils.frame_utils import decode_frame, resize_frame

router = APIRouter()

@router.post("/detect/face", response_model=DetectionResult)
async def face_detection(req: FrameRequest):
    frame = decode_frame(req.frame)
    frame = resize_frame(frame)
    result = detect_faces(frame)
    return DetectionResult(type="face", detected=result["detected"],
                           confidence=result["confidence"], detail=result["detail"])