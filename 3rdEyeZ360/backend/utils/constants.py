# Assessment statuses
class AssessmentStatus:
    ASSIGNED = "ASSIGNED"
    AVAILABLE = "AVAILABLE"
    READY = "READY"
    ACTIVE = "ACTIVE"
    INTERRUPTED = "INTERRUPTED"
    LOCKED = "LOCKED"
    COMPLETED = "COMPLETED"
    TERMINATED = "TERMINATED"

# Attendance statuses
class AttendanceStatus:
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    LATE_APPROVED = "LATE_APPROVED"
    LATE_REJECTED = "LATE_REJECTED"

# Violation types
class ViolationType:
    FACE_MISSING = "FaceMissing"
    MULTIPLE_FACES = "MultipleFaces"
    PHONE_DETECTED = "PhoneDetected"
    LOOKING_AWAY = "LookingAway"
    BACKGROUND_SPEECH = "BackgroundSpeech"
    LOUD_NOISE = "LoudNoise"
    MIC_SILENT = "MicSilent"

# Request statuses
class RequestStatus:
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

# User roles
class UserRole:
    ADMIN = "Admin"
    EXAMINER = "Examiner"
    CANDIDATE = "Candidate"

# Toaster messages mapped to detection details
TOASTER_MESSAGES = {
    "face_missing":       ("👁️ Please face your camera — we need to see your face clearly", "warning"),
    "multiple_faces":     ("👥 Only you should be visible — ensure no one is behind you", "warning"),
    "looking_left":       ("👀 Keep your eyes on the screen — looking away may be flagged", "info"),
    "looking_right":      ("👀 Keep your eyes on the screen — looking away may be flagged", "info"),
    "looking_down":       ("📋 Please look at your screen, not downward", "info"),
    "phone_detected":     ("📵 A phone was detected — please keep your desk clear", "warning"),
    "background_speech":  ("🔊 Background voices detected — ensure you are in a quiet room", "warning"),
    "loud_noise":         ("🔈 Loud noise detected — please maintain a quiet environment", "warning"),
    "mic_silent":         ("🎙️ Your microphone seems off — please check it is connected", "info"),
}

# Violation scores for credibility calculation
VIOLATION_SCORES = {
    ViolationType.FACE_MISSING:     5,
    ViolationType.MULTIPLE_FACES:   10,
    ViolationType.PHONE_DETECTED:   15,
    ViolationType.LOOKING_AWAY:     3,
    ViolationType.BACKGROUND_SPEECH: 5,
    ViolationType.LOUD_NOISE:       5,
    ViolationType.MIC_SILENT:       2,
}