const { ipcMain, BrowserWindow, powerMonitor } = require("electron");
const { setupLockdown, removeLockdown } = require("../lockdown/window");
const {
  createBrowserView,
  destroyBrowserView,
  navigateTo,
  updateBrowserBounds,
  showBrowser,
  hideBrowser,
  focusBrowser,
  restoreBrowser,
  getLastBrowserInputAt,
  getLastInputAt,
} = require("../lockdown/browser-view");
const {
  runDetection,
  startCapture,
  stopCapture,
  getCaptureState,
} = require("../services/webcam");
const axios = require("axios");

const BACKEND_URL = "http://localhost:3000";
const DETECTION_URL = process.env.DETECTION_URL || "http://127.0.0.1:5001";

const TYPING_GRACE_MS = 4000;
const TOAST_DURATION_MS = 4500;

let monitoringToastWindow = null;
let monitoringToastTimer = null;
let activeMainWindow = null;
let powerMonitorRegistered = false;

function isWindowAlive(win) {
  return Boolean(
    win &&
      !win.isDestroyed() &&
      win.webContents &&
      !win.webContents.isDestroyed(),
  );
}

function safeSend(win, channel, payload) {
  if (!isWindowAlive(win)) return false;

  try {
    win.webContents.send(channel, payload);
    return true;
  } catch (error) {
    console.log(`safeSend failed for ${channel}:`, error.message);
    return false;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function monitoringMessageFor(detail, fallback) {
  const messages = {
    face_missing: "Please remain visible in the camera frame.",
    multiple_faces:
      "Another person appears to be visible. Only the candidate should be in view.",

    looking_left:
      "Please look at the examination screen. Your head appears to be turned left.",
    looking_right:
      "Please look at the examination screen. Your head appears to be turned right.",
    looking_down: "Please keep your face directed towards the screen.",

    head_looking_left:
      "Please look at the examination screen. Your head appears to be turned left.",
    head_looking_right:
      "Please look at the examination screen. Your head appears to be turned right.",
    head_looking_down: "Please keep your face directed towards the screen.",

    eyes_closed: "Please keep your eyes open and focused on the exam screen.",
    eye_gaze_left:
      "Please keep your eyes on the exam screen. Eye movement to the left was detected.",
    eye_gaze_right:
      "Please keep your eyes on the exam screen. Eye movement to the right was detected.",
    eye_gaze_down:
      "Please keep your eyes on the exam screen. Downward eye movement was detected.",

    phone_detected: "Mobile phone detected. Please remove the phone from view.",

    background_speech:
      "Background speech detected. Please stay in a quiet environment.",
    high_noise: "High background noise detected. Please reduce surrounding noise.",
    mic_silent: "Microphone input is very low. Please check your microphone.",

    charger_disconnected: "Charger is disconnected. Please connect your charger.",
    charger_connected: "Charger connected.",
    battery_low: "Battery level is low. Please connect your charger.",
  };

  return (
    fallback ||
    messages[detail] ||
    "Please follow the exam monitoring instructions."
  );
}

function candidateActionFor(detail, fallback) {
  const actions = {
    face_missing: "Sit in front of the camera and keep your face visible.",
    multiple_faces: "Ensure only you are visible in the camera frame.",

    looking_left: "Face the exam screen.",
    looking_right: "Face the exam screen.",
    looking_down: "Look back at the exam screen.",

    head_looking_left: "Face the exam screen.",
    head_looking_right: "Face the exam screen.",
    head_looking_down: "Look back at the exam screen.",

    eyes_closed: "Open your eyes and keep looking at the exam screen.",
    eye_gaze_left: "Keep your eyes focused on the exam content.",
    eye_gaze_right: "Keep your eyes focused on the exam content.",
    eye_gaze_down: "Keep your eyes focused on the exam content.",

    phone_detected: "Remove the phone from the camera view.",

    background_speech: "Move to a quiet place or ask others to stop speaking.",
    high_noise: "Reduce surrounding noise.",
    mic_silent: "Check that your microphone is connected and working.",

    charger_disconnected: "Connect your charger.",
    charger_connected: "",
    battery_low: "Connect your charger.",
  };

  return fallback || actions[detail] || "Correct the monitoring issue shown on screen.";
}

function categoryFor(detail, fallback) {
  const categories = {
    face_missing: "face",
    multiple_faces: "face",

    looking_left: "head_pose",
    looking_right: "head_pose",
    looking_down: "head_pose",
    head_looking_left: "head_pose",
    head_looking_right: "head_pose",
    head_looking_down: "head_pose",

    eyes_closed: "eye",
    eye_gaze_left: "eye",
    eye_gaze_right: "eye",
    eye_gaze_down: "eye",

    phone_detected: "device",

    background_speech: "voice",
    high_noise: "voice",
    mic_silent: "voice",

    charger_disconnected: "power",
    charger_connected: "power",
    battery_low: "power",
  };

  return fallback || categories[detail] || "monitoring";
}

function issueFor(detail, fallback) {
  const issues = {
    looking_left: "head_looking_left",
    looking_right: "head_looking_right",
    looking_down: "head_looking_down",
  };

  return fallback || issues[detail] || detail || "monitoring_issue";
}

function closeMonitoringToastWindow() {
  if (monitoringToastTimer) {
    clearTimeout(monitoringToastTimer);
    monitoringToastTimer = null;
  }

  if (monitoringToastWindow && !monitoringToastWindow.isDestroyed()) {
    monitoringToastWindow.close();
  }

  monitoringToastWindow = null;
}

function positionMonitoringToastWindow(mainWindow) {
  if (
    !isWindowAlive(mainWindow) ||
    !monitoringToastWindow ||
    monitoringToastWindow.isDestroyed()
  ) {
    return;
  }

  const parentBounds = mainWindow.getBounds();
  const width = Math.min(660, Math.max(460, parentBounds.width - 96));
  const height = 230;

  monitoringToastWindow.setBounds(
    {
      x: Math.round(parentBounds.x + (parentBounds.width - width) / 2),
      y: Math.round(parentBounds.y + (parentBounds.height - height) / 2),
      width,
      height,
    },
    false,
  );
}

function showNativeMonitoringToast(mainWindow, rawPayload) {
  console.log("[NATIVE TOAST] requested", rawPayload);

  if (!isWindowAlive(mainWindow)) {
    console.log("[NATIVE TOAST] skipped - mainWindow unavailable");
    return;
  }

  const payload =
    rawPayload?.backend || rawPayload?.data || rawPayload?.payload || rawPayload;

  if (!payload) {
    console.log("[NATIVE TOAST] skipped - empty payload");
    return;
  }

  const shouldToast =
    payload.toast === true ||
    payload.warning === true ||
    payload.violation === true;

  if (!shouldToast) {
    console.log("[NATIVE TOAST] skipped - toast flag false", payload);
    return;
  }

  const rawDetail =
    payload.detail ||
    payload.issue ||
    payload.result?.detail ||
    "monitoring_event";

  const detail = String(rawDetail).toLowerCase();

  const category = categoryFor(
    detail,
    payload.category || payload.result?.category,
  );

  const issue = issueFor(
    detail,
    payload.issue || payload.result?.issue,
  );

  const message = monitoringMessageFor(
    detail,
    payload.message || payload.backend?.message,
  );

  const candidateAction = candidateActionFor(
    detail,
    payload.candidate_action ||
      payload.candidateAction ||
      payload.result?.candidate_action,
  );

  const title = payload.violation
    ? "Violation detected"
    : payload.warning
      ? "Monitoring warning"
      : "Monitoring alert";

  const countText = payload.count ? ` - Count: ${payload.count}` : "";

  const background = payload.violation
    ? "linear-gradient(135deg, #7f1d1d 0%, #b91c1c 100%)"
    : payload.warning
      ? "linear-gradient(135deg, #92400e 0%, #d97706 100%)"
      : "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)";

  if (!monitoringToastWindow || monitoringToastWindow.isDestroyed()) {
    monitoringToastWindow = new BrowserWindow({
      parent: mainWindow,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: true,
      focusable: true,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      hasShadow: false,
      backgroundColor: "#00000000",
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    monitoringToastWindow.setIgnoreMouseEvents(true, { forward: true });
    monitoringToastWindow.setAlwaysOnTop(true, "screen-saver");

    monitoringToastWindow.once("closed", () => {
      monitoringToastWindow = null;
    });
  }

  positionMonitoringToastWindow(mainWindow);

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        overflow: hidden;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .wrap {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 12px;
      }

      .toast {
        width: 100%;
        min-height: 185px;
        border-radius: 22px;
        padding: 24px 28px;
        color: white;
        background: ${background};
        box-shadow: 0 30px 90px rgba(0, 0, 0, .62);
        border: 1px solid rgba(255, 255, 255, .28);
        display: flex;
        gap: 18px;
        align-items: flex-start;
        animation: pop .18s ease-out;
      }

      .icon {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: rgba(255, 255, 255, .18);
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        font-size: 28px;
        font-weight: 900;
      }

      .title {
        font-size: 14px;
        font-weight: 900;
        letter-spacing: .08em;
        text-transform: uppercase;
        margin-bottom: 8px;
      }

      .message {
        font-size: 19px;
        line-height: 1.42;
        font-weight: 760;
        word-break: break-word;
      }

      .action {
        margin-top: 8px;
        font-size: 14px;
        line-height: 1.4;
        font-weight: 650;
        opacity: .96;
      }

      .meta {
        margin-top: 10px;
        font-size: 13px;
        opacity: .92;
        font-family: Consolas, "JetBrains Mono", monospace;
      }

      @keyframes pop {
        from {
          opacity: 0;
          transform: translateY(10px) scale(.96);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="toast">
        <div class="icon">!</div>
        <div>
          <div class="title">${escapeHtml(title)}</div>
          <div class="message">${escapeHtml(message)}</div>
          ${
            candidateAction
              ? `<div class="action">Action: ${escapeHtml(candidateAction)}</div>`
              : ""
          }
          <div class="meta">
            Category: ${escapeHtml(category)} | Issue: ${escapeHtml(issue)}${escapeHtml(countText)}
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;

  const encodedUrl = "data:text/html;charset=utf-8," + encodeURIComponent(html);

  monitoringToastWindow.webContents.once("did-finish-load", () => {
    if (!monitoringToastWindow || monitoringToastWindow.isDestroyed()) return;

    positionMonitoringToastWindow(mainWindow);
    monitoringToastWindow.setAlwaysOnTop(true, "screen-saver");
    monitoringToastWindow.show();
    monitoringToastWindow.moveTop();

    console.log("[NATIVE TOAST] shown", {
      title,
      category,
      issue,
      detail,
      count: payload.count,
    });
  });

  monitoringToastWindow.loadURL(encodedUrl).catch((error) => {
    console.log("[NATIVE TOAST] load failed", error.message);
  });

  if (monitoringToastTimer) clearTimeout(monitoringToastTimer);

  monitoringToastTimer = setTimeout(() => {
    closeMonitoringToastWindow();
  }, TOAST_DURATION_MS);
}

function pickField(data, ...keys) {
  for (const key of keys) {
    const value = data?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return null;
}

function normaliseFramePayload(data = {}) {
  return {
    frame: pickField(data, "frame", "screenshotb64", "image", "imageb64"),
    assessmentId: pickField(data, "assessmentId", "assessmentid", "assessment_id"),
    candidateId: pickField(data, "candidateId", "candidateid", "candidate_id"),
    examId: pickField(data, "examId", "examid", "exam_id"),
    token: pickField(data, "token", "accessToken", "access_token"),
    timestamp: pickField(data, "timestamp") || new Date().toISOString(),
  };
}



function normaliseAudioPayload(data = {}) {
  return {
    audioChunk: pickField(data, "audio_chunk", "audioChunk", "audio", "audiob64"),
    assessmentId: pickField(data, "assessmentId", "assessmentid", "assessment_id"),
    candidateId: pickField(data, "candidateId", "candidateid", "candidate_id"),
    examId: pickField(data, "examId", "examid", "exam_id"),
    token: pickField(data, "token", "accessToken", "access_token"),
    sessionId: pickField(data, "sessionId", "sessionid", "session_id"),
    mimeType: pickField(data, "mimeType", "mimetype", "mime_type"),
    size: pickField(data, "size", "byteLength", "byte_length"),
    timestamp: pickField(data, "timestamp") || new Date().toISOString(),
  };
}
function shouldIgnoreDetection(result) {
  const detail = String(result?.detail || "").toLowerCase();
  return detail === "ok" || detail === "no_face";
}

function getMostRecentTypingAt() {
  const browserTypingAt =
    typeof getLastBrowserInputAt === "function"
      ? getLastBrowserInputAt()
      : null;

  const fallbackTypingAt =
    typeof getLastInputAt === "function"
      ? getLastInputAt()
      : null;

  return Number(browserTypingAt || fallbackTypingAt || 0);
}

function wasTypingRecently() {
  const lastTypedAt = getMostRecentTypingAt();
  if (!lastTypedAt) return false;

  return Date.now() - lastTypedAt <= TYPING_GRACE_MS;
}

function isTypingSensitiveDetection(result) {
  const detail = String(result?.detail || "").toLowerCase();
  const issue = String(result?.issue || "").toLowerCase();

  return (
    result?.typing_sensitive === true ||
    detail === "looking_down" ||
    detail === "head_looking_down" ||
    detail === "eye_gaze_down" ||
    issue === "head_looking_down" ||
    issue === "eye_gaze_down"
  );
}

function shouldSkipForRecentTyping(result) {
  if (!isTypingSensitiveDetection(result)) return false;

  const recentlyTyped = wasTypingRecently();

  if (recentlyTyped) {
    console.log("[IPC] Typing-sensitive detection ignored due to recent typing", {
      detail: result.detail,
      issue: result.issue,
      typingGraceMs: TYPING_GRACE_MS,
      lastInputAt: getMostRecentTypingAt(),
    });
  }

  return recentlyTyped;
}

function buildBackendDetectionPayload(payload, result) {
  const detail = String(result.detail || "").toLowerCase();
  const category = categoryFor(detail, result.category);
  const issue = issueFor(detail, result.issue);

  return {
    assessmentid: payload.assessmentId,
    candidateid: payload.candidateId,
    examid: payload.examId,
    detectiontype: result.type,
    detail: result.detail,
    confidence: result.confidence,
    screenshotb64: payload.frame || null,
    sessionid: payload.sessionId || null,
    session_id: payload.sessionId || null,

    category,
    issue,
    message: result.message || monitoringMessageFor(detail),
    candidate_action: result.candidate_action || candidateActionFor(detail),
    typing_sensitive: Boolean(result.typing_sensitive),
  };
}

async function persistPowerDetection(detail) {
  const state = typeof getCaptureState === "function" ? getCaptureState() : null;
  const session = state?.sessionData || {};
  const mainWindow = activeMainWindow;

  const powerPayload = {
    type: "power",
    detail,
    confidence: 1,
    detected: true,
    category: "power",
    issue: detail,
    message: monitoringMessageFor(detail),
    candidate_action: candidateActionFor(detail),
    toast: detail !== "charger_connected",
    warning: detail === "charger_disconnected",
    violation: false,
    action: detail === "charger_disconnected" ? "warning" : "toast",
    severity: detail === "charger_disconnected" ? "low" : "info",
  };

  if (isWindowAlive(mainWindow)) {
    showNativeMonitoringToast(mainWindow, powerPayload);

    safeSend(mainWindow, "detection-result", {
      source: "power-monitor",
      persisted: false,
      result: powerPayload,
      backend: powerPayload,
      timestamp: new Date().toISOString(),
    });
  }

  if (
    !session?.assessmentId ||
    !session?.candidateId ||
    !session?.examId ||
    !session?.token
  ) {
    console.log("[POWER] Backend persistence skipped because active session/token is missing", {
      detail,
      session,
    });
    return;
  }

  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/assessments/detect`,
      {
        assessmentid: session.assessmentId,
        candidateid: session.candidateId,
        examid: session.examId,
        detectiontype: "power",
        detail,
        confidence: 1,
        screenshotb64: null,
        category: "power",
        issue: detail,
        message: monitoringMessageFor(detail),
        candidate_action: candidateActionFor(detail),
      },
      {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      },
    );

    console.log("[POWER] Detection persisted to backend", response.data);

    if (isWindowAlive(mainWindow)) {
      showNativeMonitoringToast(mainWindow, {
        ...response.data,
        category: response.data?.category || "power",
        issue: response.data?.issue || detail,
        message: response.data?.message || monitoringMessageFor(detail),
        candidate_action:
          response.data?.candidate_action || candidateActionFor(detail),
      });

      safeSend(mainWindow, "detection-result", {
        source: "backend",
        persisted: true,
        result: powerPayload,
        backend: response.data,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.log("[POWER] Detection post error", error?.response?.data || error.message);
  }
}

function registerPowerMonitorHandlers(mainWindow) {
  activeMainWindow = mainWindow;

  if (powerMonitorRegistered) return;

  powerMonitorRegistered = true;

  powerMonitor.on("on-battery", () => {
    console.log("[POWER] Charger disconnected or system switched to battery.");
    persistPowerDetection("charger_disconnected");
  });

  powerMonitor.on("on-ac", () => {
    console.log("[POWER] Charger connected or system switched to AC power.");
    persistPowerDetection("charger_connected");
  });
}

function registerIpcHandlers(mainWindow) {
  activeMainWindow = mainWindow;
  registerPowerMonitorHandlers(mainWindow);

  const handlerNames = [
    "enable-lockdown",
    "disable-lockdown",
    "set-closable",
    "open-browser",
    "close-browser",
    "navigate-browser",
    "resize-browser",
    "show-browser",
    "hide-browser",
    "focus-browser",
    "restore-browser",
    "start-capture",
    "stop-capture",
    "dev-reset-to-login",
    "capture-website-preview",
  ];

  for (const handlerName of handlerNames) {
    ipcMain.removeHandler(handlerName);
  }

  ipcMain.removeAllListeners("webcam-frame");
  ipcMain.removeAllListeners("webcam-audio");

  ipcMain.handle("enable-lockdown", () => {
    if (!isWindowAlive(mainWindow)) {
      return { success: false, error: "Main window unavailable" };
    }

    setupLockdown(mainWindow);
    return { success: true };
  });

  ipcMain.handle("disable-lockdown", () => {
    if (!isWindowAlive(mainWindow)) {
      return { success: false, error: "Main window unavailable" };
    }

    removeLockdown(mainWindow);
    return { success: true };
  });

  ipcMain.handle("set-closable", (_event, value) => {
    if (!isWindowAlive(mainWindow)) {
      return { success: false, error: "Main window unavailable" };
    }

    mainWindow.setClosable(Boolean(value));
    return { success: true };
  });

  ipcMain.handle("open-browser", async (_event, data) => {
    if (!isWindowAlive(mainWindow)) {
      return { success: false, error: "Main window unavailable" };
    }

    try {
      const allowedWebsites =
        data?.allowedWebsites ||
        data?.allowed_websites ||
        data?.allowedwebsites ||
        [];
      const bounds = data?.bounds || null;

      console.log("[ipc] opening assessment browser", {
        allowedWebsites,
        bounds,
      });

      const view = await createBrowserView(
        mainWindow,
        allowedWebsites,
        bounds,
      );

      return view
        ? { success: true, allowedWebsites }
        : { success: false, error: "Failed to create WebContentsView" };
    } catch (error) {
      console.log("[ipc] open-browser error:", error);
      return {
        success: false,
        error: error?.message || "Failed to create WebContentsView",
      };
    }
  });

  ipcMain.handle("close-browser", () => {
    try {
      destroyBrowserView(mainWindow);
      return { success: true };
    } catch (error) {
      console.log("[ipc] close-browser error:", error);
      return {
        success: false,
        error:
          error?.message || "Failed to destroy assessment WebContentsView",
      };
    }
  });

  ipcMain.handle("navigate-browser", async (_event, url) => {
    const ok = await navigateTo(url);
    return ok
      ? { success: true }
      : {
          success: false,
          error: "Navigation blocked or WebContentsView unavailable",
        };
  });

  ipcMain.handle("resize-browser", (_event, bounds) => {
    if (!isWindowAlive(mainWindow)) {
      return { success: false, error: "Main window unavailable" };
    }

    const ok = updateBrowserBounds(mainWindow, bounds || {});
    return ok
      ? { success: true }
      : { success: false, error: "Failed to resize WebContentsView" };
  });

  ipcMain.handle("show-browser", () => {
    if (!isWindowAlive(mainWindow)) {
      return { success: false, error: "Main window unavailable" };
    }

    const ok = showBrowser(mainWindow);
    return ok
      ? { success: true }
      : { success: false, error: "WebContentsView unavailable" };
  });

  ipcMain.handle("hide-browser", () => {
    if (!isWindowAlive(mainWindow)) {
      return { success: false, error: "Main window unavailable" };
    }

    const ok = hideBrowser(mainWindow);
    return ok
      ? { success: true }
      : { success: false, error: "WebContentsView unavailable" };
  });

  ipcMain.handle("focus-browser", () => {
    if (!isWindowAlive(mainWindow)) {
      return { success: false, error: "Main window unavailable" };
    }

    const ok = focusBrowser(mainWindow);
    return ok
      ? { success: true }
      : { success: false, error: "WebContentsView unavailable" };
  });

  ipcMain.handle("restore-browser", () => {
    if (!isWindowAlive(mainWindow)) {
      return { success: false, error: "Main window unavailable" };
    }

    const ok = restoreBrowser(mainWindow);
    return ok
      ? { success: true }
      : { success: false, error: "WebContentsView unavailable" };
  });

  ipcMain.handle("start-capture", (_event, data) => {
    if (!isWindowAlive(mainWindow)) {
      return { success: false, error: "Main window unavailable" };
    }

    startCapture(data, mainWindow);
    return { success: true };
  });

  ipcMain.handle("stop-capture", () => {
    if (!isWindowAlive(mainWindow)) {
      return { success: false, error: "Main window unavailable" };
    }

    stopCapture(mainWindow);
    return { success: true };
  });

  ipcMain.handle("capture-website-preview", async (_event, rawUrl) => {
    let previewWindow = null;

    try {
      const value = String(rawUrl || "").trim();
      if (!value) {
        return { success: false, error: "Website URL is required" };
      }

      const normalizedUrl = /^https?:\/\//i.test(value)
        ? value
        : `https://${value}`;

      new URL(normalizedUrl);

      previewWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        show: false,
        backgroundColor: "#ffffff",
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          partition: "persist:examiner-preview",
        },
      });

      previewWindow.webContents.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/124.0.0.0 Safari/537.36",
      );

      const loadResult = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error("Website preview timed out"));
        }, 15000);

        const cleanup = () => {
          clearTimeout(timeoutId);
          previewWindow.webContents.removeAllListeners("did-finish-load");
          previewWindow.webContents.removeAllListeners("did-fail-load");
        };

        previewWindow.webContents.once("did-finish-load", () => {
          cleanup();
          resolve(true);
        });

        previewWindow.webContents.once(
          "did-fail-load",
          (
            _loadEvent,
            errorCode,
            errorDescription,
            validatedURL,
            isMainFrame,
          ) => {
            if (!isMainFrame || errorCode === -3) return;

            cleanup();
            reject(
              new Error(
                errorDescription ||
                  `Unable to load ${validatedURL || normalizedUrl}`,
              ),
            );
          },
        );

        previewWindow.loadURL(normalizedUrl).catch((error) => {
          cleanup();
          reject(error);
        });
      });

      if (!loadResult || !previewWindow || previewWindow.isDestroyed()) {
        throw new Error("Website preview window became unavailable");
      }

      await new Promise((resolve) => setTimeout(resolve, 1200));

      const image = await previewWindow.webContents.capturePage({
        x: 0,
        y: 0,
        width: 1280,
        height: 720,
      });

      return {
        success: true,
        requestedUrl: normalizedUrl,
        finalUrl: previewWindow.webContents.getURL() || normalizedUrl,
        title: previewWindow.webContents.getTitle() || normalizedUrl,
        dataUrl: image.toDataURL(),
      };
    } catch (error) {
      console.log("Website preview capture failed:", error.message);
      return {
        success: false,
        error: error.message || "Unable to capture website preview",
      };
    } finally {
      if (previewWindow && !previewWindow.isDestroyed()) {
        previewWindow.destroy();
      }
    }
  });

  ipcMain.handle("dev-reset-to-login", async () => {
    if (!isWindowAlive(mainWindow)) {
      return { success: false, error: "Main window unavailable" };
    }

    try {
      stopCapture(mainWindow);
    } catch (error) {
      console.log("stopCapture cleanup", error.message);
    }

    try {
      destroyBrowserView(mainWindow);
    } catch (error) {
      console.log("destroyBrowserView cleanup", error.message);
    }

    try {
      removeLockdown(mainWindow);
    } catch (error) {
      console.log("removeLockdown cleanup", error.message);
    }

    try {
      mainWindow.setClosable(true);
    } catch (error) {
      console.log("setClosable cleanup", error.message);
    }

    safeSend(mainWindow, "dev-force-login");
    return { success: true };
  });

  ipcMain.on("webcam-frame", async (_event, data) => {
    const payload = normaliseFramePayload(data);

    console.log("================================");
    console.log("[IPC] webcam-frame received");
    console.log("Assessment:", payload.assessmentId);
    console.log("Candidate :", payload.candidateId);
    console.log("Exam      :", payload.examId);
    console.log("Timestamp :", payload.timestamp);
    console.log(
      "Frame     :",
      payload.frame ? `${String(payload.frame).length} chars` : "missing",
    );
    console.log("================================");

    if (!payload.frame) {
      console.warn("[IPC] Ignoring webcam-frame because frame is missing.");

      safeSend(mainWindow, "detection-result", {
        source: "electron-ipc",
        persisted: false,
        error: "Frame is missing",
        assessmentId: payload.assessmentId,
        candidateId: payload.candidateId,
        examId: payload.examId,
        timestamp: payload.timestamp,
      });

      return;
    }

    if (!payload.assessmentId || !payload.candidateId || !payload.examId) {
      console.warn(
        "[IPC] Ignoring webcam-frame because identifiers are missing.",
        payload,
      );

      safeSend(mainWindow, "detection-result", {
        source: "electron-ipc",
        persisted: false,
        error: "Assessment, candidate, or exam id is missing",
        assessmentId: payload.assessmentId,
        candidateId: payload.candidateId,
        examId: payload.examId,
        timestamp: payload.timestamp,
      });

      return;
    }

    try {
      const results = await runDetection(
        payload.frame,
        payload.assessmentId,
        payload.candidateId,
        payload.examId,
      );

      console.log("[IPC] Python detection results", {
        assessmentId: payload.assessmentId,
        candidateId: payload.candidateId,
        examId: payload.examId,
        results,
      });

      safeSend(mainWindow, "detection-result", {
        source: "python-api",
        persisted: false,
        assessmentId: payload.assessmentId,
        candidateId: payload.candidateId,
        examId: payload.examId,
        timestamp: payload.timestamp,
        results,
      });

      for (const result of results) {
        console.log("[IPC] Detection item", {
          type: result.type,
          detail: result.detail,
          confidence: result.confidence,
          category: result.category,
          issue: result.issue,
          typing_sensitive: result.typing_sensitive,
        });

        if (shouldIgnoreDetection(result)) {
          console.log(
            "[IPC] Detection ignored for backend persistence",
            result.detail,
          );
          continue;
        }

        if (shouldSkipForRecentTyping(result)) {
          safeSend(mainWindow, "detection-result", {
            source: "electron-ipc",
            persisted: false,
            reason: "Typing-sensitive detection ignored because typing was recent.",
            assessmentId: payload.assessmentId,
            candidateId: payload.candidateId,
            examId: payload.examId,
            timestamp: payload.timestamp,
            result,
          });
          continue;
        }

        if (!payload.token) {
          console.warn(
            "[IPC] No auth token found on webcam-frame. Backend persistence skipped for now.",
            result,
          );

          safeSend(mainWindow, "detection-result", {
            source: "electron-ipc",
            persisted: false,
            reason: "Missing auth token. Detection was logged locally only.",
            assessmentId: payload.assessmentId,
            candidateId: payload.candidateId,
            examId: payload.examId,
            timestamp: payload.timestamp,
            result,
          });

          continue;
        }

        try {
          const response = await axios.post(
            `${BACKEND_URL}/api/assessments/detect`,
            buildBackendDetectionPayload(payload, result),
            {
              headers: {
                Authorization: `Bearer ${payload.token}`,
              },
            },
          );

          console.log("[IPC] Detection persisted to backend", response.data);

          console.log("[NATIVE TOAST] before call", {
            toast: response.data?.toast,
            warning: response.data?.warning,
            violation: response.data?.violation,
            detail: response.data?.detail,
            category: response.data?.category || result.category,
            issue: response.data?.issue || result.issue,
          });

          showNativeMonitoringToast(mainWindow, {
            ...response.data,
            category: response.data?.category || result.category,
            issue: response.data?.issue || result.issue,
            message: response.data?.message || result.message,
            candidate_action:
              response.data?.candidate_action || result.candidate_action,
          });

          console.log("[NATIVE TOAST] after call");

          safeSend(mainWindow, "detection-result", {
            source: "backend",
            persisted: true,
            assessmentId: payload.assessmentId,
            candidateId: payload.candidateId,
            examId: payload.examId,
            timestamp: payload.timestamp,
            result,
            backend: response.data,
          });
        } catch (error) {
          console.log(
            "[IPC] Detection post error",
            error?.response?.data || error.message,
          );

          safeSend(mainWindow, "detection-result", {
            source: "backend",
            persisted: false,
            error: error?.response?.data || error.message,
            assessmentId: payload.assessmentId,
            candidateId: payload.candidateId,
            examId: payload.examId,
            timestamp: payload.timestamp,
            result,
          });
        }
      }
    } catch (error) {
      console.log("[IPC] Detection error", error.message);

      safeSend(mainWindow, "detection-result", {
        source: "python-api",
        persisted: false,
        error: error.message,
        assessmentId: payload.assessmentId,
        candidateId: payload.candidateId,
        examId: payload.examId,
        timestamp: payload.timestamp,
      });
    }
  });

  ipcMain.on("webcam-audio", async (_event, data) => {
    const payload = normaliseAudioPayload(data);

    console.log("================================");
    console.log("[IPC] webcam-audio received");
    console.log("Assessment:", payload.assessmentId);
    console.log("Candidate :", payload.candidateId);
    console.log("Exam      :", payload.examId);
    console.log("Timestamp :", payload.timestamp);
    console.log("MimeType  :", payload.mimeType || "unknown");
    console.log("Size      :", payload.size || "unknown");
    console.log(
      "Audio     :",
      payload.audioChunk ? `${String(payload.audioChunk).length} chars` : "missing",
    );
    console.log("================================");

    if (!payload.audioChunk) {
      console.warn("[IPC] Ignoring webcam-audio because audio chunk is missing.");
      safeSend(mainWindow, "detection-result", {
        source: "electron-ipc",
        persisted: false,
        error: "Audio chunk is missing",
        assessmentId: payload.assessmentId,
        candidateId: payload.candidateId,
        examId: payload.examId,
        timestamp: payload.timestamp,
      });
      return;
    }

    if (!payload.assessmentId || !payload.candidateId || !payload.examId) {
      console.warn(
        "[IPC] Ignoring webcam-audio because identifiers are missing.",
        payload,
      );
      safeSend(mainWindow, "detection-result", {
        source: "electron-ipc",
        persisted: false,
        error: "Assessment, candidate, or exam id is missing",
        assessmentId: payload.assessmentId,
        candidateId: payload.candidateId,
        examId: payload.examId,
        timestamp: payload.timestamp,
      });
      return;
    }

    try {
      const audioResponse = await axios.post(
        `${DETECTION_URL}/detect/audio`,
        {
          audio_chunk: payload.audioChunk,
          candidate_id: payload.candidateId,
          exam_id: payload.examId,
        },
        { timeout: 15000 },
      );

      const result = {
        type: "audio",
        ...(audioResponse.data || {}),
      };

      console.log("[IPC] Python audio detection result", {
        assessmentId: payload.assessmentId,
        candidateId: payload.candidateId,
        examId: payload.examId,
        result,
      });

      safeSend(mainWindow, "detection-result", {
        source: "python-api-audio",
        persisted: false,
        assessmentId: payload.assessmentId,
        candidateId: payload.candidateId,
        examId: payload.examId,
        timestamp: payload.timestamp,
        result,
      });

      if (shouldIgnoreDetection(result)) {
        console.log("[IPC] Audio detection ignored for backend persistence", result.detail);
        return;
      }

      if (!payload.token) {
        console.warn(
          "[IPC] No auth token found on webcam-audio. Backend persistence skipped for now.",
          result,
        );
        safeSend(mainWindow, "detection-result", {
          source: "electron-ipc",
          persisted: false,
          reason: "Missing auth token. Audio detection was logged locally only.",
          assessmentId: payload.assessmentId,
          candidateId: payload.candidateId,
          examId: payload.examId,
          timestamp: payload.timestamp,
          result,
        });
        return;
      }

      try {
        const response = await axios.post(
          `${BACKEND_URL}/api/assessments/detect`,
          buildBackendDetectionPayload(payload, result),
          {
            headers: {
              Authorization: `Bearer ${payload.token}`,
            },
          },
        );

        console.log("[IPC] Audio detection persisted to backend", response.data);

        showNativeMonitoringToast(mainWindow, {
          ...response.data,
          category: response.data?.category || result.category,
          issue: response.data?.issue || result.issue,
          message: response.data?.message || result.message,
          candidate_action:
            response.data?.candidate_action || result.candidate_action,
        });

        safeSend(mainWindow, "detection-result", {
          source: "backend-audio",
          persisted: true,
          assessmentId: payload.assessmentId,
          candidateId: payload.candidateId,
          examId: payload.examId,
          timestamp: payload.timestamp,
          result,
          backend: response.data,
        });
      } catch (error) {
        console.log(
          "[IPC] Audio detection post error",
          error?.response?.data || error.message,
        );

        safeSend(mainWindow, "detection-result", {
          source: "backend-audio",
          persisted: false,
          error: error?.response?.data || error.message,
          assessmentId: payload.assessmentId,
          candidateId: payload.candidateId,
          examId: payload.examId,
          timestamp: payload.timestamp,
          result,
        });
      }
    } catch (error) {
      console.log("[IPC] Audio detection error", error?.response?.data || error.message);

      safeSend(mainWindow, "detection-result", {
        source: "python-api-audio",
        persisted: false,
        error: error?.response?.data || error.message,
        assessmentId: payload.assessmentId,
        candidateId: payload.candidateId,
        examId: payload.examId,
        timestamp: payload.timestamp,
      });
    }
  });

}

module.exports = registerIpcHandlers;