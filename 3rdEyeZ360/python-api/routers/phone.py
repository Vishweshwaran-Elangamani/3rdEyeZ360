from fastapi import APIRouter, HTTPException
from schemas.detection_request import FrameRequest
from schemas.detection_response import DetectionResult
from detectors.phone_detector import detect_phone
from utils.frame_utils import decode_frame, resize_frame

router = APIRouter()


def _safe_result(result: dict | None) -> DetectionResult:
    result = result or {}
    detail = str(result.get("detail") or "unknown").strip().lower()

    metadata = {
        "ok": {
            "category": "device",
            "issue": None,
            "message": "Phone monitoring check passed.",
            "candidate_action": None,
            "typing_sensitive": False,
        },
        "phone_detected": {
            "category": "device",
            "issue": "phone_detected",
            "message": "Mobile phone detected. Please remove the phone from view.",
            "candidate_action": "Remove the phone from the camera view.",
            "typing_sensitive": False,
        },
        "mobile_phone": {
            "category": "device",
            "issue": "phone_detected",
            "message": "Mobile phone detected. Please remove the phone from view.",
            "candidate_action": "Remove the phone from the camera view.",
            "typing_sensitive": False,
        },
        "cell_phone": {
            "category": "device",
            "issue": "phone_detected",
            "message": "Mobile phone detected. Please remove the phone from view.",
            "candidate_action": "Remove the phone from the camera view.",
            "typing_sensitive": False,
        },
    }

    fallback = {
        "category": "device",
        "issue": detail or "device_issue",
        "message": "Please follow the device monitoring instructions.",
        "candidate_action": "Correct the device monitoring issue shown on screen.",
        "typing_sensitive": False,
    }

    info = metadata.get(detail, fallback)

    # Backward compatibility: normalise common phone labels to backend policy key.
    normalised_detail = "phone_detected" if detail in {"mobile_phone", "cell_phone"} else detail
    normalised_issue = "phone_detected" if info["issue"] == "phone_detected" else info["issue"]

    return DetectionResult(
        type="phone",
        detected=bool(result.get("detected", False)),
        confidence=float(result.get("confidence") or 0.0),
        detail=normalised_detail,
        category=result.get("category") or info["category"],
        issue=result.get("issue") or normalised_issue,
        message=result.get("message") or info["message"],
        candidate_action=result.get("candidate_action") or info["candidate_action"],
        typing_sensitive=bool(result.get("typing_sensitive", info["typing_sensitive"])),
    )


@router.post("/detect/phone", response_model=DetectionResult)
async def phone_detection(req: FrameRequest):
    if not req.frame:
        raise HTTPException(status_code=400, detail="frame is required")

    try:
        frame = decode_frame(req.frame)
        frame = resize_frame(frame)
        result = detect_phone(frame)
        return _safe_result(result)
    except Exception as error:
        print("[PHONE ROUTER] phone detection failed:", error)
        raise HTTPException(
            status_code=500,
            detail="Phone detection failed",
        )
