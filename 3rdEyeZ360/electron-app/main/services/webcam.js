// Webcam capture runs in the renderer via getUserMedia.
// The Electron main process receives Base64 frames through IPC and forwards
// them to the Python AI API. This service also combines head pose and eye focus.

const axios = require("axios");

const DETECTION_URL = process.env.DETECTION_URL || "http://127.0.0.1:5001";
const DETECTION_TIMEOUT_MS = Number(process.env.DETECTION_TIMEOUT_MS || 15000);

// Eye detection is enabled by default. Set ENABLE_EYE_DETECTION=false to disable.
const ENABLE_EYE_DETECTION =
  String(process.env.ENABLE_EYE_DETECTION || "true").toLowerCase() === "true";

// Fusion configuration.
// A mild pose warning may be suppressed only when the eye detector explicitly
// confirms reliable focus on the examination screen.
const ENABLE_HEAD_EYE_FUSION =
  String(process.env.ENABLE_HEAD_EYE_FUSION || "true").toLowerCase() === "true";

// A pose result at or above this confidence remains a warning even when the
// eyes appear centred. The pose detector also returns yaw data, which is used
// as the preferred strong-turn signal when available.
const STRONG_HEAD_TURN_CONFIDENCE = Number(
  process.env.STRONG_HEAD_TURN_CONFIDENCE || 0.90,
);

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
    assessmentId: normaliseValue(
      data,
      "assessmentId",
      "assessmentid",
      "assessment_id",
    ),
    candidateId: normaliseValue(
      data,
      "candidateId",
      "candidateid",
      "candidate_id",
    ),
    examId: normaliseValue(data, "examId", "examid", "exam_id"),
  };
}

function cleanBase64Frame(frame) {
  if (!frame) return "";
  const value = String(frame);
  return value.includes(",") ? value.split(",").pop() : value;
}

function toBoolean(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  if (typeof value === "string") {
    return ["true", "1", "yes", "detected"].includes(
      value.trim().toLowerCase(),
    );
  }

  return Boolean(value);
}

function toNumber(value, defaultValue = 0) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : defaultValue;
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
  console.log("Fusion    :", ENABLE_HEAD_EYE_FUSION ? "enabled" : "disabled");
  console.log("================================");
}

function logDetectionResult(results) {
  console.log("================================");
  console.log("[PYTHON-AI] Final detection results");

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
      focus_reliable: result.focus_reliable,
      eyes_on_screen: result.eyes_on_screen,
      gaze_state: result.gaze_state,
      fusion_status: result.fusion_status,
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
      message:
        type === "eye"
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

function unwrapDetectorResult(rawResult) {
  if (!rawResult) return {};
  if (rawResult.result && typeof rawResult.result === "object") {
    return rawResult.result;
  }
  if (rawResult.data && typeof rawResult.data === "object") {
    return rawResult.data;
  }
  return rawResult;
}

function normaliseDetectionResult(detectorName, rawResult) {
  const result = unwrapDetectorResult(rawResult);

  const type = String(
    result.type ||
      result.detectiontype ||
      result.detection_type ||
      detectorName ||
      "unknown",
  ).toLowerCase();

  const detail = String(
    result.detail || result.issue || (toBoolean(result.detected) ? `${type}_detected` : "ok"),
  ).toLowerCase();

  const metadata = buildDetectionMetadata(type, detail);

  const rawEyesOnScreen = result.eyes_on_screen;

  return {
    ...result,
    type,
    detected: toBoolean(result.detected, false),
    detail,
    confidence: toNumber(result.confidence, 0),
    category: result.category || metadata.category,
    issue:
      detail === "ok"
        ? null
        : result.issue !== undefined
          ? result.issue
          : metadata.issue,
    message: result.message || metadata.message,
    candidate_action:
      result.candidate_action !== undefined
        ? result.candidate_action
        : result.candidateAction !== undefined
          ? result.candidateAction
          : metadata.candidate_action,
    typing_sensitive:
      result.typing_sensitive !== undefined
        ? toBoolean(result.typing_sensitive)
        : Boolean(metadata.typing_sensitive),

    // Preserve eye-focus fields for fusion.
    focus_reliable: toBoolean(result.focus_reliable, false),
    eyes_on_screen:
      rawEyesOnScreen === undefined || rawEyesOnScreen === null
        ? null
        : toBoolean(rawEyesOnScreen),
    gaze_state: String(result.gaze_state || "unavailable").toLowerCase(),
    gaze_x_deviation:
      result.gaze_x_deviation === null ||
      result.gaze_x_deviation === undefined
        ? null
        : toNumber(result.gaze_x_deviation, null),
    gaze_y_deviation:
      result.gaze_y_deviation === null ||
      result.gaze_y_deviation === undefined
        ? null
        : toNumber(result.gaze_y_deviation, null),
  };
}

function shouldIncludeEyeDetector() {
  return ENABLE_EYE_DETECTION;
}

async function callDetector(name, url, payload) {
  try {
    const response = await axios.post(url, payload, {
      timeout: DETECTION_TIMEOUT_MS,
      headers: { "Content-Type": "application/json" },
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
      reason: error?.response?.data || error?.message || "Detector request failed",
    };
  }
}

function isHeadTurn(result) {
  const detail = String(result?.detail || "").toLowerCase();
  return detail === "looking_left" || detail === "looking_right";
}

function isStrongHeadTurn(poseResult) {
  if (!poseResult || !isHeadTurn(poseResult)) return false;

  const angles = poseResult.angles || poseResult.metrics || {};
  const yaw = Math.abs(toNumber(angles.yaw, 0));
  const yawThreshold = Math.abs(toNumber(angles.yaw_threshold, 0));

  // The pose detector's strong boundary is approximately the active yaw
  // threshold plus 12 degrees. Prefer this geometric signal when available.
  if (yaw > 0 && yawThreshold > 0 && yaw >= yawThreshold + 12) {
    return true;
  }

  return toNumber(poseResult.confidence, 0) >= STRONG_HEAD_TURN_CONFIDENCE;
}

function makeSuppressedPoseResult(poseResult, eyeResult) {
  return {
    ...poseResult,
    detected: false,
    detail: "ok",
    confidence: 1.0,
    category: "head_pose",
    issue: null,
    message:
      "Natural head movement was allowed because reliable eye focus remained on the examination screen.",
    candidate_action: null,
    typing_sensitive: false,
    fusion_status: "pose_suppressed_by_reliable_screen_focus",
    original_pose_detail: poseResult.detail,
    original_pose_confidence: poseResult.confidence,
    eye_focus_evidence: {
      focus_reliable: eyeResult.focus_reliable,
      eyes_on_screen: eyeResult.eyes_on_screen,
      gaze_state: eyeResult.gaze_state,
      gaze_x_deviation: eyeResult.gaze_x_deviation,
      gaze_y_deviation: eyeResult.gaze_y_deviation,
    },
  };
}

function makeSuppressedEyeGazeResult(eyeResult, poseResult) {
  return {
    ...eyeResult,
    detected: false,
    detail: "ok",
    confidence: 1.0,
    issue: null,
    message:
      "The combined head-and-eye attention check produced a single head-pose result.",
    candidate_action: null,
    typing_sensitive: false,
    fusion_status: "duplicate_eye_gaze_suppressed",
    original_eye_detail: eyeResult.detail,
    original_eye_confidence: eyeResult.confidence,
    related_pose_detail: poseResult.detail,
  };
}

function applyHeadEyeFusion(results) {
  if (!ENABLE_HEAD_EYE_FUSION || !ENABLE_EYE_DETECTION) {
    return results;
  }

  const poseIndex = results.findIndex((result) => result.type === "pose");
  const eyeIndex = results.findIndex((result) => result.type === "eye");

  if (poseIndex < 0 || eyeIndex < 0) {
    return results;
  }

  const fusedResults = results.map((result) => ({ ...result }));
  const poseResult = fusedResults[poseIndex];
  const eyeResult = fusedResults[eyeIndex];

  const eyeDetail = String(eyeResult.detail || "").toLowerCase();
  const eyeGazeAway = [
    "eye_gaze_left",
    "eye_gaze_right",
    "eye_gaze_down",
  ].includes(eyeDetail);

  // Closed eyes must always remain an eye warning. Suppress the simultaneous
  // pose warning so the candidate receives one clear and relevant instruction.
  if (eyeDetail === "eyes_closed" && toBoolean(eyeResult.detected)) {
    if (isHeadTurn(poseResult)) {
      fusedResults[poseIndex] = {
        ...poseResult,
        detected: false,
        detail: "ok",
        confidence: 1.0,
        issue: null,
        message: "Head-pose warning suppressed because eyes-closed has priority.",
        candidate_action: null,
        typing_sensitive: false,
        fusion_status: "pose_suppressed_by_eyes_closed_priority",
        original_pose_detail: poseResult.detail,
      };
    }

    console.log("[HEAD-EYE FUSION] Eyes-closed result has priority");
    return fusedResults;
  }

  if (!isHeadTurn(poseResult)) {
    // Head is centred: preserve any independent eye-gaze warning.
    return fusedResults;
  }

  const strongTurn = isStrongHeadTurn(poseResult);
  const reliableScreenFocus =
    eyeResult.focus_reliable === true && eyeResult.eyes_on_screen === true;

  if (!strongTurn && reliableScreenFocus) {
    fusedResults[poseIndex] = makeSuppressedPoseResult(poseResult, eyeResult);

    console.log("[HEAD-EYE FUSION] Mild pose warning suppressed", {
      poseDetail: poseResult.detail,
      poseConfidence: poseResult.confidence,
      yaw: poseResult?.angles?.yaw,
      gazeState: eyeResult.gaze_state,
      gazeXDeviation: eyeResult.gaze_x_deviation,
      gazeYDeviation: eyeResult.gaze_y_deviation,
    });

    return fusedResults;
  }

  // When head and eyes both indicate attention away, retain one final pose
  // warning and suppress the duplicate eye-gaze warning.
  if (eyeGazeAway && toBoolean(eyeResult.detected)) {
    fusedResults[poseIndex] = {
      ...poseResult,
      message:
        "Please look at the examination screen. Combined head and eye movement indicates attention away from the screen.",
      candidate_action: "Return your head and eyes to the exam content.",
      fusion_status: "head_and_eye_away_confirmed",
      eye_focus_evidence: {
        focus_reliable: eyeResult.focus_reliable,
        eyes_on_screen: eyeResult.eyes_on_screen,
        gaze_state: eyeResult.gaze_state,
        gaze_x_deviation: eyeResult.gaze_x_deviation,
        gaze_y_deviation: eyeResult.gaze_y_deviation,
      },
    };

    fusedResults[eyeIndex] = makeSuppressedEyeGazeResult(
      eyeResult,
      poseResult,
    );

    console.log("[HEAD-EYE FUSION] Head and eye movement confirmed away", {
      poseDetail: poseResult.detail,
      eyeDetail,
    });

    return fusedResults;
  }

  if (strongTurn) {
    fusedResults[poseIndex] = {
      ...poseResult,
      fusion_status: "strong_head_turn_retained",
    };
  } else if (!eyeResult.focus_reliable) {
    fusedResults[poseIndex] = {
      ...poseResult,
      fusion_status: "pose_retained_eye_focus_unavailable",
    };
  } else {
    fusedResults[poseIndex] = {
      ...poseResult,
      fusion_status: "pose_retained_eye_focus_not_on_screen",
    };
  }

  return fusedResults;
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
    image: cleanFrame,
    image_b64: cleanFrame,
    candidate_id: candidateId,
    candidateId,
    exam_id: examId,
    examId,
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

  const rawResults = settled
    .filter((item) => item.status === "fulfilled" && item.data)
    .map((item) => item.data);

  const failures = settled.filter((item) => item.status === "rejected");
  if (failures.length) {
    console.warn("[PYTHON-AI] One or more detectors failed", failures);
  }

  const results = applyHeadEyeFusion(rawResults);

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
  console.log("Fusion    :", ENABLE_HEAD_EYE_FUSION ? "enabled" : "disabled");
  console.log("================================");

  if (
    !mainWindow ||
    mainWindow.isDestroyed?.() ||
    mainWindow.webContents?.isDestroyed?.()
  ) {
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

  if (
    mainWindow &&
    !mainWindow.isDestroyed?.() &&
    !mainWindow.webContents?.isDestroyed?.()
  ) {
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
    headEyeFusionEnabled: ENABLE_HEAD_EYE_FUSION,
  };
}

module.exports = {
  runDetection,
  startCapture,
  stopCapture,
  getCaptureState,
};
