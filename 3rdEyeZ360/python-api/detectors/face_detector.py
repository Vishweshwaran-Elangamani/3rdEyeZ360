import cv2
import mediapipe as mp


mp_face = mp.solutions.face_detection
face_detector = mp_face.FaceDetection(
    model_selection=0,
    min_detection_confidence=0.6,
)


def _result(
    detected: bool,
    count: int,
    detail: str,
    confidence: float,
    message: str,
    candidate_action: str | None,
):
    return {
        "detected": detected,
        "count": count,
        "detail": detail,
        "confidence": confidence,
        "category": "face",
        "issue": None if detail == "ok" else detail,
        "message": message,
        "candidate_action": candidate_action,
        "typing_sensitive": False,
    }


def detect_faces(frame):
    """
    Detects whether the candidate face is visible and whether multiple faces are present.

    Returns:
        {
            "detected": bool,
            "count": int,
            "detail": str,
            "confidence": float,
            "category": "face",
            "issue": str | None,
            "message": str,
            "candidate_action": str | None,
            "typing_sensitive": False,
        }

    detail values:
        ok              -> exactly one face
        face_missing    -> no face visible
        multiple_faces  -> more than one face visible
        face_error      -> detector error, should not crash API
    """
    try:
        print("[FACE] Checking face")

        if frame is None:
            print("[FACE] Frame is None")
            return _result(
                True,
                0,
                "face_missing",
                0.0,
                "Please remain visible in the camera frame.",
                "Sit in front of the camera and keep your face visible.",
            )

        if not hasattr(frame, "shape"):
            print("[FACE] Invalid frame object")
            return _result(
                True,
                0,
                "face_missing",
                0.0,
                "Please remain visible in the camera frame.",
                "Sit in front of the camera and keep your face visible.",
            )

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_detector.process(rgb)

        if not results.detections:
            print("[FACE] No face detected")
            return _result(
                True,
                0,
                "face_missing",
                0.99,
                "Please remain visible in the camera frame.",
                "Sit in front of the camera and keep your face visible.",
            )

        count = len(results.detections)
        print(f"[FACE] Faces detected: {count}")

        if count > 1:
            print("[FACE] Multiple faces detected")
            return _result(
                True,
                count,
                "multiple_faces",
                0.95,
                "Another person appears to be visible. Only the candidate should be in view.",
                "Ensure only you are visible in the camera frame.",
            )

        print("[FACE] Face OK")
        return _result(
            False,
            1,
            "ok",
            1.0,
            "Face monitoring check passed.",
            None,
        )

    except Exception as error:
        print(f"[FACE] Detector error: {error}")
        return _result(
            False,
            0,
            "face_error",
            0.0,
            "Face detection could not be completed.",
            "Keep your face clearly visible to the camera.",
        )
