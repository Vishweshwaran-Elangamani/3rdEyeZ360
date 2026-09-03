from fastapi import APIRouter, HTTPException

from schemas.detection_request import FrameRequest
from schemas.detection_response import DetectionResult
from detectors.face_detector import detect_faces
from utils.frame_utils import decode_frame, resize_frame

router = APIRouter()


def _safe_result(result: dict | None) -> DetectionResult:
    result = result or {}
    detail = str(result.get("detail") or "unknown").strip().lower()

    metadata = {
        "ok": {
            "category": "face",
            "issue": None,
            "message": "Face monitoring check passed.",
            "candidate_action": None,
            "typing_sensitive": False,
        },
        "face_ok": {
            "category": "face",
            "issue": None,
            "message": "Face monitoring check passed.",
            "candidate_action": None,
            "typing_sensitive": False,
        },
        "face_missing": {
            "category": "face",
            "issue": "face_missing",
            "message": "Please remain visible in the camera frame.",
            "candidate_action": (
                "Sit in front of the camera and keep your face visible."
            ),
            "typing_sensitive": False,
        },
        "no_face": {
            "category": "face",
            "issue": "face_missing",
            "message": "Please remain visible in the camera frame.",
            "candidate_action": (
                "Sit in front of the camera and keep your face visible."
            ),
            "typing_sensitive": False,
        },
        "multiple_faces": {
            "category": "face",
            "issue": "multiple_faces",
            "message": (
                "Another person appears to be visible. "
                "Only the candidate should be in view."
            ),
            "candidate_action": (
                "Ensure only you are visible in the camera frame."
            ),
            "typing_sensitive": False,
        },
        "multiple_face": {
            "category": "face",
            "issue": "multiple_faces",
            "message": (
                "Another person appears to be visible. "
                "Only the candidate should be in view."
            ),
            "candidate_action": (
                "Ensure only you are visible in the camera frame."
            ),
            "typing_sensitive": False,
        },
    }

    fallback = {
        "category": "face",
        "issue": detail or "face_issue",
        "message": "Please follow the face monitoring instructions.",
        "candidate_action": (
            "Correct the face monitoring issue shown on screen."
        ),
        "typing_sensitive": False,
    }

    info = metadata.get(detail, fallback)

    # Backward compatibility with older face-detector detail values.
    if detail == "no_face":
        normalised_detail = "face_missing"
    elif detail == "multiple_face":
        normalised_detail = "multiple_faces"
    elif detail == "face_ok":
        normalised_detail = "ok"
    else:
        normalised_detail = detail

    return DetectionResult(
        type="face",
        detected=bool(result.get("detected", False)),
        confidence=float(result.get("confidence") or 0.0),
        detail=normalised_detail,
        category=result.get("category") or info["category"],
        issue=(
            result.get("issue")
            if result.get("issue") is not None
            else info["issue"]
        ),
        message=result.get("message") or info["message"],
        candidate_action=(
            result.get("candidate_action")
            if result.get("candidate_action") is not None
            else info["candidate_action"]
        ),
        typing_sensitive=bool(
            result.get("typing_sensitive", info["typing_sensitive"])
        ),
    )


@router.post("/detect/face", response_model=DetectionResult)
async def face_detection(req: FrameRequest):
    if not req.frame:
        raise HTTPException(status_code=400, detail="frame is required")

    try:
        frame = resize_frame(decode_frame(req.frame))
        result = detect_faces(frame)
        return _safe_result(result)
    except ValueError as error:
        print("[FACE ROUTER] invalid frame:", error)
        raise HTTPException(
            status_code=400,
            detail="Invalid camera frame",
        ) from error
    except Exception as error:
        print("[FACE ROUTER] face detection failed:", error)
        raise HTTPException(
            status_code=500,
            detail="Face detection failed",
        ) from error
