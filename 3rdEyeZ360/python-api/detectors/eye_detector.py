import math

import cv2
import mediapipe as mp


mp_face_mesh = mp.solutions.face_mesh
mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

# MediaPipe eye landmarks
LEFT_EYE = {
    "outer": 33, "inner": 133,
    "top1": 159, "bottom1": 145,
    "top2": 158, "bottom2": 153,
    "iris": [468, 469, 470, 471, 472],
}
RIGHT_EYE = {
    "outer": 263, "inner": 362,
    "top1": 386, "bottom1": 374,
    "top2": 385, "bottom2": 380,
    "iris": [473, 474, 475, 476, 477],
}

# Closed-eye detection
# Less aggressive than 0.19/0.72 and requires both eyes for two frames.
EYE_CLOSED_ABSOLUTE_THRESHOLD = 0.17
EYE_CLOSED_RELATIVE_FACTOR = 0.65
EYE_CLOSED_CONFIRMATION_FRAMES = 2
MIN_VALID_EAR = 0.01
MAX_VALID_EAR = 0.70
EAR_CALIBRATION_FRAMES = 5
EAR_OPEN_SAMPLE_MINIMUM = 0.19
EAR_BASELINE_UPDATE_ALPHA = 0.01

# Gaze detection
GAZE_CALIBRATION_FRAMES = 5
GAZE_HORIZONTAL_SOFT_DEVIATION = 0.09
GAZE_HORIZONTAL_STRONG_DEVIATION = 0.20
GAZE_DOWN_SOFT_DEVIATION = 0.10
GAZE_DOWN_STRONG_DEVIATION = 0.21
GAZE_CONFIRMATION_FRAMES = 1
SCREEN_FOCUS_HORIZONTAL_TOLERANCE = 0.12
SCREEN_FOCUS_VERTICAL_TOLERANCE = 0.13
MIN_EAR_FOR_GAZE = 0.14
GAZE_BASELINE_UPDATE_ALPHA = 0.01
SMOOTHING_ALPHA = 0.90

_smoothed_left_ear = None
_smoothed_right_ear = None
_smoothed_gaze_x = None
_smoothed_gaze_y = None
_open_ear_baseline = None
_open_ear_samples = 0
_neutral_gaze_x = None
_neutral_gaze_y = None
_gaze_samples = 0
_closed_frames = 0
_left_frames = 0
_right_frames = 0
_down_frames = 0


def _safe_landmark(landmarks, index):
    try:
        return landmarks[index]
    except Exception:
        return None


def _distance(a, b):
    return math.hypot(a.x - b.x, a.y - b.y)


def _average(a, b):
    return (float(a) + float(b)) / 2.0


def _smooth(previous, current):
    if previous is None:
        return float(current)
    return SMOOTHING_ALPHA * float(current) + (1.0 - SMOOTHING_ALPHA) * float(previous)


def _average_point(landmarks, indexes):
    points = [_safe_landmark(landmarks, index) for index in indexes]
    if any(point is None for point in points):
        return None
    return (
        sum(point.x for point in points) / len(points),
        sum(point.y for point in points) / len(points),
    )


def _eye_aspect_ratio(landmarks, eye):
    outer = _safe_landmark(landmarks, eye["outer"])
    inner = _safe_landmark(landmarks, eye["inner"])
    top1 = _safe_landmark(landmarks, eye["top1"])
    bottom1 = _safe_landmark(landmarks, eye["bottom1"])
    top2 = _safe_landmark(landmarks, eye["top2"])
    bottom2 = _safe_landmark(landmarks, eye["bottom2"])
    points = [outer, inner, top1, bottom1, top2, bottom2]
    if any(point is None for point in points):
        return None
    horizontal = _distance(outer, inner)
    if horizontal <= 0.0001:
        return None
    return (_distance(top1, bottom1) + _distance(top2, bottom2)) / (2.0 * horizontal)


def _eye_gaze_ratio(landmarks, eye):
    outer = _safe_landmark(landmarks, eye["outer"])
    inner = _safe_landmark(landmarks, eye["inner"])
    top1 = _safe_landmark(landmarks, eye["top1"])
    bottom1 = _safe_landmark(landmarks, eye["bottom1"])
    top2 = _safe_landmark(landmarks, eye["top2"])
    bottom2 = _safe_landmark(landmarks, eye["bottom2"])
    iris = _average_point(landmarks, eye["iris"])
    points = [outer, inner, top1, bottom1, top2, bottom2]
    if any(point is None for point in points) or iris is None:
        return None

    min_x, max_x = min(outer.x, inner.x), max(outer.x, inner.x)
    top_y = _average(top1.y, top2.y)
    bottom_y = _average(bottom1.y, bottom2.y)
    min_y, max_y = min(top_y, bottom_y), max(top_y, bottom_y)
    width = max(max_x - min_x, 0.0001)
    height = max(max_y - min_y, 0.0001)
    gaze_x = (iris[0] - min_x) / width
    gaze_y = (iris[1] - min_y) / height
    if not (-0.30 <= gaze_x <= 1.30 and -0.50 <= gaze_y <= 1.50):
        return None
    return gaze_x, gaze_y


def _result(
    detected, detail, confidence, issue, message, candidate_action,
    typing_sensitive=False, metrics=None, focus_reliable=False,
    eyes_on_screen=None, gaze_state="unavailable",
    gaze_x_deviation=None, gaze_y_deviation=None,
):
    response = {
        "detected": bool(detected),
        "detail": str(detail),
        "confidence": float(confidence),
        "category": "eye",
        "issue": issue,
        "message": message,
        "candidate_action": candidate_action,
        "typing_sensitive": bool(typing_sensitive),
        "focus_reliable": bool(focus_reliable),
        "eyes_on_screen": eyes_on_screen,
        "gaze_state": str(gaze_state),
        "gaze_x_deviation": float(gaze_x_deviation) if gaze_x_deviation is not None else None,
        "gaze_y_deviation": float(gaze_y_deviation) if gaze_y_deviation is not None else None,
    }
    if metrics is not None:
        response["metrics"] = metrics
    return response


def _ok_result(metrics=None, message="Eye monitoring check passed.", **focus):
    return _result(False, "ok", 1.0, None, message, None, False, metrics, **focus)


def _confidence(value, soft, strong):
    amount = abs(float(value))
    if amount >= strong:
        return 0.94
    if amount <= soft:
        return 0.72
    return round(0.72 + ((amount - soft) / max(strong - soft, 0.001)) * 0.22, 2)


def _reset_events():
    global _closed_frames, _left_frames, _right_frames, _down_frames
    _closed_frames = _left_frames = _right_frames = _down_frames = 0


def _reset_all():
    global _smoothed_left_ear, _smoothed_right_ear, _smoothed_gaze_x, _smoothed_gaze_y
    global _open_ear_baseline, _open_ear_samples, _neutral_gaze_x, _neutral_gaze_y, _gaze_samples
    _smoothed_left_ear = _smoothed_right_ear = None
    _smoothed_gaze_x = _smoothed_gaze_y = None
    _open_ear_baseline = None
    _open_ear_samples = 0
    _neutral_gaze_x = _neutral_gaze_y = None
    _gaze_samples = 0
    _reset_events()


def _update_ear_baseline(ear):
    global _open_ear_baseline, _open_ear_samples
    if _open_ear_baseline is None:
        _open_ear_baseline, _open_ear_samples = float(ear), 1
    elif _open_ear_samples < EAR_CALIBRATION_FRAMES:
        count = _open_ear_samples + 1
        _open_ear_baseline = (_open_ear_baseline * _open_ear_samples + float(ear)) / count
        _open_ear_samples = count
    else:
        a = EAR_BASELINE_UPDATE_ALPHA
        _open_ear_baseline = (1.0 - a) * _open_ear_baseline + a * float(ear)


def _update_gaze_baseline(x, y):
    global _neutral_gaze_x, _neutral_gaze_y, _gaze_samples
    if _neutral_gaze_x is None:
        _neutral_gaze_x, _neutral_gaze_y, _gaze_samples = float(x), float(y), 1
    elif _gaze_samples < GAZE_CALIBRATION_FRAMES:
        count = _gaze_samples + 1
        _neutral_gaze_x = (_neutral_gaze_x * _gaze_samples + float(x)) / count
        _neutral_gaze_y = (_neutral_gaze_y * _gaze_samples + float(y)) / count
        _gaze_samples = count
    else:
        a = GAZE_BASELINE_UPDATE_ALPHA
        _neutral_gaze_x = (1.0 - a) * _neutral_gaze_x + a * float(x)
        _neutral_gaze_y = (1.0 - a) * _neutral_gaze_y + a * float(y)


def detect_eye(frame):
    global _smoothed_left_ear, _smoothed_right_ear, _smoothed_gaze_x, _smoothed_gaze_y
    global _closed_frames, _left_frames, _right_frames, _down_frames

    if frame is None:
        return _ok_result(message="Camera frame was unavailable for eye monitoring.")

    try:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    except Exception as error:
        print("[EYE] Frame conversion failed:", error)
        return _ok_result(message="Eye monitoring frame could not be processed.")

    results = mesh.process(rgb)
    if not results.multi_face_landmarks:
        _reset_all()
        return _ok_result(message="Eye monitoring skipped because no face was available.")

    landmarks = results.multi_face_landmarks[0].landmark
    left_ear = _eye_aspect_ratio(landmarks, LEFT_EYE)
    right_ear = _eye_aspect_ratio(landmarks, RIGHT_EYE)

    if left_ear is None or right_ear is None:
        _reset_events()
        return _ok_result(message="Eye landmarks were temporarily unavailable.")

    if not (MIN_VALID_EAR <= left_ear <= MAX_VALID_EAR and MIN_VALID_EAR <= right_ear <= MAX_VALID_EAR):
        _reset_events()
        return _ok_result(message="Eye landmarks were temporarily unavailable.")

    _smoothed_left_ear = _smooth(_smoothed_left_ear, left_ear)
    _smoothed_right_ear = _smooth(_smoothed_right_ear, right_ear)
    left_ear = _smoothed_left_ear
    right_ear = _smoothed_right_ear
    average_ear = _average(left_ear, right_ear)

    closed_threshold = EYE_CLOSED_ABSOLUTE_THRESHOLD
    if _open_ear_baseline is not None:
        closed_threshold = max(closed_threshold, _open_ear_baseline * EYE_CLOSED_RELATIVE_FACTOR)
    closed_threshold = min(closed_threshold, 0.25)

    left_eye_closed = left_ear < closed_threshold
    right_eye_closed = right_ear < closed_threshold
    both_eyes_closed = left_eye_closed and right_eye_closed
    _closed_frames = _closed_frames + 1 if both_eyes_closed else 0

    metrics = {
        "left_ear": round(left_ear, 4),
        "right_ear": round(right_ear, 4),
        "average_ear": round(average_ear, 4),
        "closed_threshold": round(closed_threshold, 4),
        "left_eye_closed": left_eye_closed,
        "right_eye_closed": right_eye_closed,
        "both_eyes_closed": both_eyes_closed,
        "closed_frames": _closed_frames,
        "open_ear_baseline": round(_open_ear_baseline, 4) if _open_ear_baseline is not None else None,
    }
    print("[EYE] EAR metrics", metrics)

    if _closed_frames >= EYE_CLOSED_CONFIRMATION_FRAMES:
        _left_frames = _right_frames = _down_frames = 0
        return _result(
            True, "eyes_closed",
            _confidence(closed_threshold - average_ear, 0.0, max(closed_threshold * 0.45, 0.04)),
            "eyes_closed",
            "Please keep your eyes open and focused on the exam screen.",
            "Open your eyes and keep looking at the exam screen.",
            True,  # Recent keyboard activity may suppress this typing-related posture.
            metrics,
            focus_reliable=True,
            eyes_on_screen=False,
            gaze_state="eyes_closed",
        )

    if average_ear >= max(EAR_OPEN_SAMPLE_MINIMUM, closed_threshold + 0.015):
        _update_ear_baseline(average_ear)

    if average_ear < MIN_EAR_FOR_GAZE:
        _left_frames = _right_frames = _down_frames = 0
        return _ok_result(metrics, message="Eye gaze was skipped because the eyelids were narrow.")

    left_gaze = _eye_gaze_ratio(landmarks, LEFT_EYE)
    right_gaze = _eye_gaze_ratio(landmarks, RIGHT_EYE)
    if left_gaze is None or right_gaze is None:
        _left_frames = _right_frames = _down_frames = 0
        return _ok_result(metrics, message="Iris landmarks were temporarily unavailable.")

    gaze_x = _smooth(_smoothed_gaze_x, _average(left_gaze[0], right_gaze[0]))
    gaze_y = _smooth(_smoothed_gaze_y, _average(left_gaze[1], right_gaze[1]))
    _smoothed_gaze_x, _smoothed_gaze_y = gaze_x, gaze_y

    if _gaze_samples < GAZE_CALIBRATION_FRAMES:
        _update_gaze_baseline(gaze_x, gaze_y)
        _left_frames = _right_frames = _down_frames = 0
        metrics.update({"gaze_x": round(gaze_x, 4), "gaze_y": round(gaze_y, 4), "gaze_samples": _gaze_samples})
        return _ok_result(metrics, message="Eye gaze calibration is in progress.", gaze_state="calibrating")

    dx = gaze_x - _neutral_gaze_x
    dy = gaze_y - _neutral_gaze_y
    left_candidate = dx < -GAZE_HORIZONTAL_SOFT_DEVIATION
    right_candidate = dx > GAZE_HORIZONTAL_SOFT_DEVIATION
    down_candidate = dy > GAZE_DOWN_SOFT_DEVIATION

    _left_frames = _left_frames + 1 if left_candidate else 0
    _right_frames = _right_frames + 1 if right_candidate else 0
    _down_frames = _down_frames + 1 if down_candidate else 0

    eyes_on_screen = abs(dx) <= SCREEN_FOCUS_HORIZONTAL_TOLERANCE and dy <= SCREEN_FOCUS_VERTICAL_TOLERANCE
    gaze_state = "left" if left_candidate else "right" if right_candidate else "down" if down_candidate else "centre"
    metrics.update({
        "gaze_x": round(gaze_x, 4), "gaze_y": round(gaze_y, 4),
        "gaze_x_deviation": round(dx, 4), "gaze_y_deviation": round(dy, 4),
        "left_frames": _left_frames, "right_frames": _right_frames, "down_frames": _down_frames,
        "focus_reliable": True, "eyes_on_screen": eyes_on_screen, "gaze_state": gaze_state,
    })

    common = dict(metrics=metrics, focus_reliable=True, eyes_on_screen=False,
                  gaze_x_deviation=dx, gaze_y_deviation=dy)
    if _left_frames >= GAZE_CONFIRMATION_FRAMES:
        return _result(True, "eye_gaze_left", _confidence(dx, GAZE_HORIZONTAL_SOFT_DEVIATION, GAZE_HORIZONTAL_STRONG_DEVIATION),
                       "eye_gaze_left", "Please keep your eyes on the exam screen. Eye movement to the left was detected.",
                       "Keep your eyes focused on the exam content.", False, gaze_state="left", **common)
    if _right_frames >= GAZE_CONFIRMATION_FRAMES:
        return _result(True, "eye_gaze_right", _confidence(dx, GAZE_HORIZONTAL_SOFT_DEVIATION, GAZE_HORIZONTAL_STRONG_DEVIATION),
                       "eye_gaze_right", "Please keep your eyes on the exam screen. Eye movement to the right was detected.",
                       "Keep your eyes focused on the exam content.", False, gaze_state="right", **common)
    if _down_frames >= GAZE_CONFIRMATION_FRAMES:
        return _result(True, "eye_gaze_down", _confidence(dy, GAZE_DOWN_SOFT_DEVIATION, GAZE_DOWN_STRONG_DEVIATION),
                       "eye_gaze_down", "Please keep your eyes on the exam screen. Downward eye movement was detected.",
                       "Keep your eyes focused on the exam content.", True, gaze_state="down", **common)

    if not left_candidate and not right_candidate and not down_candidate:
        _update_gaze_baseline(gaze_x, gaze_y)

    return _ok_result(metrics, focus_reliable=True, eyes_on_screen=eyes_on_screen,
                      gaze_state=gaze_state, gaze_x_deviation=dx, gaze_y_deviation=dy)
