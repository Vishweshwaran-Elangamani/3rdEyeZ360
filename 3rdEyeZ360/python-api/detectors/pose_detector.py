import cv2
import mediapipe as mp


mp_face_mesh = mp.solutions.face_mesh

mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.6,
    min_tracking_confidence=0.6,
)


# FaceMesh landmark indexes used here:
# 1   -> nose tip
# 33  -> left eye outer corner
# 263 -> right eye outer corner
# 13  -> upper lip / mouth centre area
# 152 -> chin
NOSE_TIP = 1
LEFT_EYE_OUTER = 33
RIGHT_EYE_OUTER = 263
MOUTH_CENTRE = 13
CHIN = 152


# Tuned thresholds
# Lower horizontal threshold makes left/right faster than old 0.12 nose-x check.
HEAD_TURN_SOFT_THRESHOLD = 0.085
HEAD_TURN_STRONG_THRESHOLD = 0.125

# Down detection is intentionally stricter to reduce false violations while typing.
# Actual typing-aware ignore is handled in Electron using browser input tracking.
LOOKING_DOWN_RATIO_THRESHOLD = 0.70
LOOKING_DOWN_ABSOLUTE_Y_THRESHOLD = 0.70


def _safe_landmark(landmarks, index):
    try:
        return landmarks[index]
    except Exception:
        return None


def _confidence_from_ratio(value, soft_threshold, strong_threshold):
    """
    Converts a movement ratio into a stable confidence value.

    Example:
    - just crossed soft threshold -> around 0.70
    - crossed strong threshold    -> around 0.90+
    """
    abs_value = abs(value)

    if abs_value <= soft_threshold:
        return 0.0

    if abs_value >= strong_threshold:
        return 0.92

    span = strong_threshold - soft_threshold
    if span <= 0:
        return 0.80

    progress = (abs_value - soft_threshold) / span
    return round(0.70 + (progress * 0.20), 2)


def _result(
    detected: bool,
    detail: str,
    confidence: float,
    issue: str | None,
    message: str,
    candidate_action: str | None,
    typing_sensitive: bool = False,
):
    return {
        "detected": detected,
        "detail": detail,
        "confidence": confidence,
        "category": "head_pose",
        "issue": issue,
        "message": message,
        "candidate_action": candidate_action,
        "typing_sensitive": typing_sensitive,
    }


def detect_pose(frame):
    """
    Detects candidate head pose using MediaPipe FaceMesh.

    Returns detail values:
      ok
      no_face
      looking_left
      looking_right
      looking_down

    Notes:
      - Left/right detection is faster than the old nose.x-only logic.
      - Down detection is intentionally stricter to reduce false positives while typing.
      - typing_sensitive=True is returned for looking_down, so Electron can ignore it
        when the candidate has typed recently.
    """

    if frame is None:
        return _result(
            False,
            "no_frame",
            0.0,
            "no_frame",
            "Camera frame was not available.",
            "Ensure the camera is working.",
            False,
        )

    try:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    except Exception as error:
        print("[POSE] Failed to convert frame:", error)
        return _result(
            False,
            "invalid_frame",
            0.0,
            "invalid_frame",
            "Camera frame could not be processed.",
            "Ensure the camera frame is clear.",
            False,
        )

    results = mesh.process(rgb)

    if not results.multi_face_landmarks:
        print("[POSE] No face available for pose detection")
        return _result(
            False,
            "no_face",
            0.0,
            "no_face_for_pose",
            "Face is not visible, so head pose could not be checked.",
            "Remain visible in the camera frame.",
            False,
        )

    landmarks = results.multi_face_landmarks[0].landmark

    nose = _safe_landmark(landmarks, NOSE_TIP)
    left_eye = _safe_landmark(landmarks, LEFT_EYE_OUTER)
    right_eye = _safe_landmark(landmarks, RIGHT_EYE_OUTER)
    mouth = _safe_landmark(landmarks, MOUTH_CENTRE)
    chin = _safe_landmark(landmarks, CHIN)

    if not nose or not left_eye or not right_eye or not mouth:
        print("[POSE] Required landmarks missing")
        return _result(
            False,
            "landmarks_missing",
            0.0,
            "landmarks_missing",
            "Required face landmarks were not detected clearly.",
            "Keep your face clearly visible to the camera.",
            False,
        )

    eye_center_x = (left_eye.x + right_eye.x) / 2.0
    eye_center_y = (left_eye.y + right_eye.y) / 2.0
    face_width = abs(right_eye.x - left_eye.x)

    if face_width <= 0.03:
        print("[POSE] Face too small or unclear")
        return _result(
            False,
            "face_unclear",
            0.0,
            "face_unclear",
            "Face landmarks are too unclear for reliable pose detection.",
            "Keep your face clearly visible to the camera.",
            False,
        )

    horizontal_ratio = (nose.x - eye_center_x) / face_width

    # Positive/negative direction follows the old behaviour:
    # nose left of centre  -> looking_left
    # nose right of centre -> looking_right
    if horizontal_ratio < -HEAD_TURN_SOFT_THRESHOLD:
        confidence = _confidence_from_ratio(
            horizontal_ratio,
            HEAD_TURN_SOFT_THRESHOLD,
            HEAD_TURN_STRONG_THRESHOLD,
        )

        print(
            "[POSE] Head looking left",
            {
                "horizontal_ratio": round(horizontal_ratio, 3),
                "confidence": confidence,
            },
        )

        return _result(
            True,
            "looking_left",
            confidence,
            "head_looking_left",
            "Please look at the examination screen. Your head appears to be turned left.",
            "Face the exam screen.",
            False,
        )

    if horizontal_ratio > HEAD_TURN_SOFT_THRESHOLD:
        confidence = _confidence_from_ratio(
            horizontal_ratio,
            HEAD_TURN_SOFT_THRESHOLD,
            HEAD_TURN_STRONG_THRESHOLD,
        )

        print(
            "[POSE] Head looking right",
            {
                "horizontal_ratio": round(horizontal_ratio, 3),
                "confidence": confidence,
            },
        )

        return _result(
            True,
            "looking_right",
            confidence,
            "head_looking_right",
            "Please look at the examination screen. Your head appears to be turned right.",
            "Face the exam screen.",
            False,
        )

    # Down detection:
    # old logic used nose.y > 0.65, which was too aggressive.
    # This version checks both image position and relative eye-mouth geometry.
    vertical_span = max(abs(mouth.y - eye_center_y), 0.001)
    down_ratio = (nose.y - eye_center_y) / vertical_span

    chin_y = chin.y if chin else None
    chin_supports_down = chin_y is not None and chin_y > 0.82

    looking_down = (
        nose.y > LOOKING_DOWN_ABSOLUTE_Y_THRESHOLD
        and down_ratio > LOOKING_DOWN_RATIO_THRESHOLD
    ) or (
        chin_supports_down
        and down_ratio > LOOKING_DOWN_RATIO_THRESHOLD
    )

    if looking_down:
        confidence = 0.76
        if down_ratio > 0.82 or nose.y > 0.76:
            confidence = 0.86

        print(
            "[POSE] Head looking down",
            {
                "nose_y": round(nose.y, 3),
                "down_ratio": round(down_ratio, 3),
                "chin_y": round(chin_y, 3) if chin_y is not None else None,
                "confidence": confidence,
            },
        )

        return _result(
            True,
            "looking_down",
            confidence,
            "head_looking_down",
            "Please keep your face directed towards the screen.",
            "Look back at the exam screen.",
            True,
        )

    print(
        "[POSE] Head pose OK",
        {
            "horizontal_ratio": round(horizontal_ratio, 3),
            "nose_y": round(nose.y, 3),
            "down_ratio": round(down_ratio, 3),
        },
    )

    return _result(
        False,
        "ok",
        1.0,
        None,
        "Head pose monitoring check passed.",
        None,
        False,
    )
