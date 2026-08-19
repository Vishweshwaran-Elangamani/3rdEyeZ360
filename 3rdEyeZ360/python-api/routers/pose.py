from fastapi import APIRouter, HTTPException
from schemas.detection_request import FrameRequest
from schemas.detection_response import DetectionResult
from detectors.pose_detector import detect_pose
from utils.frame_utils import decode_frame, resize_frame

router = APIRouter()


def _safe_result(result: dict | None) -> DetectionResult:
    result = result or {}
    detail = str(result.get("detail") or "unknown").strip().lower()

    metadata = {
        "ok": {
            "category": "head_pose",
            "issue": None,
            "message": "Head pose monitoring check passed.",
            "candidate_action": None,
            "typing_sensitive": False,
        },
        "no_face": {
            "category": "head_pose",
            "issue": "no_face_for_pose",
            "message": "Face is not visible, so head pose could not be checked.",
            "candidate_action": "Remain visible in the camera frame.",
            "typing_sensitive": False,
        },
        "looking_left": {
            "category": "head_pose",
            "issue": "head_looking_left",
            "message": "Please look at the examination screen. Your head appears to be turned left.",
            "candidate_action": "Face the exam screen.",
            "typing_sensitive": False,
        },
        "looking_right": {
            "category": "head_pose",
            "issue": "head_looking_right",
            "message": "Please look at the examination screen. Your head appears to be turned right.",
            "candidate_action": "Face the exam screen.",
            "typing_sensitive": False,
        },
        "looking_down": {
            "category": "head_pose",
            "issue": "head_looking_down",
            "message": "Please keep your face directed towards the screen.",
            "candidate_action": "Look back at the exam screen.",
            "typing_sensitive": True,
        },
        "head_looking_left": {
            "category": "head_pose",
            "issue": "head_looking_left",
            "message": "Please look at the examination screen. Your head appears to be turned left.",
            "candidate_action": "Face the exam screen.",
            "typing_sensitive": False,
        },
        "head_looking_right": {
            "category": "head_pose",
            "issue": "head_looking_right",
            "message": "Please look at the examination screen. Your head appears to be turned right.",
            "candidate_action": "Face the exam screen.",
            "typing_sensitive": False,
        },
        "head_looking_down": {
            "category": "head_pose",
            "issue": "head_looking_down",
            "message": "Please keep your face directed towards the screen.",
            "candidate_action": "Look back at the exam screen.",
            "typing_sensitive": True,
        },
        "face_unclear": {
            "category": "head_pose",
            "issue": "face_unclear",
            "message": "Face landmarks are unclear, so head pose could not be checked reliably.",
            "candidate_action": "Keep your face clearly visible to the camera.",
            "typing_sensitive": False,
        },
        "landmarks_missing": {
            "category": "head_pose",
            "issue": "landmarks_missing",
            "message": "Required face landmarks were not detected clearly.",
            "candidate_action": "Keep your face clearly visible to the camera.",
            "typing_sensitive": False,
        },
    }

    fallback = {
        "category": "head_pose",
        "issue": detail or "head_pose_issue",
        "message": "Please follow the head pose monitoring instructions.",
        "candidate_action": "Correct the head pose monitoring issue shown on screen.",
        "typing_sensitive": False,
    }

    info = metadata.get(detail, fallback)

    # Backward compatible detail names. The backend still accepts looking_left/right/down,
    # while issue names provide the detailed reason.
    return DetectionResult(
        type="pose",
        detected=bool(result.get("detected", False)),
        confidence=float(result.get("confidence") or 0.0),
        detail=detail,
        category=result.get("category") or info["category"],
        issue=result.get("issue") or info["issue"],
        message=result.get("message") or info["message"],
        candidate_action=result.get("candidate_action") or info["candidate_action"],
        typing_sensitive=bool(result.get("typing_sensitive", info["typing_sensitive"])),
    )


@router.post("/detect/pose", response_model=DetectionResult)
async def pose_detection(req: FrameRequest):
    if not req.frame:
        raise HTTPException(status_code=400, detail="frame is required")

    try:
        frame = decode_frame(req.frame)
        frame = resize_frame(frame)
        result = detect_pose(frame)
        return _safe_result(result)
    except Exception as error:
        print("[POSE ROUTER] pose detection failed:", error)
        raise HTTPException(
            status_code=500,
            detail="Pose detection failed",
        )
