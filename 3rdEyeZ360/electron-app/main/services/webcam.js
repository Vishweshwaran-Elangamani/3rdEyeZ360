// Webcam capture runs in the renderer through getUserMedia.
// Electron receives Base64 frames through IPC, sends them to the Python AI
// detectors, combines pose and eye results, and returns evidence-ready results.

const axios = require("axios");

const DETECTION_URL = process.env.DETECTION_URL || "http://127.0.0.1:5001";
const DETECTION_TIMEOUT_MS = Number(process.env.DETECTION_TIMEOUT_MS || 15000);
const ENABLE_EYE_DETECTION =
  String(process.env.ENABLE_EYE_DETECTION || "true").toLowerCase() === "true";
const ENABLE_HEAD_EYE_FUSION =
  String(process.env.ENABLE_HEAD_EYE_FUSION || "true").toLowerCase() === "true";
const STRONG_HEAD_TURN_CONFIDENCE = Number(
  process.env.STRONG_HEAD_TURN_CONFIDENCE || 0.9,
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

function getMonitoringMode(data = {}) {
  const mode = String(
    normaliseValue(data, "monitoringMode", "monitoring_mode") || "full",
  ).toLowerCase();
  return mode === "basic" ? "basic" : "full";
}

function cleanBase64Frame(frame) {
  if (!frame) return "";
  const value = String(frame).trim();
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

function logDetectionStart(ids, frame, monitoringMode) {
  console.log("================================");
  console.log("[PYTHON-AI] Detection request started");
  console.log("Assessment:", ids.assessmentId);
  console.log("Candidate :", ids.candidateId);
  console.log("Exam      :", ids.examId);
  console.log("Frame     :", frame ? `${frame.length} chars` : "missing");
  console.log("API       :", DETECTION_URL);
  console.log("Eye det.  :", ENABLE_EYE_DETECTION ? "enabled" : "disabled");
  console.log("Fusion    :", ENABLE_HEAD_EYE_FUSION ? "enabled" : "disabled");
  console.log("Mode      :", monitoringMode);
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
      screenshot_available: Boolean(result.screenshotb64),
    });
  }
  console.log("================================");
}

function buildDetectionMetadata(type, detail) {
  const key = String(detail || "").toLowerCase();
  const metadata = {
    ok: [type || "monitoring", null, "Monitoring check passed.", null, false],
    camera_unavailable: ["camera", "camera_unavailable", "Camera is switched off or unavailable.", "Turn on the camera and keep the candidate visible.", false],
    no_face: [type === "eye" ? "eye" : "face", type === "eye" ? "eye_no_face" : "no_face_for_pose", type === "eye" ? "Face is not visible, so eye movement could not be checked." : "Face is not visible, so this check could not be completed.", "Remain visible in the camera frame.", false],
    face_missing: ["face", "face_missing", "Please remain visible in the camera frame.", "Sit in front of the camera and keep your face visible.", false],
    multiple_faces: ["face", "multiple_faces", "Another person appears to be visible. Only the candidate should be in view.", "Ensure only you are visible in the camera frame.", false],
    looking_left: ["head_pose", "head_looking_left", "Please look at the examination screen. Your head appears to be turned left.", "Face the exam screen.", false],
    looking_right: ["head_pose", "head_looking_right", "Please look at the examination screen. Your head appears to be turned right.", "Face the exam screen.", false],
    looking_down: ["head_pose", "head_looking_down", "Please keep your face directed towards the screen.", "Look back at the exam screen.", true],
    head_looking_left: ["head_pose", "head_looking_left", "Please look at the examination screen. Your head appears to be turned left.", "Face the exam screen.", false],
    head_looking_right: ["head_pose", "head_looking_right", "Please look at the examination screen. Your head appears to be turned right.", "Face the exam screen.", false],
    head_looking_down: ["head_pose", "head_looking_down", "Please keep your face directed towards the screen.", "Look back at the exam screen.", true],
    phone_detected: ["device", "phone_detected", "Mobile phone detected. Please remove the phone from view.", "Remove the phone from the camera view.", false],
    eyes_closed: ["eye", "eyes_closed", "Please keep your eyes open and focused on the exam screen.", "Open your eyes and keep looking at the exam screen.", false],
    eye_gaze_left: ["eye", "eye_gaze_left", "Please keep your eyes on the exam screen. Eye movement to the left was detected.", "Keep your eyes focused on the exam content.", false],
    eye_gaze_right: ["eye", "eye_gaze_right", "Please keep your eyes on the exam screen. Eye movement to the right was detected.", "Keep your eyes focused on the exam content.", false],
    eye_gaze_down: ["eye", "eye_gaze_down", "Please keep your eyes on the exam screen. Downward eye movement was detected.", "Keep your eyes focused on the exam content.", true],
    background_speech: ["voice", "background_speech", "Background speech detected. Please stay in a quiet environment.", "Move to a quiet place or ask others to stop speaking.", false],
    high_noise: ["voice", "high_noise", "High background noise detected. Please reduce surrounding noise.", "Reduce surrounding noise.", false],
    mic_silent: ["voice", "mic_silent", "Microphone input is very low. Please check your microphone.", "Check that your microphone is connected and working.", false],
  };
  const item = metadata[key] || [type || "monitoring", key || "unknown_issue", "Please follow the exam monitoring instructions.", "Correct the monitoring issue shown on screen.", false];
  return {
    category: item[0],
    issue: item[1],
    message: item[2],
    candidate_action: item[3],
    typing_sensitive: item[4],
  };
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
    result.detail ||
      result.issue ||
      (toBoolean(result.detected) ? `${type}_detected` : "ok"),
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
    focus_reliable: toBoolean(result.focus_reliable, false),
    eyes_on_screen:
      rawEyesOnScreen === undefined || rawEyesOnScreen === null
        ? null
        : toBoolean(rawEyesOnScreen),
    gaze_state: String(result.gaze_state || "unavailable").toLowerCase(),
    gaze_x_deviation:
      result.gaze_x_deviation === null || result.gaze_x_deviation === undefined
        ? null
        : toNumber(result.gaze_x_deviation, null),
    gaze_y_deviation:
      result.gaze_y_deviation === null || result.gaze_y_deviation === undefined
        ? null
        : toNumber(result.gaze_y_deviation, null),
  };
}

async function callDetector(name, url, payload) {
  try {
    const response = await axios.post(url, payload, {
      timeout: DETECTION_TIMEOUT_MS,
      headers: { "Content-Type": "application/json" },
    });
    const normalised = normaliseDetectionResult(name, response.data);
    console.log(`[PYTHON-AI] ${name} detector OK`, normalised);
    return { status: "fulfilled", detector: name, data: normalised };
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
  if (yaw > 0 && yawThreshold > 0 && yaw >= yawThreshold + 12) return true;
  return toNumber(poseResult.confidence, 0) >= STRONG_HEAD_TURN_CONFIDENCE;
}

function makeSuppressedPoseResult(poseResult, eyeResult) {
  return {
    ...poseResult,
    detected: false,
    detail: "ok",
    confidence: 1,
    category: "head_pose",
    issue: null,
    message: "Natural head movement was allowed because reliable eye focus remained on the examination screen.",
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
    confidence: 1,
    issue: null,
    message: "The combined head-and-eye attention check produced a single head-pose result.",
    candidate_action: null,
    typing_sensitive: false,
    fusion_status: "duplicate_eye_gaze_suppressed",
    original_eye_detail: eyeResult.detail,
    original_eye_confidence: eyeResult.confidence,
    related_pose_detail: poseResult.detail,
  };
}

function applyHeadEyeFusion(results) {
  if (!ENABLE_HEAD_EYE_FUSION || !ENABLE_EYE_DETECTION) return results;
  const poseIndex = results.findIndex((result) => result.type === "pose");
  const eyeIndex = results.findIndex((result) => result.type === "eye");
  if (poseIndex < 0 || eyeIndex < 0) return results;

  const fusedResults = results.map((result) => ({ ...result }));
  const poseResult = fusedResults[poseIndex];
  const eyeResult = fusedResults[eyeIndex];
  const eyeDetail = String(eyeResult.detail || "").toLowerCase();
  const eyeGazeAway = [
    "eye_gaze_left",
    "eye_gaze_right",
    "eye_gaze_down",
  ].includes(eyeDetail);

  if (eyeDetail === "eyes_closed" && toBoolean(eyeResult.detected)) {
    if (isHeadTurn(poseResult)) {
      fusedResults[poseIndex] = {
        ...poseResult,
        detected: false,
        detail: "ok",
        confidence: 1,
        issue: null,
        message: "Head-pose warning suppressed because eyes-closed has priority.",
        candidate_action: null,
        typing_sensitive: false,
        fusion_status: "pose_suppressed_by_eyes_closed_priority",
        original_pose_detail: poseResult.detail,
      };
    }
    return fusedResults;
  }

  if (!isHeadTurn(poseResult)) return fusedResults;

  const strongTurn = isStrongHeadTurn(poseResult);
  const reliableScreenFocus =
    eyeResult.focus_reliable === true && eyeResult.eyes_on_screen === true;

  if (!strongTurn && reliableScreenFocus) {
    fusedResults[poseIndex] = makeSuppressedPoseResult(poseResult, eyeResult);
    return fusedResults;
  }

  if (eyeGazeAway && toBoolean(eyeResult.detected)) {
    fusedResults[poseIndex] = {
      ...poseResult,
      message: "Please look at the examination screen. Combined head and eye movement indicates attention away from the screen.",
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
    return fusedResults;
  }

  fusedResults[poseIndex] = {
    ...poseResult,
    fusion_status: strongTurn
      ? "strong_head_turn_retained"
      : !eyeResult.focus_reliable
        ? "pose_retained_eye_focus_unavailable"
        : "pose_retained_eye_focus_not_on_screen",
  };
  return fusedResults;
}

async function runDetection(
  frame,
  assessmentId,
  candidateId,
  examId,
  monitoringMode = "full",
) {
  const cleanFrame = cleanBase64Frame(frame);
  const mode =
    String(monitoringMode || "full").toLowerCase() === "basic"
      ? "basic"
      : "full";
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

  logDetectionStart(ids, cleanFrame, mode);

  if (mode === "basic") {
    console.log("[PYTHON-AI] Basic mode active. Full visual detection is deferred.");
    return [];
  }

  const detectorCalls = [
    callDetector("face", `${DETECTION_URL}/detect/face`, payload),
    callDetector("phone", `${DETECTION_URL}/detect/phone`, payload),
    callDetector("pose", `${DETECTION_URL}/detect/pose`, payload),
  ];

  if (ENABLE_EYE_DETECTION) {
    detectorCalls.push(callDetector("eye", `${DETECTION_URL}/detect/eye`, payload));
  }

  const settled = await Promise.all(detectorCalls);
  const rawResults = settled
    .filter((item) => item.status === "fulfilled" && item.data)
    .map((item) => item.data);
  const failures = settled.filter((item) => item.status === "rejected");

  if (failures.length) {
    console.warn("[PYTHON-AI] One or more detectors failed", failures);
  }

  const fusedResults = applyHeadEyeFusion(rawResults);

  // Attach the exact camera frame used by the detectors. The IPC layer forwards
  // this value to /api/assessments/detect. The backend uploads it to MinIO only
  // when the policy result is a confirmed violation; warnings ignore the frame.
  const results = fusedResults.map((result) => ({
    ...result,
    assessmentid: assessmentId,
    assessment_id: assessmentId,
    candidateid: candidateId,
    candidate_id: candidateId,
    examid: examId,
    exam_id: examId,
    screenshotb64: cleanFrame,
    screenshot_b64: cleanFrame,
  }));

  logDetectionResult(results);
  return results;
}

function startCapture(data, mainWindow) {
  const ids = getSessionIds(data);
  const monitoringMode = getMonitoringMode(data);

  sessionData = {
    ...(sessionData || {}),
    ...data,
    ...ids,
    monitoringMode,
  };
  captureRunning = true;

  console.log("================================");
  console.log("[WEBCAM] Capture requested");
  console.log("Assessment:", ids.assessmentId);
  console.log("Candidate :", ids.candidateId);
  console.log("Exam      :", ids.examId);
  console.log("Mode      :", monitoringMode);
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
  console.log("Previous session available:", Boolean(sessionData));
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
    monitoringMode: getMonitoringMode(sessionData),
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
