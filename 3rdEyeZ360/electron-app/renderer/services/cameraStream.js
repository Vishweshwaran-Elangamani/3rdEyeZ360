let stream = null;
let promise = null;
let monitoringInterval = null;
let monitoringVideo = null;
let monitoringCanvas = null;
let monitoringSession = null;
let listenersRegistered = false;

let audioRecorder = null;
let audioRecorderMimeType = "";
let audioCaptureSupported = false;

const MONITORING_INTERVAL_MS = 2000;
const FRAME_JPEG_QUALITY = 0.72;
const AUDIO_CHUNK_MS = 2500;

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
    assessmentId: normaliseSessionValue(session, "assessmentId", "assessmentid", "assessment_id"),
    candidateId: normaliseSessionValue(session, "candidateId", "candidateid", "candidate_id"),
    examId: normaliseSessionValue(session, "examId", "examid", "exam_id"),
  };
}

function getSessionToken(session) {
  return normaliseSessionValue(session, "token", "accessToken", "access_token");
}

function getSessionId(session) {
  return normaliseSessionValue(session, "sessionId", "sessionid", "session_id");
}

function waitForVideoReady(video) {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
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
      // Ignore unsupported checks.
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

    reader.onerror = () => reject(reader.error || new Error("Failed to read audio blob."));
    reader.readAsDataURL(blob);
  });
}

function buildMonitoringPayload(session, extra = {}) {
  const ids = getSessionIdentifiers(session);
  const timestamp = new Date().toISOString();

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
    timestamp,
  };
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
    .then((s) => {
      stream = s;
      console.log("[CAMERA] Stream opened", {
        tracks: s.getTracks().map((track) => ({
          kind: track.kind,
          label: track.label,
          enabled: track.enabled,
          readyState: track.readyState,
        })),
      });
      return s;
    })
    .finally(() => {
      promise = null;
    });

  return promise;
}

function captureCurrentFrame(session) {
  if (!monitoringVideo || !monitoringCanvas) return;

  if (!monitoringVideo.videoWidth || !monitoringVideo.videoHeight) {
    console.warn("[MONITOR] Skipping frame because camera video size is not ready.");
    return;
  }

  const ids = getSessionIdentifiers(session);

  if (!ids.assessmentId || !ids.candidateId || !ids.examId) {
    console.warn("[MONITOR] Skipping frame because session identifiers are missing.", {
      session,
      ids,
    });
    return;
  }

  monitoringCanvas.width = monitoringVideo.videoWidth;
  monitoringCanvas.height = monitoringVideo.videoHeight;

  const context = monitoringCanvas.getContext("2d");
  context.drawImage(monitoringVideo, 0, 0, monitoringCanvas.width, monitoringCanvas.height);

  const dataUrl = monitoringCanvas.toDataURL("image/jpeg", FRAME_JPEG_QUALITY);
  const frame = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const timestamp = new Date().toISOString();

  console.log("[MONITOR] Frame captured and sent", {
    assessmentId: ids.assessmentId,
    candidateId: ids.candidateId,
    examId: ids.examId,
    width: monitoringCanvas.width,
    height: monitoringCanvas.height,
    timestamp,
  });

  window.electronAPI?.sendFrame?.({
    frame,
    assessmentId: ids.assessmentId,
    candidateId: ids.candidateId,
    examId: ids.examId,
    assessmentid: ids.assessmentId,
    candidateid: ids.candidateId,
    examid: ids.examId,
    token: getSessionToken(session),
    sessionId: getSessionId(session),
    sessionid: getSessionId(session),
    timestamp,
  });
}

async function sendAudioChunk(blob, session) {
  if (!blob || blob.size <= 0) return;

  if (!window.electronAPI?.sendAudio) {
    console.warn("[AUDIO MONITOR] electronAPI.sendAudio is not available. Audio chunk was not sent.");
    return;
  }

  const ids = getSessionIdentifiers(session);

  if (!ids.assessmentId || !ids.candidateId || !ids.examId) {
    console.warn("[AUDIO MONITOR] Skipping audio because session identifiers are missing.", {
      session,
      ids,
    });
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
  if (audioRecorder && audioRecorder.state !== "inactive") {
    console.log("[AUDIO MONITOR] Audio monitoring already running.");
    return;
  }

  if (typeof MediaRecorder === "undefined") {
    console.warn("[AUDIO MONITOR] MediaRecorder is not available in this renderer.");
    audioCaptureSupported = false;
    return;
  }

  const audioTracks = activeStream?.getAudioTracks?.() || [];

  if (!audioTracks.length) {
    console.warn("[AUDIO MONITOR] No microphone track found in media stream.");
    audioCaptureSupported = false;
    return;
  }

  if (!window.electronAPI?.sendAudio) {
    console.warn("[AUDIO MONITOR] sendAudio IPC is not available yet. Audio recorder will not start.");
    audioCaptureSupported = false;
    return;
  }

  audioRecorderMimeType = getSupportedAudioMimeType();

  try {
    const options = audioRecorderMimeType ? { mimeType: audioRecorderMimeType } : undefined;
    audioRecorder = new MediaRecorder(new MediaStream(audioTracks), options);
    audioCaptureSupported = true;

    audioRecorder.ondataavailable = (event) => {
      if (!event.data || event.data.size <= 0) return;
      sendAudioChunk(event.data, monitoringSession || session);
    };

    audioRecorder.onerror = (event) => {
      console.error("[AUDIO MONITOR] MediaRecorder error", event?.error || event);
    };

    audioRecorder.onstart = () => {
      console.log("[AUDIO MONITOR] Audio monitoring started", {
        mimeType: audioRecorder.mimeType || audioRecorderMimeType || "default",
        chunkMs: AUDIO_CHUNK_MS,
        tracks: audioTracks.map((track) => ({
          label: track.label,
          enabled: track.enabled,
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

export async function startMonitoringCapture(session) {
  if (!window.electronAPI?.sendFrame) {
    console.warn("[MONITOR] electronAPI.sendFrame is not available. Monitoring cannot start.");
    return;
  }

  const ids = getSessionIdentifiers(session);

  if (!ids.assessmentId || !ids.candidateId || !ids.examId) {
    console.warn("[MONITOR] Monitoring start ignored because identifiers are missing.", {
      session,
      ids,
    });
    return;
  }

  if (monitoringInterval) {
    console.log("[MONITOR] Monitoring already running. Updating session only.", ids);
    monitoringSession = { ...session, ...ids };
    return;
  }

  monitoringSession = { ...session, ...ids };

  console.log("================================");
  console.log("[MONITOR] Renderer webcam capture starting");
  console.log("Assessment:", ids.assessmentId);
  console.log("Candidate :", ids.candidateId);
  console.log("Exam      :", ids.examId);
  console.log("Interval  :", `${MONITORING_INTERVAL_MS}ms`);
  console.log("Audio     :", window.electronAPI?.sendAudio ? "enabled" : "waiting for sendAudio IPC");
  console.log("================================");

  const activeStream = await getCameraStream();

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

  startAudioMonitoringCapture(activeStream, monitoringSession);
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
    console.log("[MONITOR] start-webcam-capture event received", session);
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
    audioCaptureRunning: Boolean(audioRecorder && audioRecorder.state !== "inactive"),
    audioCaptureSupported,
    audioMimeType: audioRecorder?.mimeType || audioRecorderMimeType || "",
    session: monitoringSession,
  };
}

registerWebcamCaptureListeners();
