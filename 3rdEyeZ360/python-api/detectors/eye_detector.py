import cv2
import mediapipe as mp
import math


mp_face_mesh = mp.solutions.face_mesh

mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.6,
    min_tracking_confidence=0.6,
)


# Eye landmark indexes
LEFT_EYE_OUTER = 33
LEFT_EYE_INNER = 133
LEFT_EYE_TOP_1 = 159
LEFT_EYE_BOTTOM_1 = 145
LEFT_EYE_TOP_2 = 158
LEFT_EYE_BOTTOM_2 = 153

RIGHT_EYE_OUTER = 362
RIGHT_EYE_INNER = 263
RIGHT_EYE_TOP_1 = 386
RIGHT_EYE_BOTTOM_1 = 374
RIGHT_EYE_TOP_2 = 385
RIGHT_EYE_BOTTOM_2 = 380

# Iris landmarks are available when refine_landmarks=True
LEFT_IRIS = [468, 469, 470, 471, 472]
RIGHT_IRIS = [473, 474, 475, 476, 477]


# Tuned thresholds
EYE_CLOSED_EAR_THRESHOLD = 0.185

# Gaze ratio thresholds. Values are deliberately conservative to reduce false positives.
GAZE_LEFT_THRESHOLD = 0.34
GAZE_RIGHT_THRESHOLD = 0.66

# Down-gaze threshold using iris vertical position inside eye box.
GAZE_DOWN_THRESHOLD = 0.67


def _distance(point_a, point_b):
    return math.sqrt(
        ((point_a.x - point_b.x) ** 2) +
        ((point_a.y - point_b.y) ** 2)
    )


def _avg_point(landmarks, indexes):
    points = [landmarks[index] for index in indexes]
    x = sum(point.x for point in points) / len(points)
    y = sum(point.y for point in points) / len(points)
    return x, y


def _eye_aspect_ratio(
    landmarks,
    outer_index,
    inner_index,
    top_1,
    bottom_1,
    top_2,
    bottom_2,
):
    outer = landmarks[outer_index]
    inner = landmarks[inner_index]
    top_a = landmarks[top_1]
    bottom_a = landmarks[bottom_1]
    top_b = landmarks[top_2]
    bottom_b = landmarks[bottom_2]

    horizontal = _distance(outer, inner)
    vertical_a = _distance(top_a, bottom_a)
    vertical_b = _distance(top_b, bottom_b)

    if horizontal <= 0:
        return 0.0

    return (vertical_a + vertical_b) / (2.0 * horizontal)


def _eye_box_gaze_ratio(
    landmarks,
    outer_index,
    inner_index,
    top_1,
    bottom_1,
    top_2,
    bottom_2,
    iris_indexes,
):
    outer = landmarks[outer_index]
    inner = landmarks[inner_index]
    top_a = landmarks[top_1]
    bottom_a = landmarks[bottom_1]
    top_b = landmarks[top_2]
    bottom_b = landmarks[bottom_2]

    iris_x, iris_y = _avg_point(landmarks, iris_indexes)

    min_x = min(outer.x, inner.x)
    max_x = max(outer.x, inner.x)

    min_y = min(top_a.y, top_b.y)
    max_y = max(bottom_a.y, bottom_b.y)

    width = max(max_x - min_x, 0.0001)
    height = max(max_y - min_y, 0.0001)

    horizontal_ratio = (iris_x - min_x) / width
    vertical_ratio = (iris_y - min_y) / height

    return horizontal_ratio, vertical_ratio


def _average(value_a, value_b):
    return (value_a + value_b) / 2.0


def _confidence_from_distance(value, threshold, direction):
    if direction == "low":
        distance = max(0.0, threshold - value)
    else:
        distance = max(0.0, value - threshold)

    confidence = 0.72 + min(distance * 2.0, 0.22)
    return round(min(confidence, 0.94), 2)


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
        "category": "eye",
        "issue": issue,
        "message": message,
        "candidate_action": candidate_action,
        "typing_sensitive": typing_sensitive,
    }


def detect_eye(frame):
    """
    Detects eye-related monitoring issues.

    Returns one of:
      ok
      no_face
      eyes_closed
      eye_gaze_left
      eye_gaze_right
      eye_gaze_down

    Notes:
      - eye_gaze_down is typing_sensitive because candidates may look down while typing.
      - Consecutive-frame confirmation should be handled in Electron/backend policy.
    """

    if frame is None:
        return _result(
            False,
            "no_frame",
            0.0,
            "no_frame",
            "Camera frame was not available for eye detection.",
            "Ensure the camera is working.",
            False,
        )

    try:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    except Exception as error:
        print("[EYE] Failed to convert frame:", error)
        return _result(
            False,
            "invalid_frame",
            0.0,
            "invalid_frame",
            "Camera frame could not be processed for eye detection.",
            "Ensure the camera frame is clear.",
            False,
        )

    results = mesh.process(rgb)

    if not results.multi_face_landmarks:
        print("[EYE] No face detected")
        return _result(
            False,
            "no_face",
            0.0,
            "no_face",
            "Face is not visible, so eye movement could not be checked.",
            "Remain visible in the camera frame.",
            False,
        )

    landmarks = results.multi_face_landmarks[0].landmark

    try:
        left_ear = _eye_aspect_ratio(
            landmarks,
            LEFT_EYE_OUTER,
            LEFT_EYE_INNER,
            LEFT_EYE_TOP_1,
            LEFT_EYE_BOTTOM_1,
            LEFT_EYE_TOP_2,
            LEFT_EYE_BOTTOM_2,
        )

        right_ear = _eye_aspect_ratio(
            landmarks,
            RIGHT_EYE_OUTER,
            RIGHT_EYE_INNER,
            RIGHT_EYE_TOP_1,
            RIGHT_EYE_BOTTOM_1,
            RIGHT_EYE_TOP_2,
            RIGHT_EYE_BOTTOM_2,
        )

        avg_ear = _average(left_ear, right_ear)

        left_gaze_x, left_gaze_y = _eye_box_gaze_ratio(
            landmarks,
            LEFT_EYE_OUTER,
            LEFT_EYE_INNER,
            LEFT_EYE_TOP_1,
            LEFT_EYE_BOTTOM_1,
            LEFT_EYE_TOP_2,
            LEFT_EYE_BOTTOM_2,
            LEFT_IRIS,
        )

        right_gaze_x, right_gaze_y = _eye_box_gaze_ratio(
            landmarks,
            RIGHT_EYE_OUTER,
            RIGHT_EYE_INNER,
            RIGHT_EYE_TOP_1,
            RIGHT_EYE_BOTTOM_1,
            RIGHT_EYE_TOP_2,
            RIGHT_EYE_BOTTOM_2,
            RIGHT_IRIS,
        )

        avg_gaze_x = _average(left_gaze_x, right_gaze_x)
        avg_gaze_y = _average(left_gaze_y, right_gaze_y)
    except Exception as error:
        print("[EYE] Landmark calculation failed:", error)
        return _result(
            False,
            "eye_landmarks_unclear",
            0.0,
            "eye_landmarks_unclear",
            "Eye landmarks were not clear enough for reliable detection.",
            "Keep your face clearly visible to the camera.",
            False,
        )

    print(
        "[EYE] Metrics",
        {
            "left_ear": round(left_ear, 3),
            "right_ear": round(right_ear, 3),
            "avg_ear": round(avg_ear, 3),
            "avg_gaze_x": round(avg_gaze_x, 3),
            "avg_gaze_y": round(avg_gaze_y, 3),
        },
    )

    # Priority 1: eyes closed
    if avg_ear < EYE_CLOSED_EAR_THRESHOLD:
        confidence = _confidence_from_distance(
            avg_ear,
            EYE_CLOSED_EAR_THRESHOLD,
            "low",
        )

        print("[EYE] Eyes closed detected", {"avg_ear": round(avg_ear, 3)})

        return _result(
            True,
            "eyes_closed",
            confidence,
            "eyes_closed",
            "Please keep your eyes open and focused on the exam screen.",
            "Open your eyes and keep looking at the exam screen.",
            False,
        )

    # Priority 2: eye gaze left/right
    if avg_gaze_x < GAZE_LEFT_THRESHOLD:
        confidence = _confidence_from_distance(
            avg_gaze_x,
            GAZE_LEFT_THRESHOLD,
            "low",
        )

        print("[EYE] Eye gaze left detected", {"avg_gaze_x": round(avg_gaze_x, 3)})

        return _result(
            True,
            "eye_gaze_left",
            confidence,
            "eye_gaze_left",
            "Please keep your eyes on the exam screen. Eye movement to the left was detected.",
            "Keep your eyes focused on the exam content.",
            False,
        )

    if avg_gaze_x > GAZE_RIGHT_THRESHOLD:
        confidence = _confidence_from_distance(
            avg_gaze_x,
            GAZE_RIGHT_THRESHOLD,
            "high",
        )

        print("[EYE] Eye gaze right detected", {"avg_gaze_x": round(avg_gaze_x, 3)})

        return _result(
            True,
            "eye_gaze_right",
            confidence,
            "eye_gaze_right",
            "Please keep your eyes on the exam screen. Eye movement to the right was detected.",
            "Keep your eyes focused on the exam content.",
            False,
        )

    # Priority 3: gaze down
    if avg_gaze_y > GAZE_DOWN_THRESHOLD:
        confidence = _confidence_from_distance(
            avg_gaze_y,
            GAZE_DOWN_THRESHOLD,
            "high",
        )

        print("[EYE] Eye gaze down detected", {"avg_gaze_y": round(avg_gaze_y, 3)})

        return _result(
            True,
            "eye_gaze_down",
            confidence,
            "eye_gaze_down",
            "Please keep your eyes on the exam screen. Downward eye movement was detected.",
            "Keep your eyes focused on the exam content.",
            True,
        )

    print("[EYE] Eye status OK")

    return _result(
        False,
        "ok",
        1.0,
        None,
        "Eye monitoring check passed.",
        None,
        False,
    )
