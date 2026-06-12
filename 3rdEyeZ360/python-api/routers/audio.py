from fastapi import APIRouter
from schemas.detection_request import AudioRequest
from schemas.detection_response import DetectionResult
from detectors.audio_detector import detect_audio

router = APIRouter()

@router.post("/detect/audio", response_model=DetectionResult)
async def audio_detection(req: AudioRequest):
    result = detect_audio(req.audio_chunk)
    return DetectionResult(type="audio", detected=result["detected"],
                           confidence=result["confidence"], detail=result["detail"])