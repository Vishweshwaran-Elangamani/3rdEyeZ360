import cv2
import mediapipe as mp
import numpy as np


mp_face_mesh = mp.solutions.face_mesh

mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.6,
    min_tracking_confidence=0.6,
)


# MediaPipe FaceMesh landmarks used for 3D pose estimation.
NOSE_TIP = 1
CHIN = 152
LEFT_EYE_OUTER = 33
RIGHT_EYE_OUTER = 263
LEFT_MOUTH_CORNER = 61
RIGHT_MOUTH_CORNER = 291


# Canonical 3D model points used by OpenCV solvePnP.
MODEL_POINTS = np.array(
    [
        (0.0, 0.0, 0.0),
        (0.0, -63.6, -12.5),
        (-43.3, 32.7, -26.0),
        (43.3, 32.7, -26.0),
        (-28.9, -28.9, -24.1),
        (28.9, -28.9, -24.1),
    ],
    dtype=np.float64,
)


# -----------------------------------------------------------------------------
# LEFT / RIGHT CONFIGURATION
# -----------------------------------------------------------------------------
# Only yaw is used for left/right detection.
YAW_SOFT_THRESHOLD_DEGREES = 22.0
YAW_STRONG_THRESHOLD_DEGREES = 36.0

# Normal tilt or reading posture slightly increases the allowed yaw threshold.
ROLL_COMPENSATION_START_DEGREES = 10.0
PITCH_COMPENSATION_START_DEGREES = 18.0
MAX_ADDITIONAL_YAW_THRESHOLD_DEGREES = 8.0

# Change to True only if left/right results are reversed by a mirrored camera.
FLIP_YAW_DIRECTION = False


# -----------------------------------------------------------------------------
# LOOKING-DOWN CONFIGURATION
# -----------------------------------------------------------------------------
ENABLE_LOOKING_DOWN_DETECTION = True

# Learn the candidate's natural reading/camera posture before evaluating down.
NEUTRAL_CALIBRATION_FRAMES = 10

# Looking down must differ clearly from the candidate's calibrated neutral pose.
DOWN_PITCH_CHANGE_THRESHOLD_DEGREES = 12.0
DOWN_PITCH_CHANGE_STRONG_DEGREES = 24.0
DOWN_GEOMETRY_CHANGE_THRESHOLD = 0.055
DOWN_GEOMETRY_CHANGE_STRONG = 0.115

# The down condition must remain for multiple frames.
# At an 800 ms capture interval, 2 frames avoids brief reading/keyboard movement.
DOWN_CONFIRMATION_FRAMES = 2

# Neutral baseline adapts very slowly after calibration.
NEUTRAL_BASELINE_UPDATE_ALPHA = 0.02


# Angle smoothing remains responsive while reducing landmark jitter.
ANGLE_SMOOTHING_ALPHA = 0.65


_smoothed_yaw = None
_smoothed_pitch = None
_smoothed_roll = None

_neutral_pitch = None
_neutral_down_geometry = None
_neutral_samples = 0
_down_candidate_frames = 0


def _safe_landmark(landmarks, index):
    try:
        return landmarks[index]
    except Exception:
        return None


def _result(
    detected: bool,
    detail: str,
    confidence: float,
    issue: str | None,
    message: str,
    candidate_action: str | None,
    typing_sensitive: bool = False,
    metrics: dict | None = None,
):
    response = {
        "detected": detected,
        "detail": detail,
        "confidence": confidence,
        "category": "head_pose",
        "issue": issue,
        "message": message,
        "candidate_action": candidate_action,
        "typing_sensitive": typing_sensitive,
    }

    if metrics is not None:
        response["angles"] = metrics

    return response


def _ok_result(metrics=None, message="Head pose monitoring check passed."):
    return _result(
        False,
        "ok",
        1.0,
        None,
        message,
        None,
        False,
        metrics,
    )


def _normalise_angle(angle):
    value = float(angle)

    while value > 180.0:
        value -= 360.0

    while value < -180.0:
        value += 360.0

    return value


def _smooth(previous, current, alpha=ANGLE_SMOOTHING_ALPHA):
    if previous is None:
        return float(current)

    return alpha * float(current) + (1.0 - alpha) * float(previous)


def _confidence_from_value(value, soft_threshold, strong_threshold):
    absolute_value = abs(float(value))

    if absolute_value <= soft_threshold:
        return 0.0

    if absolute_value >= strong_threshold:
        return 0.94

    span = max(strong_threshold - soft_threshold, 0.001)
    progress = (absolute_value - soft_threshold) / span
    return round(0.72 + progress * 0.20, 2)


def _image_point(landmark, frame_width, frame_height):
    return (
        float(landmark.x * frame_width),
        float(landmark.y * frame_height),
    )


def _estimate_head_angles(landmarks, frame_width, frame_height):
    required_indexes = [
        NOSE_TIP,
        CHIN,
        LEFT_EYE_OUTER,
        RIGHT_EYE_OUTER,
        LEFT_MOUTH_CORNER,
        RIGHT_MOUTH_CORNER,
    ]

    selected = [_safe_landmark(landmarks, index) for index in required_indexes]

    if any(point is None for point in selected):
        return None

    image_points = np.array(
        [_image_point(point, frame_width, frame_height) for point in selected],
        dtype=np.float64,
    )

    focal_length = float(frame_width)
    camera_matrix = np.array(
        [
            [focal_length, 0.0, frame_width / 2.0],
            [0.0, focal_length, frame_height / 2.0],
            [0.0, 0.0, 1.0],
        ],
        dtype=np.float64,
    )

    distortion_coefficients = np.zeros((4, 1), dtype=np.float64)

    success, rotation_vector, _translation_vector = cv2.solvePnP(
        MODEL_POINTS,
        image_points,
        camera_matrix,
        distortion_coefficients,
        flags=cv2.SOLVEPNP_ITERATIVE,
    )

    if not success:
        return None

    rotation_matrix, _ = cv2.Rodrigues(rotation_vector)
    euler_angles, *_ = cv2.RQDecomp3x3(rotation_matrix)

    pitch = _normalise_angle(euler_angles[0])
    yaw = _normalise_angle(euler_angles[1])
    roll = _normalise_angle(euler_angles[2])

    if FLIP_YAW_DIRECTION:
        yaw = -yaw

    return pitch, yaw, roll


def _calculate_down_geometry(landmarks):
    """
    Calculates a scale-independent vertical-face ratio.

    This geometric value is compared with the candidate's own neutral baseline,
    so camera height and natural reading posture do not directly trigger a warning.
    """
    nose = _safe_landmark(landmarks, NOSE_TIP)
    chin = _safe_landmark(landmarks, CHIN)
    left_eye = _safe_landmark(landmarks, LEFT_EYE_OUTER)
    right_eye = _safe_landmark(landmarks, RIGHT_EYE_OUTER)

    if not nose or not chin or not left_eye or not right_eye:
        return None

    eye_centre_y = (left_eye.y + right_eye.y) / 2.0
    eye_to_chin = chin.y - eye_centre_y

    if abs(eye_to_chin) < 0.001:
        return None

    return float((nose.y - eye_centre_y) / eye_to_chin)


def _dynamic_yaw_threshold(pitch, roll):
    additional_threshold = 0.0

    absolute_roll = abs(float(roll))
    if absolute_roll > ROLL_COMPENSATION_START_DEGREES:
        additional_threshold += min(
            (absolute_roll - ROLL_COMPENSATION_START_DEGREES) * 0.35,
            4.0,
        )

    absolute_pitch = abs(float(pitch))
    if absolute_pitch > PITCH_COMPENSATION_START_DEGREES:
        additional_threshold += min(
            (absolute_pitch - PITCH_COMPENSATION_START_DEGREES) * 0.25,
            4.0,
        )

    return YAW_SOFT_THRESHOLD_DEGREES + min(
        additional_threshold,
        MAX_ADDITIONAL_YAW_THRESHOLD_DEGREES,
    )


def _reset_tracking():
    global _smoothed_yaw
    global _smoothed_pitch
    global _smoothed_roll
    global _neutral_pitch
    global _neutral_down_geometry
    global _neutral_samples
    global _down_candidate_frames

    _smoothed_yaw = None
    _smoothed_pitch = None
    _smoothed_roll = None
    _neutral_pitch = None
    _neutral_down_geometry = None
    _neutral_samples = 0
    _down_candidate_frames = 0


def _update_neutral_baseline(pitch, down_geometry):
    global _neutral_pitch
    global _neutral_down_geometry
    global _neutral_samples

    if _neutral_pitch is None or _neutral_down_geometry is None:
        _neutral_pitch = float(pitch)
        _neutral_down_geometry = float(down_geometry)
        _neutral_samples = 1
        return

    if _neutral_samples < NEUTRAL_CALIBRATION_FRAMES:
        sample_count = _neutral_samples + 1
        _neutral_pitch = (
            (_neutral_pitch * _neutral_samples) + float(pitch)
        ) / sample_count
        _neutral_down_geometry = (
            (_neutral_down_geometry * _neutral_samples) + float(down_geometry)
        ) / sample_count
        _neutral_samples = sample_count
        return

    # Slow adaptation handles small long-term changes in sitting position.
    alpha = NEUTRAL_BASELINE_UPDATE_ALPHA
    _neutral_pitch = (1.0 - alpha) * _neutral_pitch + alpha * float(pitch)
    _neutral_down_geometry = (
        (1.0 - alpha) * _neutral_down_geometry
        + alpha * float(down_geometry)
    )


def detect_pose(frame):
    """
    Detects head pose with MediaPipe FaceMesh and OpenCV solvePnP.

    Left/right:
      Uses yaw only, so normal tilt is not considered a turn.

    Looking down:
      Uses the candidate's calibrated neutral pitch and face geometry.
      Requires both measurements and consecutive frames.
      Brief question-reading or keyboard movement returns ok.
    """
    global _smoothed_yaw
    global _smoothed_pitch
    global _smoothed_roll
    global _down_candidate_frames

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
        frame_height, frame_width = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    except Exception as error:
        print("[POSE] Failed to prepare frame:", error)
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
        _reset_tracking()

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

    try:
        estimated_angles = _estimate_head_angles(
            landmarks,
            frame_width,
            frame_height,
        )
        down_geometry = _calculate_down_geometry(landmarks)
    except Exception as error:
        print("[POSE] Head-pose estimation failed:", error)
        estimated_angles = None
        down_geometry = None

    if estimated_angles is None or down_geometry is None:
        _down_candidate_frames = 0

        return _result(
            False,
            "landmarks_missing",
            0.0,
            "landmarks_missing",
            "Required face landmarks were not detected clearly.",
            "Keep your face clearly visible to the camera.",
            False,
        )

    raw_pitch, raw_yaw, raw_roll = estimated_angles

    _smoothed_pitch = _smooth(_smoothed_pitch, raw_pitch)
    _smoothed_yaw = _smooth(_smoothed_yaw, raw_yaw)
    _smoothed_roll = _smooth(_smoothed_roll, raw_roll)

    pitch = _smoothed_pitch
    yaw = _smoothed_yaw
    roll = _smoothed_roll

    yaw_threshold = _dynamic_yaw_threshold(pitch, roll)
    yaw_strong_threshold = max(
        YAW_STRONG_THRESHOLD_DEGREES,
        yaw_threshold + 12.0,
    )

    # Calibrate only while the face is generally directed towards the screen.
    face_is_centre_for_calibration = (
        abs(yaw) < YAW_SOFT_THRESHOLD_DEGREES
        and abs(roll) < 18.0
    )

    if (
        _neutral_samples < NEUTRAL_CALIBRATION_FRAMES
        and face_is_centre_for_calibration
    ):
        _update_neutral_baseline(pitch, down_geometry)

    pitch_change = (
        abs(pitch - _neutral_pitch)
        if _neutral_pitch is not None
        else 0.0
    )

    geometry_change = (
        down_geometry - _neutral_down_geometry
        if _neutral_down_geometry is not None
        else 0.0
    )

    metrics = {
        "yaw": round(yaw, 2),
        "pitch": round(pitch, 2),
        "roll": round(roll, 2),
        "raw_yaw": round(raw_yaw, 2),
        "raw_pitch": round(raw_pitch, 2),
        "raw_roll": round(raw_roll, 2),
        "yaw_threshold": round(yaw_threshold, 2),
        "down_geometry": round(down_geometry, 4),
        "neutral_pitch": (
            round(_neutral_pitch, 2)
            if _neutral_pitch is not None
            else None
        ),
        "neutral_down_geometry": (
            round(_neutral_down_geometry, 4)
            if _neutral_down_geometry is not None
            else None
        ),
        "pitch_change": round(pitch_change, 2),
        "geometry_change": round(geometry_change, 4),
        "neutral_samples": _neutral_samples,
        "down_candidate_frames": _down_candidate_frames,
    }

    print("[POSE] Head metrics", metrics)

    # Only yaw controls left/right.
    if yaw < -yaw_threshold:
        _down_candidate_frames = 0
        confidence = _confidence_from_value(
            yaw,
            yaw_threshold,
            yaw_strong_threshold,
        )

        return _result(
            True,
            "looking_left",
            confidence,
            "head_looking_left",
            "Please look at the examination screen. Your head appears to be turned left.",
            "Face the exam screen.",
            False,
            metrics,
        )

    if yaw > yaw_threshold:
        _down_candidate_frames = 0
        confidence = _confidence_from_value(
            yaw,
            yaw_threshold,
            yaw_strong_threshold,
        )

        return _result(
            True,
            "looking_right",
            confidence,
            "head_looking_right",
            "Please look at the examination screen. Your head appears to be turned right.",
            "Face the exam screen.",
            False,
            metrics,
        )

    calibration_complete = _neutral_samples >= NEUTRAL_CALIBRATION_FRAMES

    down_candidate = (
        ENABLE_LOOKING_DOWN_DETECTION
        and calibration_complete
        and pitch_change >= DOWN_PITCH_CHANGE_THRESHOLD_DEGREES
        and geometry_change >= DOWN_GEOMETRY_CHANGE_THRESHOLD
        and abs(yaw) < yaw_threshold
    )

    if down_candidate:
        _down_candidate_frames += 1
    else:
        # Stop immediately when the posture returns to the neutral range.
        _down_candidate_frames = 0

        # Update neutral posture only when the current frame is clearly normal.
        if calibration_complete and face_is_centre_for_calibration:
            _update_neutral_baseline(pitch, down_geometry)

    metrics["down_candidate_frames"] = _down_candidate_frames

    if _down_candidate_frames >= DOWN_CONFIRMATION_FRAMES:
        pitch_confidence = _confidence_from_value(
            pitch_change,
            DOWN_PITCH_CHANGE_THRESHOLD_DEGREES,
            DOWN_PITCH_CHANGE_STRONG_DEGREES,
        )
        geometry_confidence = _confidence_from_value(
            geometry_change,
            DOWN_GEOMETRY_CHANGE_THRESHOLD,
            DOWN_GEOMETRY_CHANGE_STRONG,
        )
        confidence = round(max(pitch_confidence, geometry_confidence), 2)

        return _result(
            True,
            "looking_down",
            confidence,
            "head_looking_down",
            "Please keep your face directed towards the screen.",
            "Look back at the exam screen.",
            True,
            metrics,
        )

    if not calibration_complete:
        return _ok_result(
            metrics,
            "Head pose calibration is in progress.",
        )

    return _ok_result(metrics)
