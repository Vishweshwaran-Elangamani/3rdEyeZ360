from fastapi import APIRouter, HTTPException
from schemas.detection_request import AudioRequest
from detectors.audio_detector import detect_audio

router = APIRouter()


def _safe_result(result: dict | None) -> dict:
    result = result or {}
    detail = str(result.get("detail") or "unknown").strip().lower()

    metadata = {
        "ok": {
            "category": "voice",
            "issue": None,
            "message": "Audio monitoring check passed.",
            "candidate_action": None,
            "typing_sensitive": False,
        },
        "background_speech": {
            "category": "voice",
            "issue": "background_speech",
            "message": "Background speech detected. Please stay in a quiet environment.",
            "candidate_action": "Move to a quiet place or ask others to stop speaking.",
            "typing_sensitive": False,
        },
        "high_noise": {
            "category": "voice",
            "issue": "high_noise",
            "message": "High background noise detected. Please reduce surrounding noise.",
            "candidate_action": "Reduce surrounding noise.",
            "typing_sensitive": False,
        },
        "mic_silent": {
            "category": "voice",
            "issue": "mic_silent",
            "message": "Microphone input is very low. Please check your microphone.",
            "candidate_action": "Check that your microphone is connected and working.",
            "typing_sensitive": False,
        },
    }

    fallback = {
        "category": "voice",
        "issue": detail or "audio_issue",
        "message": "Please follow the audio monitoring instructions.",
        "candidate_action": "Correct the audio monitoring issue shown on screen.",
        "typing_sensitive": False,
    }

    info = metadata.get(detail, fallback)

    return {
        "type": "audio",
        "detected": bool(result.get("detected", False)),
        "confidence": float(result.get("confidence") or 0.0),
        "detail": detail,
        "category": result.get("category") or info["category"],
        "issue": result.get("issue") if result.get("issue") is not None else info["issue"],
        "message": result.get("message") or info["message"],
        "candidate_action": result.get("candidate_action") or info["candidate_action"],
        "typing_sensitive": bool(result.get("typing_sensitive", info["typing_sensitive"])),
    }


@router.post("/detect/audio")
async def audio_detection(req: AudioRequest):
    if not req.audio_chunk:
        raise HTTPException(status_code=400, detail="audio_chunk is required")

    try:
        result = detect_audio(req.audio_chunk)
        return _safe_result(result)
    except Exception as error:
        print("[AUDIO ROUTER] audio detection failed:", error)
        raise HTTPException(
            status_code=500,
            detail="Audio detection failed",
        )
