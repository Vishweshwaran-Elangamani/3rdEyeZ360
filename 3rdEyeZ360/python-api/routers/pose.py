from fastapi import APIRouter
from schemas.detection_request import FrameRequest
from schemas.detection_response import DetectionResult
from detectors.pose_detector import detect_pose
from utils.frame_utils import decode_frame, resize_frame

router = APIRouter()

@router.post("/detect/pose", response_model=DetectionResult)
async def pose_detection(req: FrameRequest):
    frame = decode_frame(req.frame)
    frame = resize_frame(frame)
    result = detect_pose(frame)
    return DetectionResult(type="pose", detected=result["detected"],
                           confidence=result["confidence"], detail=result["detail"])