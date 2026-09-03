let stream = null;
let promise = null;
let monitoringInterval = null;
let monitoringVideo = null;
let monitoringCanvas = null;
let monitoringSession = null;
let listenersRegistered = false;
let streamHealthInterval = null;
let lastCameraUnavailableSentAt = 0;
let lastMicrophoneUnavailableSentAt = 0;

let audioRecorder = null;
let audioRecorderMimeType = "";
let audioCaptureSupported = false;

const MONITORING_INTERVAL_MS = 2000;
const FRAME_JPEG_QUALITY = 0.72;
const AUDIO_CHUNK_MS = 2500;
const HEALTH_EVENT_COOLDOWN_MS = 5000;

const AUDIO_MIME_TYPE_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

function normaliseSessionValue(session, ...keys) {
  for (const key of keys) {
    const value = session?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function getSessionIdentifiers(session) {
  return {
    assessmentId: normaliseSessionValue(
      session,
      "assessmentId",
      "assessmentid",
      "assessment_id",
    ),
    candidateId: normaliseSessionValue(
      session,
      "candidateId",
      "candidateid",
      "candidate_id",
    ),
    examId: normaliseSessionValue(session, "examId", "examid", "exam_id"),
  };
}

function getSessionToken(session) {
  return normaliseSessionValue(session, "token", "accessToken", "access_token");
}

function getSessionId(session) {
  return normaliseSessionValue(session, "sessionId", "sessionid", "session_id");
}

function getMonitoringMode(session) {
  const mode = String(
    normaliseSessionValue(session, "monitoringMode", "monitoring_mode") ||
      "full",
  ).toLowerCase();

  return mode === "basic" ? "basic" : "full";
}

function isTrackLive(track) {
  return Boolean(
    track &&
      track.readyState === "live" &&
      track.enabled === true &&
      track.muted !== true,
  );
}

function waitForVideoReady(video) {
  return new Promise((resolve, reject) => {
    if (
      video.readyState >= 2 &&
      video.videoWidth > 0 &&
      video.videoHeight > 0
    ) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Camera video did not become ready."));
    }, 7000);

    const onLoadedMetadata = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        cleanup();
        resolve();
      }
    };

    const onCanPlay = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        cleanup();
        resolve();
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("canplay", onCanPlay);
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("canplay", onCanPlay);
  });
}

function getSupportedAudioMimeType() {
  if (typeof MediaRecorder === "undefined") return "";

  for (const mimeType of AUDIO_MIME_TYPE_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(mimeType)) return mimeType;
    } catch {
      // Ignore unsupported MIME type checks.
    }
  }

  return "";
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",").pop() : value);
    };

    reader.onerror = () =>
      reject(reader.error || new Error("Failed to read audio blob."));
    reader.readAsDataURL(blob);
  });
}

function buildMonitoringPayload(session, extra = {}) {
  const ids = getSessionIdentifiers(session);
  const timestamp = new Date().toISOString();
  const monitoringMode = getMonitoringMode(session);

  return {
    ...extra,
    assessmentId: ids.assessmentId,
    candidateId: ids.candidateId,
    examId: ids.examId,
    assessmentid: ids.assessmentId,
    candidateid: ids.candidateId,
    examid: ids.examId,
    token: getSessionToken(session),
    sessionId: getSessionId(session),
    sessionid: getSessionId(session),
    monitoringMode,
    monitoring_mode: monitoringMode,
    timestamp,
  };
}

function sendCaptureHealthEvent(detail, message, candidateAction) {
  if (!window.electronAPI?.sendFrame || !monitoringSession) return;

  const now = Date.now();

  if (detail === "camera_unavailable") {
    if (now - lastCameraUnavailableSentAt < HEALTH_EVENT_COOLDOWN_MS) return;
    lastCameraUnavailableSentAt = now;
  } else if (detail === "mic_silent") {
    if (now - lastMicrophoneUnavailableSentAt < HEALTH_EVENT_COOLDOWN_MS) return;
    lastMicrophoneUnavailableSentAt = now;
  }

  window.electronAPI.sendFrame(
    buildMonitoringPayload(monitoringSession, {
      frame: null,
      captureHealthOnly: true,
      capture_health_only: true,
      detected: true,
      detectionType: detail,
      detection_type: detail,
      detail,
      message,
      candidateAction,
      candidate_action: candidateAction,
    }),
  );
}

function checkMediaTrackHealth() {
  const videoTrack = stream?.getVideoTracks?.()[0];
  const audioTrack = stream?.getAudioTracks?.()[0];

  if (!isTrackLive(videoTrack)) {
    sendCaptureHealthEvent(
      "camera_unavailable",
      "Camera is switched off or unavailable.",
      "Turn on the camera and keep it enabled.",
    );
  }

  if (!isTrackLive(audioTrack)) {
    sendCaptureHealthEvent(
      "mic_silent",
      "Microphone is switched off or unavailable.",
      "Enable the microphone and verify microphone permission.",
    );
  }
}

function startStreamHealthMonitoring(activeStream) {
  stopStreamHealthMonitoring();

  const videoTrack = activeStream?.getVideoTracks?.()[0];
  const audioTrack = activeStream?.getAudioTracks?.()[0];

  const onCameraUnavailable = () => {
    sendCaptureHealthEvent(
      "camera_unavailable",
      "Camera is switched off or unavailable.",
      "Turn on the camera and keep it enabled.",
    );
  };

  const onMicrophoneUnavailable = () => {
    sendCaptureHealthEvent(
      "mic_silent",
      "Microphone is switched off or unavailable.",
      "Enable the microphone and verify microphone permission.",
    );
  };

  videoTrack?.addEventListener("ended", onCameraUnavailable);
  videoTrack?.addEventListener("mute", onCameraUnavailable);
  audioTrack?.addEventListener("ended", onMicrophoneUnavailable);
  audioTrack?.addEventListener("mute", onMicrophoneUnavailable);

  streamHealthInterval = setInterval(
    checkMediaTrackHealth,
    MONITORING_INTERVAL_MS,
  );

  checkMediaTrackHealth();
}

function stopStreamHealthMonitoring() {
  if (streamHealthInterval) {
    clearInterval(streamHealthInterval);
    streamHealthInterval = null;
  }
}

export async function getCameraStream() {
  if (stream?.active) return stream;
  if (promise) return promise;

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera access is unavailable.");
  }

  promise = navigator.mediaDevices
    .getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 360 },
        frameRate: { ideal: 15, max: 20 },
        facingMode: "user",
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    })
    .then((openedStream) => {
      stream = openedStream;
      console.log("[CAMERA] Stream opened", {
        tracks: openedStream.getTracks().map((track) => ({
          kind: track.kind,
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
        })),
      });
      return openedStream;
    })
    .finally(() => {
      promise = null;
    });

  return promise;
}

function captureCurrentFrame(session) {
  if (!monitoringVideo || !monitoringCanvas) return;

  const videoTrack = stream?.getVideoTracks?.()[0];
  if (!isTrackLive(videoTrack)) {
    console.warn("[MONITOR] Skipping frame because camera track is not live.");
    sendCaptureHealthEvent(
      "camera_unavailable",
      "Camera is switched off or unavailable.",
      "Turn on the camera and keep it enabled.",
    );
    return;
  }

  if (!monitoringVideo.videoWidth || !monitoringVideo.videoHeight) {
    console.warn(
      "[MONITOR] Skipping frame because camera video size is not ready.",
    );
    sendCaptureHealthEvent(
      "camera_unavailable",
      "No live camera image is available.",
      "Check the camera and keep camera permission enabled.",
    );
    return;
  }

  const ids = getSessionIdentifiers(session);

  if (!ids.assessmentId || !ids.candidateId || !ids.examId) {
    console.warn(
      "[MONITOR] Skipping frame because session identifiers are missing.",
      { session, ids },
    );
    return;
  }

  monitoringCanvas.width = monitoringVideo.videoWidth;
  monitoringCanvas.height = monitoringVideo.videoHeight;

  const context = monitoringCanvas.getContext("2d");
  if (!context) {
    console.warn("[MONITOR] Canvas context is unavailable.");
    return;
  }

  context.drawImage(
    monitoringVideo,
    0,
    0,
    monitoringCanvas.width,
    monitoringCanvas.height,
  );

  const dataUrl = monitoringCanvas.toDataURL(
    "image/jpeg",
    FRAME_JPEG_QUALITY,
  );
  const frame = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const payload = buildMonitoringPayload(session, { frame });

  console.log("[MONITOR] Frame captured and sent", {
    assessmentId: ids.assessmentId,
    candidateId: ids.candidateId,
    examId: ids.examId,
    monitoringMode: payload.monitoringMode,
    width: monitoringCanvas.width,
    height: monitoringCanvas.height,
    timestamp: payload.timestamp,
  });

  window.electronAPI?.sendFrame?.(payload);
}

async function sendAudioChunk(blob, session) {
  if (!blob || blob.size <= 0) return;

  // Waiting Screen uses basic monitoring. Audio-content detection starts only
  // after ActiveExam changes the shared monitoring session to full mode.
  if (getMonitoringMode(session) !== "full") return;

  if (!window.electronAPI?.sendAudio) {
    console.warn(
      "[AUDIO MONITOR] electronAPI.sendAudio is not available. Audio chunk was not sent.",
    );
    return;
  }

  const ids = getSessionIdentifiers(session);

  if (!ids.assessmentId || !ids.candidateId || !ids.examId) {
    console.warn(
      "[AUDIO MONITOR] Skipping audio because session identifiers are missing.",
      { session, ids },
    );
    return;
  }

  try {
    const audioChunk = await blobToBase64(blob);
    const payload = buildMonitoringPayload(session, {
      audio_chunk: audioChunk,
      audioChunk,
      mimeType: blob.type || audioRecorderMimeType || "audio/webm",
      size: blob.size,
    });

    console.log("[AUDIO MONITOR] Audio chunk captured and sent", {
      assessmentId: ids.assessmentId,
      candidateId: ids.candidateId,
      examId: ids.examId,
      monitoringMode: payload.monitoringMode,
      mimeType: payload.mimeType,
      size: blob.size,
      timestamp: payload.timestamp,
    });

    window.electronAPI.sendAudio(payload);
  } catch (error) {
    console.error("[AUDIO MONITOR] Failed to send audio chunk", error);
  }
}

function startAudioMonitoringCapture(activeStream, session) {
  if (getMonitoringMode(session) !== "full") {
    stopAudioMonitoringCapture();
    console.log(
      "[AUDIO MONITOR] Audio-content detection disabled in basic monitoring mode.",
    );
    return;
  }

  if (audioRecorder && audioRecorder.state !== "inactive") {
    console.log("[AUDIO MONITOR] Audio monitoring already running.");
    return;
  }

  if (typeof MediaRecorder === "undefined") {
    console.warn(
      "[AUDIO MONITOR] MediaRecorder is not available in this renderer.",
    );
    audioCaptureSupported = false;
    return;
  }

  const audioTracks = activeStream?.getAudioTracks?.() || [];

  if (!audioTracks.length) {
    console.warn("[AUDIO MONITOR] No microphone track found in media stream.");
    audioCaptureSupported = false;
    sendCaptureHealthEvent(
      "mic_silent",
      "No microphone track is available.",
      "Enable the microphone and verify microphone permission.",
    );
    return;
  }

  if (!window.electronAPI?.sendAudio) {
    console.warn(
      "[AUDIO MONITOR] sendAudio IPC is not available yet. Audio recorder will not start.",
    );
    audioCaptureSupported = false;
    return;
  }

  audioRecorderMimeType = getSupportedAudioMimeType();

  try {
    const options = audioRecorderMimeType
      ? { mimeType: audioRecorderMimeType }
      : undefined;

    audioRecorder = new MediaRecorder(new MediaStream(audioTracks), options);
    audioCaptureSupported = true;

    audioRecorder.ondataavailable = (event) => {
      if (!event.data || event.data.size <= 0) return;
      sendAudioChunk(event.data, monitoringSession || session);
    };

    audioRecorder.onerror = (event) => {
      console.error(
        "[AUDIO MONITOR] MediaRecorder error",
        event?.error || event,
      );
    };

    audioRecorder.onstart = () => {
      console.log("[AUDIO MONITOR] Audio monitoring started", {
        mimeType: audioRecorder.mimeType || audioRecorderMimeType || "default",
        chunkMs: AUDIO_CHUNK_MS,
        tracks: audioTracks.map((track) => ({
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
        })),
      });
    };

    audioRecorder.onstop = () => {
      console.log("[AUDIO MONITOR] Audio monitoring stopped.");
    };

    audioRecorder.start(AUDIO_CHUNK_MS);
  } catch (error) {
    audioCaptureSupported = false;
    audioRecorder = null;
    console.error("[AUDIO MONITOR] Failed to start audio monitoring", error);
  }
}

function stopAudioMonitoringCapture() {
  if (!audioRecorder) return;

  try {
    if (audioRecorder.state !== "inactive") {
      audioRecorder.stop();
    }
  } catch (error) {
    console.warn("[AUDIO MONITOR] Failed to stop audio recorder", error);
  }

  audioRecorder = null;
  audioRecorderMimeType = "";
  audioCaptureSupported = false;
}

function syncAudioMonitoringForMode() {
  if (!stream || !monitoringSession) return;

  if (getMonitoringMode(monitoringSession) === "full") {
    startAudioMonitoringCapture(stream, monitoringSession);
  } else {
    stopAudioMonitoringCapture();
  }
}

export async function startMonitoringCapture(session) {
  if (!window.electronAPI?.sendFrame) {
    console.warn(
      "[MONITOR] electronAPI.sendFrame is not available. Monitoring cannot start.",
    );
    return;
  }

  const ids = getSessionIdentifiers(session);

  if (!ids.assessmentId || !ids.candidateId || !ids.examId) {
    console.warn(
      "[MONITOR] Monitoring start ignored because identifiers are missing.",
      { session, ids },
    );
    return;
  }

  if (monitoringInterval) {
    monitoringSession = {
      ...(monitoringSession || {}),
      ...session,
      ...ids,
      monitoringMode: getMonitoringMode(session),
    };

    console.log("[MONITOR] Monitoring session updated.", {
      ...ids,
      monitoringMode: getMonitoringMode(monitoringSession),
    });

    syncAudioMonitoringForMode();
    return;
  }

  monitoringSession = {
    ...session,
    ...ids,
    monitoringMode: getMonitoringMode(session),
  };

  console.log("================================");
  console.log("[MONITOR] Renderer webcam capture starting");
  console.log("Assessment:", ids.assessmentId);
  console.log("Candidate :", ids.candidateId);
  console.log("Exam      :", ids.examId);
  console.log("Mode      :", getMonitoringMode(monitoringSession));
  console.log("Interval  :", `${MONITORING_INTERVAL_MS}ms`);
  console.log("================================");

  const activeStream = await getCameraStream();
  startStreamHealthMonitoring(activeStream);

  monitoringVideo = document.createElement("video");
  monitoringVideo.autoplay = true;
  monitoringVideo.muted = true;
  monitoringVideo.playsInline = true;
  monitoringVideo.style.position = "fixed";
  monitoringVideo.style.left = "-9999px";
  monitoringVideo.style.top = "-9999px";
  monitoringVideo.style.width = "1px";
  monitoringVideo.style.height = "1px";
  monitoringVideo.srcObject = activeStream;
  document.body.appendChild(monitoringVideo);

  monitoringCanvas = document.createElement("canvas");

  try {
    await monitoringVideo.play();
  } catch (error) {
    console.warn("[MONITOR] Video play warning", error);
  }

  await waitForVideoReady(monitoringVideo);

  syncAudioMonitoringForMode();
  captureCurrentFrame(monitoringSession);

  monitoringInterval = setInterval(() => {
    try {
      captureCurrentFrame(monitoringSession);
    } catch (error) {
      console.error("[MONITOR] Frame capture failed", error);
    }
  }, MONITORING_INTERVAL_MS);

  console.log("[MONITOR] Renderer webcam capture started successfully.");
}

export function stopMonitoringCapture(options = {}) {
  const { stopStream = false } = options;

  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }

  stopAudioMonitoringCapture();
  stopStreamHealthMonitoring();

  if (monitoringVideo) {
    try {
      monitoringVideo.pause();
      monitoringVideo.srcObject = null;
      monitoringVideo.remove();
    } catch (error) {
      console.warn("[MONITOR] Failed to clean monitoring video", error);
    }
    monitoringVideo = null;
  }

  monitoringCanvas = null;
  monitoringSession = null;
  lastCameraUnavailableSentAt = 0;
  lastMicrophoneUnavailableSentAt = 0;

  console.log("[MONITOR] Renderer webcam capture stopped.");

  if (stopStream) {
    stopCameraStream();
  }
}

export function stopCameraStream() {
  stopMonitoringCapture({ stopStream: false });

  stream?.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch (error) {
      console.warn("[CAMERA] Failed to stop camera track", error);
    }
  });

  stream = null;
  promise = null;

  console.log("[CAMERA] Stream stopped.");
}

export function registerWebcamCaptureListeners() {
  if (listenersRegistered) return;
  if (typeof window === "undefined" || !window.electronAPI) return;

  listenersRegistered = true;

  window.electronAPI.startWebcamCapture?.((session) => {
    console.log("[MONITOR] start-webcam-capture event received", {
      assessmentId: getSessionIdentifiers(session).assessmentId,
      candidateId: getSessionIdentifiers(session).candidateId,
      examId: getSessionIdentifiers(session).examId,
      monitoringMode: getMonitoringMode(session),
    });

    startMonitoringCapture(session).catch((error) => {
      console.error("[MONITOR] Failed to start renderer webcam capture", error);
    });
  });

  window.electronAPI.stopWebcamCapture?.(() => {
    console.log("[MONITOR] stop-webcam-capture event received");
    stopMonitoringCapture({ stopStream: false });
  });

  console.log("[MONITOR] Webcam capture IPC listeners registered.");
}

export function getMonitoringCaptureState() {
  return {
    hasStream: Boolean(stream?.active),
    frameCaptureRunning: Boolean(monitoringInterval),
    audioCaptureRunning: Boolean(
      audioRecorder && audioRecorder.state !== "inactive",
    ),
    audioCaptureSupported,
    audioMimeType: audioRecorder?.mimeType || audioRecorderMimeType || "",
    cameraTrackLive: isTrackLive(stream?.getVideoTracks?.()[0]),
    microphoneTrackLive: isTrackLive(stream?.getAudioTracks?.()[0]),
    monitoringMode: getMonitoringMode(monitoringSession),
    session: monitoringSession,
  };
}

registerWebcamCaptureListeners();
