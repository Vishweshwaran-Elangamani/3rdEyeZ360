import base64

import cv2
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from detectors.eye_detector import detect_eye


router = APIRouter(prefix="/detect", tags=["eye"])


class EyeDetectionRequest(BaseModel):
    frame: str
    candidate_id: str | None = None
    exam_id: str | None = None


def decode_base64_frame(frame_b64: str):
    """Decode a Base64 JPEG/PNG value into an OpenCV BGR frame."""
    try:
        if not frame_b64:
            return None

        clean_value = str(frame_b64).strip()

        if "," in clean_value:
            clean_value = clean_value.split(",")[-1]

        if not clean_value:
            return None

        image_bytes = base64.b64decode(clean_value, validate=False)

        if not image_bytes:
            return None

        image_array = np.frombuffer(image_bytes, dtype=np.uint8)

        if image_array.size == 0:
            return None

        return cv2.imdecode(image_array, cv2.IMREAD_COLOR)

    except Exception as error:
        print("[EYE ROUTER] Failed to decode frame:", error)
        return None


def _safe_float(value, default=None):
    if value is None:
        return default

    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_bool(value, default=False):
    if value is None:
        return default

    if isinstance(value, bool):
        return value

    if isinstance(value, (int, float)):
        return value != 0

    if isinstance(value, str):
        return value.strip().lower() in {
            "true",
            "1",
            "yes",
            "detected",
        }

    return bool(value)


def _safe_result(result: dict | None) -> dict:
    """
    Normalise an eye-detector result without dropping fusion information.

    The additional focus fields are consumed by Electron's webcam service to
    combine eye focus with head pose for a more user-friendly final decision.
    """
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
            "message": (
                "Face is not visible, so eye movement could not be checked."
            ),
            "candidate_action": "Remain visible in the camera frame.",
            "typing_sensitive": False,
        },
        "eyes_closed": {
            "category": "eye",
            "issue": "eyes_closed",
            "message": (
                "Please keep your eyes open and focused on the exam screen."
            ),
            "candidate_action": (
                "Open your eyes and keep looking at the exam screen."
            ),
            "typing_sensitive": False,
        },
        "eye_gaze_left": {
            "category": "eye",
            "issue": "eye_gaze_left",
            "message": (
                "Please keep your eyes on the exam screen. "
                "Eye movement to the left was detected."
            ),
            "candidate_action": "Keep your eyes focused on the exam content.",
            "typing_sensitive": False,
        },
        "eye_gaze_right": {
            "category": "eye",
            "issue": "eye_gaze_right",
            "message": (
                "Please keep your eyes on the exam screen. "
                "Eye movement to the right was detected."
            ),
            "candidate_action": "Keep your eyes focused on the exam content.",
            "typing_sensitive": False,
        },
        "eye_gaze_down": {
            "category": "eye",
            "issue": "eye_gaze_down",
            "message": (
                "Please keep your eyes on the exam screen. "
                "Downward eye movement was detected."
            ),
            "candidate_action": "Keep your eyes focused on the exam content.",
            "typing_sensitive": True,
        },
        "eye_landmarks_unclear": {
            "category": "eye",
            "issue": None,
            "message": "Eye landmarks were temporarily unavailable.",
            "candidate_action": None,
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

    # eye_landmarks_unclear is technical uncertainty, not candidate behaviour.
    detected = _safe_bool(result.get("detected"), False)
    if detail == "eye_landmarks_unclear":
        detected = False

    raw_eyes_on_screen = result.get("eyes_on_screen")
    eyes_on_screen = (
        _safe_bool(raw_eyes_on_screen)
        if raw_eyes_on_screen is not None
        else None
    )

    raw_issue = result.get("issue")
    issue = raw_issue if raw_issue is not None else info["issue"]

    if detail in {"ok", "eye_landmarks_unclear"}:
        issue = None

    return {
        "type": "eye",
        "detected": detected,
        "confidence": _safe_float(result.get("confidence"), 0.0),
        "detail": detail,
        "category": result.get("category") or info["category"],
        "issue": issue,
        "message": result.get("message") or info["message"],
        "candidate_action": (
            result.get("candidate_action")
            if result.get("candidate_action") is not None
            else info["candidate_action"]
        ),
        "typing_sensitive": _safe_bool(
            result.get("typing_sensitive"),
            info["typing_sensitive"],
        ),

        # Head-pose and eye-focus fusion fields.
        "focus_reliable": _safe_bool(
            result.get("focus_reliable"),
            False,
        ),
        "eyes_on_screen": eyes_on_screen,
        "gaze_state": str(
            result.get("gaze_state") or "unavailable"
        ).strip().lower(),
        "gaze_x_deviation": _safe_float(
            result.get("gaze_x_deviation"),
            None,
        ),
        "gaze_y_deviation": _safe_float(
            result.get("gaze_y_deviation"),
            None,
        ),
        "metrics": (
            result.get("metrics")
            if isinstance(result.get("metrics"), dict)
            else {}
        ),
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
        detector_result = detect_eye(frame)
        response = _safe_result(detector_result)

        print(
            "[EYE ROUTER] Result",
            {
                "detail": response["detail"],
                "detected": response["detected"],
                "focus_reliable": response["focus_reliable"],
                "eyes_on_screen": response["eyes_on_screen"],
                "gaze_state": response["gaze_state"],
                "gaze_x_deviation": response["gaze_x_deviation"],
                "gaze_y_deviation": response["gaze_y_deviation"],
            },
        )

        return response

    except Exception as error:
        print("[EYE ROUTER] Eye detection failed:", error)
        raise HTTPException(
            status_code=500,
            detail="Eye detection failed",
        ) from error
