// Webcam capture runs in renderer via getUserMedia.
// Main process receives base64 frames through IPC and forwards them to the Python AI API.

const axios = require("axios");

const DETECTION_URL = process.env.DETECTION_URL || "http://127.0.0.1:5001";
const DETECTION_TIMEOUT_MS = Number(process.env.DETECTION_TIMEOUT_MS || 15000);

// Enable after creating:
// python-api/detectors/eye_detector.py
// python-api/routers/eye.py
// POST /detect/eye
const ENABLE_EYE_DETECTION =
  String(process.env.ENABLE_EYE_DETECTION || "false").toLowerCase() === "true";

let sessionData = null;
let captureRunning = false;

function normaliseValue(data, ...keys) {
  for (const key of keys) {
    const value = data?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function getSessionIds(data = {}) {
  return {
    assessmentId: normaliseValue(data, "assessmentId", "assessmentid", "assessment_id"),
    candidateId: normaliseValue(data, "candidateId", "candidateid", "candidate_id"),
    examId: normaliseValue(data, "examId", "examid", "exam_id"),
  };
}

function cleanBase64Frame(frame) {
  if (!frame) return "";
  const value = String(frame);
  return value.includes(",") ? value.split(",").pop() : value;
}

function logDetectionStart(ids, frame) {
  console.log("================================");
  console.log("[PYTHON-AI] Detection request started");
  console.log("Assessment:", ids.assessmentId);
  console.log("Candidate :", ids.candidateId);
  console.log("Exam      :", ids.examId);
  console.log("Frame     :", frame ? `${frame.length} chars` : "missing");
  console.log("API       :", DETECTION_URL);
  console.log("Eye det.  :", ENABLE_EYE_DETECTION ? "enabled" : "disabled");
  console.log("================================");
}

function logDetectionResult(results) {
  console.log("================================");
  console.log("[PYTHON-AI] Detection results");

  for (const result of results) {
    console.log(`[${String(result.type || "unknown").toUpperCase()}]`, {
      detected: result.detected,
      detail: result.detail,
      confidence: result.confidence,
      category: result.category,
      issue: result.issue,
      message: result.message,
      candidate_action: result.candidate_action,
      typing_sensitive: result.typing_sensitive,
    });
  }

  console.log("================================");
}

function buildDetectionMetadata(type, detail) {
  const key = String(detail || "").toLowerCase();

  const metadata = {
    ok: {
      category: type || "monitoring",
      issue: null,
      message: "Monitoring check passed.",
      candidate_action: null,
      typing_sensitive: false,
    },

    no_face: {
      category: type === "eye" ? "eye" : "face",
      issue: type === "eye" ? "eye_no_face" : "no_face_for_pose",
      message: type === "eye"
        ? "Face is not visible, so eye movement could not be checked."
        : "Face is not visible, so this check could not be completed.",
      candidate_action: "Remain visible in the camera frame.",
      typing_sensitive: false,
    },

    face_missing: {
      category: "face",
      issue: "face_missing",
      message: "Please remain visible in the camera frame.",
      candidate_action: "Sit in front of the camera and keep your face visible.",
      typing_sensitive: false,
    },

    multiple_faces: {
      category: "face",
      issue: "multiple_faces",
      message:
        "Another person appears to be visible. Only the candidate should be in view.",
      candidate_action: "Ensure only you are visible in the camera frame.",
      typing_sensitive: false,
    },

    looking_left: {
      category: "head_pose",
      issue: "head_looking_left",
      message:
        "Please look at the examination screen. Your head appears to be turned left.",
      candidate_action: "Face the exam screen.",
      typing_sensitive: false,
    },

    looking_right: {
      category: "head_pose",
      issue: "head_looking_right",
      message:
        "Please look at the examination screen. Your head appears to be turned right.",
      candidate_action: "Face the exam screen.",
      typing_sensitive: false,
    },

    looking_down: {
      category: "head_pose",
      issue: "head_looking_down",
      message: "Please keep your face directed towards the screen.",
      candidate_action: "Look back at the exam screen.",
      typing_sensitive: true,
    },

    head_looking_left: {
      category: "head_pose",
      issue: "head_looking_left",
      message:
        "Please look at the examination screen. Your head appears to be turned left.",
      candidate_action: "Face the exam screen.",
      typing_sensitive: false,
    },

    head_looking_right: {
      category: "head_pose",
      issue: "head_looking_right",
      message:
        "Please look at the examination screen. Your head appears to be turned right.",
      candidate_action: "Face the exam screen.",
      typing_sensitive: false,
    },

    head_looking_down: {
      category: "head_pose",
      issue: "head_looking_down",
      message: "Please keep your face directed towards the screen.",
      candidate_action: "Look back at the exam screen.",
      typing_sensitive: true,
    },

    phone_detected: {
      category: "device",
      issue: "phone_detected",
      message: "Mobile phone detected. Please remove the phone from view.",
      candidate_action: "Remove the phone from the camera view.",
      typing_sensitive: false,
    },

    eyes_closed: {
      category: "eye",
      issue: "eyes_closed",
      message: "Please keep your eyes open and focused on the exam screen.",
      candidate_action: "Open your eyes and keep looking at the exam screen.",
      typing_sensitive: false,
    },

    eye_gaze_left: {
      category: "eye",
      issue: "eye_gaze_left",
      message:
        "Please keep your eyes on the exam screen. Eye movement to the left was detected.",
      candidate_action: "Keep your eyes focused on the exam content.",
      typing_sensitive: false,
    },

    eye_gaze_right: {
      category: "eye",
      issue: "eye_gaze_right",
      message:
        "Please keep your eyes on the exam screen. Eye movement to the right was detected.",
      candidate_action: "Keep your eyes focused on the exam content.",
      typing_sensitive: false,
    },

    eye_gaze_down: {
      category: "eye",
      issue: "eye_gaze_down",
      message:
        "Please keep your eyes on the exam screen. Downward eye movement was detected.",
      candidate_action: "Keep your eyes focused on the exam content.",
      typing_sensitive: true,
    },

    background_speech: {
      category: "voice",
      issue: "background_speech",
      message: "Background speech detected. Please stay in a quiet environment.",
      candidate_action: "Move to a quiet place or ask others to stop speaking.",
      typing_sensitive: false,
    },

    high_noise: {
      category: "voice",
      issue: "high_noise",
      message: "High background noise detected. Please reduce surrounding noise.",
      candidate_action: "Reduce surrounding noise.",
      typing_sensitive: false,
    },

    mic_silent: {
      category: "voice",
      issue: "mic_silent",
      message: "Microphone input is very low. Please check your microphone.",
      candidate_action: "Check that your microphone is connected and working.",
      typing_sensitive: false,
    },

    charger_disconnected: {
      category: "power",
      issue: "charger_disconnected",
      message: "Charger is disconnected. Please connect your charger.",
      candidate_action: "Connect your charger.",
      typing_sensitive: false,
    },

    charger_connected: {
      category: "power",
      issue: "charger_connected",
      message: "Charger connected.",
      candidate_action: null,
      typing_sensitive: false,
    },

    battery_low: {
      category: "power",
      issue: "battery_low",
      message: "Battery level is low. Please connect your charger.",
      candidate_action: "Connect your charger.",
      typing_sensitive: false,
    },
  };

  return (
    metadata[key] || {
      category: type || "monitoring",
      issue: key || "unknown_issue",
      message: "Please follow the exam monitoring instructions.",
      candidate_action: "Correct the monitoring issue shown on screen.",
      typing_sensitive: false,
    }
  );
}

function normaliseDetectionResult(detectorName, rawResult) {
  const result = rawResult || {};

  const type = String(
    result.type ||
      result.detectiontype ||
      result.detection_type ||
      detectorName ||
      "unknown",
  ).toLowerCase();

  const detail = String(result.detail || result.issue || "unknown").toLowerCase();
  const metadata = buildDetectionMetadata(type, detail);

  return {
    ...result,
    type,
    detected: Boolean(result.detected),
    detail,
    confidence:
      typeof result.confidence === "number"
        ? result.confidence
        : Number(result.confidence || 0),
    category: result.category || metadata.category,
    issue: result.issue || metadata.issue,
    message: result.message || metadata.message,
    candidate_action:
      result.candidate_action || result.candidateAction || metadata.candidate_action,
    typing_sensitive:
      result.typing_sensitive !== undefined
        ? Boolean(result.typing_sensitive)
        : Boolean(metadata.typing_sensitive),
  };
}

function shouldIncludeEyeDetector() {
  return ENABLE_EYE_DETECTION;
}

async function callDetector(name, url, payload) {
  try {
    const response = await axios.post(url, payload, {
      timeout: DETECTION_TIMEOUT_MS,
    });

    const normalised = normaliseDetectionResult(name, response.data);

    console.log(`[PYTHON-AI] ${name} detector OK`, normalised);

    return {
      status: "fulfilled",
      detector: name,
      data: normalised,
    };
  } catch (error) {
    console.log(`[PYTHON-AI] ${name} detector failed`, {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
    });

    return {
      status: "rejected",
      detector: name,
      reason: error?.message || "Detector request failed",
    };
  }
}

async function runDetection(frame, assessmentId, candidateId, examId) {
  const cleanFrame = cleanBase64Frame(frame);
  const ids = { assessmentId, candidateId, examId };

  if (!cleanFrame) {
    console.warn("[PYTHON-AI] Detection skipped because frame is missing.", ids);
    return [];
  }

  if (!assessmentId || !candidateId || !examId) {
    console.warn("[PYTHON-AI] Detection running with missing identifiers.", ids);
  }

  const payload = {
    frame: cleanFrame,
    candidate_id: candidateId,
    exam_id: examId,
  };

  logDetectionStart(ids, cleanFrame);

  const detectorCalls = [
    callDetector("face", `${DETECTION_URL}/detect/face`, payload),
    callDetector("phone", `${DETECTION_URL}/detect/phone`, payload),
    callDetector("pose", `${DETECTION_URL}/detect/pose`, payload),
  ];

  if (shouldIncludeEyeDetector()) {
    detectorCalls.push(
      callDetector("eye", `${DETECTION_URL}/detect/eye`, payload),
    );
  }

  const settled = await Promise.all(detectorCalls);

  const results = settled
    .filter((item) => item.status === "fulfilled" && item.data)
    .map((item) => item.data);

  logDetectionResult(results);

  return results;
}

function startCapture(data, mainWindow) {
  const ids = getSessionIds(data);

  sessionData = {
    ...data,
    ...ids,
  };

  captureRunning = true;

  console.log("================================");
  console.log("[WEBCAM] Capture requested from ActiveExam");
  console.log("Assessment:", ids.assessmentId);
  console.log("Candidate :", ids.candidateId);
  console.log("Exam      :", ids.examId);
  console.log("Eye det.  :", ENABLE_EYE_DETECTION ? "enabled" : "disabled");
  console.log("================================");

  if (!mainWindow || mainWindow.isDestroyed?.() || mainWindow.webContents?.isDestroyed?.()) {
    console.warn("[WEBCAM] Cannot start capture because mainWindow is unavailable.");
    return;
  }

  mainWindow.webContents.send("start-webcam-capture", sessionData);
  console.log("[WEBCAM] start-webcam-capture sent to renderer.");
}

function stopCapture(mainWindow) {
  captureRunning = false;

  console.log("================================");
  console.log("[WEBCAM] Capture stop requested");
  console.log("Previous Session:", sessionData);
  console.log("================================");

  if (mainWindow && !mainWindow.isDestroyed?.() && !mainWindow.webContents?.isDestroyed?.()) {
    mainWindow.webContents.send("stop-webcam-capture");
    console.log("[WEBCAM] stop-webcam-capture sent to renderer.");
  } else {
    console.warn("[WEBCAM] Renderer not available while stopping capture.");
  }

  sessionData = null;
}

function getCaptureState() {
  return {
    captureRunning,
    sessionData,
    detectionUrl: DETECTION_URL,
    eyeDetectionEnabled: ENABLE_EYE_DETECTION,
  };
}

module.exports = {
  runDetection,
  startCapture,
  stopCapture,
  getCaptureState,
};
