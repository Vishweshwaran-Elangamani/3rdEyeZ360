from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import base64
import cv2
import numpy as np

from detectors.eye_detector import detect_eye


router = APIRouter(prefix="/detect", tags=["eye"])


class EyeDetectionRequest(BaseModel):
    frame: str
    candidate_id: str | None = None
    exam_id: str | None = None


def decode_base64_frame(frame_b64: str):
    try:
        if not frame_b64:
            return None

        clean_value = str(frame_b64)

        if "," in clean_value:
            clean_value = clean_value.split(",")[-1]

        image_bytes = base64.b64decode(clean_value)
        image_array = np.frombuffer(image_bytes, dtype=np.uint8)
        frame = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

        return frame
    except Exception as error:
        print("[EYE ROUTER] Failed to decode frame:", error)
        return None


def _safe_result(result: dict | None) -> dict:
    result = result or {}
    detail = str(result.get("detail") or "unknown").strip().lower()

    metadata = {
        "ok": {
            "category": "eye",
            "issue": None,
            "message": "Eye monitoring check passed.",
            "candidate_action": None,
            "typing_sensitive": False,
        },
        "no_face": {
            "category": "eye",
            "issue": "no_face",
            "message": "Face is not visible, so eye movement could not be checked.",
            "candidate_action": "Remain visible in the camera frame.",
            "typing_sensitive": False,
        },
        "eyes_closed": {
            "category": "eye",
            "issue": "eyes_closed",
            "message": "Please keep your eyes open and focused on the exam screen.",
            "candidate_action": "Open your eyes and keep looking at the exam screen.",
            "typing_sensitive": False,
        },
        "eye_gaze_left": {
            "category": "eye",
            "issue": "eye_gaze_left",
            "message": "Please keep your eyes on the exam screen. Eye movement to the left was detected.",
            "candidate_action": "Keep your eyes focused on the exam content.",
            "typing_sensitive": False,
        },
        "eye_gaze_right": {
            "category": "eye",
            "issue": "eye_gaze_right",
            "message": "Please keep your eyes on the exam screen. Eye movement to the right was detected.",
            "candidate_action": "Keep your eyes focused on the exam content.",
            "typing_sensitive": False,
        },
        "eye_gaze_down": {
            "category": "eye",
            "issue": "eye_gaze_down",
            "message": "Please keep your eyes on the exam screen. Downward eye movement was detected.",
            "candidate_action": "Keep your eyes focused on the exam content.",
            "typing_sensitive": True,
        },
        "eye_landmarks_unclear": {
            "category": "eye",
            "issue": "eye_landmarks_unclear",
            "message": "Eye landmarks were not clear enough for reliable detection.",
            "candidate_action": "Keep your face clearly visible to the camera.",
            "typing_sensitive": False,
        },
    }

    fallback = {
        "category": "eye",
        "issue": detail or "eye_issue",
        "message": "Please follow the eye monitoring instructions.",
        "candidate_action": "Correct the eye monitoring issue shown on screen.",
        "typing_sensitive": False,
    }

    info = metadata.get(detail, fallback)

    return {
        "type": "eye",
        "detected": bool(result.get("detected", False)),
        "confidence": float(result.get("confidence") or 0.0),
        "detail": detail,
        "category": result.get("category") or info["category"],
        "issue": result.get("issue") if result.get("issue") is not None else info["issue"],
        "message": result.get("message") or info["message"],
        "candidate_action": result.get("candidate_action") or info["candidate_action"],
        "typing_sensitive": bool(result.get("typing_sensitive", info["typing_sensitive"])),
    }


@router.post("/eye")
async def eye_detection(payload: EyeDetectionRequest):
    if not payload.frame:
        raise HTTPException(
            status_code=400,
            detail="frame is required for eye detection",
        )

    frame = decode_base64_frame(payload.frame)

    if frame is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid or missing frame for eye detection",
        )

    try:
        result = detect_eye(frame)
        return _safe_result(result)
    except Exception as error:
        print("[EYE ROUTER] eye detection failed:", error)
        raise HTTPException(
            status_code=500,
            detail="Eye detection failed",
        )
