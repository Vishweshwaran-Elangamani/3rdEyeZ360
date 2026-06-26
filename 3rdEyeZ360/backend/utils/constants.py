class AssessmentStatus:
    ASSIGNED = "ASSIGNED"
    AVAILABLE = "AVAILABLE"
    READY = "READY"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    INTERRUPTED = "INTERRUPTED"
    LOCKED = "LOCKED"
    COMPLETED = "COMPLETED"
    TERMINATED = "TERMINATED"

    LATEENTRY_REQUESTED = "LATEENTRY_REQUESTED"
    LATEENTRY_APPROVED = "LATEENTRY_APPROVED"
    LATEENTRY_REJECTED = "LATEENTRY_REJECTED"

    REENTRY_REQUESTED = "REENTRY_REQUESTED"
    REENTRY_APPROVED = "REENTRY_APPROVED"
    REENTRY_REJECTED = "REENTRY_REJECTED"


class AttendanceStatus:
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    LATE_APPROVED = "LATE_APPROVED"
    LATE_REJECTED = "LATE_REJECTED"


class ViolationType:
    FACE_MISSING = "face_missing"
    MULTIPLE_FACE = "multiple_face"
    PHONE_DETECTED = "phone_detected"
    LOOKING_AWAY = "looking_away"
    NOISE_VIOLATION = "noise_violation"
    RESTRICTED_APP = "restricted_app"
    MULTIPLE_MONITOR = "multiple_monitor"
    CHARGER_REMOVED = "charger_removed"
    BACKGROUND_SPEECH = "background_speech"
    LOUD_NOISE = "loud_noise"
    MIC_SILENT = "mic_silent"


class RequestStatus:
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class UserRole:
    ADMIN = "Admin"
    EXAMINER = "Examiner"
    CANDIDATE = "Candidate"


TOASTER_MESSAGES: dict[str, tuple[str, str]] = {
    "face_missing": (
        "Please face your camera - we need to see your face clearly",
        "warning",
    ),
    "multiple_face": (
        "Only you should be visible - ensure no one else is in view",
        "warning",
    ),
    "multiple_faces": (
        "Only you should be visible - ensure no one else is in view",
        "warning",
    ),
    "looking_left": (
        "Keep your eyes on the screen - looking away may be flagged",
        "info",
    ),
    "looking_right": (
        "Keep your eyes on the screen - looking away may be flagged",
        "info",
    ),
    "looking_down": (
        "Please look at your screen, not downward",
        "info",
    ),
    "looking_away": (
        "Keep your eyes on the screen - looking away may be flagged",
        "info",
    ),
    "phone_detected": (
        "A phone was detected - please keep your desk clear",
        "warning",
    ),
    "background_speech": (
        "Background voices detected - ensure you are in a quiet room",
        "warning",
    ),
    "loud_noise": (
        "Loud noise detected - please maintain a quiet environment",
        "warning",
    ),
    "noise_violation": (
        "Background noise detected - please maintain a quiet environment",
        "warning",
    ),
    "mic_silent": (
        "Your microphone seems off - please check it is connected",
        "info",
    ),
    "restricted_app": (
        "A restricted application was detected - please close it immediately",
        "warning",
    ),
    "multiple_monitor": (
        "Multiple monitors detected - disconnect any extra display",
        "warning",
    ),
    "charger_removed": (
        "Your charger was removed - reconnect it immediately",
        "warning",
    ),
}


VIOLATION_SCORES: dict[str, int] = {
    ViolationType.FACE_MISSING: 5,
    ViolationType.MULTIPLE_FACE: 10,
    ViolationType.PHONE_DETECTED: 15,
    ViolationType.LOOKING_AWAY: 3,
    ViolationType.NOISE_VIOLATION: 5,
    ViolationType.RESTRICTED_APP: 10,
    ViolationType.MULTIPLE_MONITOR: 8,
    ViolationType.CHARGER_REMOVED: 2,
    ViolationType.BACKGROUND_SPEECH: 5,
    ViolationType.LOUD_NOISE: 5,
    ViolationType.MIC_SILENT: 2,
}