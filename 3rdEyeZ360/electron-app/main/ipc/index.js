const { ipcMain } = require("electron");
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
} = require("../lockdown/browser-view");
const { runDetection, startCapture, stopCapture } = require("../services/webcam");
const axios = require("axios");

const BACKEND_URL = "http://localhost:3000";

function isWindowAlive(win) {
  return !!win && !win.isDestroyed() && !!win.webContents && !win.webContents.isDestroyed();
}

function safeSend(win, channel, payload) {
  if (!isWindowAlive(win)) return false;
  try {
    win.webContents.send(channel, payload);
    return true;
  } catch (e) {
    console.log(`safeSend failed for ${channel}:`, e.message);
    return false;
  }
}

function registerIpcHandlers(mainWindow) {
  ipcMain.removeHandler("enable-lockdown");
  ipcMain.removeHandler("disable-lockdown");
  ipcMain.removeHandler("set-closable");
  ipcMain.removeHandler("open-browser");
  ipcMain.removeHandler("close-browser");
  ipcMain.removeHandler("navigate-browser");
  ipcMain.removeHandler("resize-browser");
  ipcMain.removeHandler("show-browser");
  ipcMain.removeHandler("hide-browser");
  ipcMain.removeHandler("focus-browser");
  ipcMain.removeHandler("restore-browser");
  ipcMain.removeHandler("start-capture");
  ipcMain.removeHandler("stop-capture");
  ipcMain.removeHandler("dev-reset-to-login");
  ipcMain.removeAllListeners("webcam-frame");

  ipcMain.handle("enable-lockdown", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { success: false, error: "Main window unavailable" };
    }

    setupLockdown(mainWindow);
    return { success: true };
  });

  ipcMain.handle("disable-lockdown", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { success: false, error: "Main window unavailable" };
    }

    removeLockdown(mainWindow);
    return { success: true };
  });

  ipcMain.handle("set-closable", (_event, val) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { success: false, error: "Main window unavailable" };
    }

    mainWindow.setClosable(!!val);
    return { success: true };
  });

  ipcMain.handle("open-browser", (_event, data) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { success: false, error: "Main window unavailable" };
    }

    try {
      const view = createBrowserView(mainWindow, data?.allowedWebsites || []);
      return view
        ? { success: true }
        : { success: false, error: "Failed to create BrowserView" };
    } catch (e) {
      console.log("[ipc] open-browser error:", e);
      return { success: false, error: e?.message || "Failed to create BrowserView" };
    }
  });

  ipcMain.handle("close-browser", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { success: false, error: "Main window unavailable" };
    }

    destroyBrowserView(mainWindow);
    return { success: true };
  });

  ipcMain.handle("navigate-browser", (_event, url) => {
    const ok = navigateTo(url);
    return ok
      ? { success: true }
      : { success: false, error: "Navigation blocked or BrowserView unavailable" };
  });

  ipcMain.handle("resize-browser", (_event, layout) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { success: false, error: "Main window unavailable" };
    }

    const ok = updateBrowserBounds(mainWindow, layout || {});
    return ok
      ? { success: true }
      : { success: false, error: "Failed to resize BrowserView" };
  });

  ipcMain.handle("show-browser", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { success: false, error: "Main window unavailable" };
    }

    const ok = showBrowser(mainWindow);
    return ok
      ? { success: true }
      : { success: false, error: "BrowserView unavailable" };
  });

  ipcMain.handle("hide-browser", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { success: false, error: "Main window unavailable" };
    }

    const ok = hideBrowser(mainWindow);
    return ok
      ? { success: true }
      : { success: false, error: "BrowserView unavailable" };
  });

  ipcMain.handle("focus-browser", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { success: false, error: "Main window unavailable" };
    }

    const ok = focusBrowser(mainWindow);
    return ok
      ? { success: true }
      : { success: false, error: "BrowserView unavailable" };
  });

  ipcMain.handle("restore-browser", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { success: false, error: "Main window unavailable" };
    }

    const ok = restoreBrowser(mainWindow);
    return ok
      ? { success: true }
      : { success: false, error: "BrowserView unavailable" };
  });

  ipcMain.handle("start-capture", (_event, data) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { success: false, error: "Main window unavailable" };
    }

    startCapture(data, mainWindow);
    return { success: true };
  });

  ipcMain.handle("stop-capture", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { success: false, error: "Main window unavailable" };
    }

    stopCapture(mainWindow);
    return { success: true };
  });

  ipcMain.handle("dev-reset-to-login", async () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { success: false, error: "Main window unavailable" };
    }

    try {
      stopCapture(mainWindow);
    } catch (e) {
      console.log("stopCapture cleanup", e.message);
    }

    try {
      destroyBrowserView(mainWindow);
    } catch (e) {
      console.log("destroyBrowserView cleanup", e.message);
    }

    try {
      removeLockdown(mainWindow);
    } catch (e) {
      console.log("removeLockdown cleanup", e.message);
    }

    try {
      mainWindow.setClosable(true);
    } catch (e) {
      console.log("setClosable cleanup", e.message);
    }

    safeSend(mainWindow, "dev-force-login");
    return { success: true };
  });

  ipcMain.on("webcam-frame", async (_event, data) => {
    try {
      const results = await runDetection(
        data.frame,
        data.assessmentId,
        data.candidateId,
        data.examId
      );

      for (const result of results) {
        if (result.detail !== "ok" && result.detail !== "no_face") {
          try {
            const response = await axios.post(
              `${BACKEND_URL}/api/assessments/detect`,
              {
                assessmentid: data.assessmentId,
                candidateid: data.candidateId,
                examid: data.examId,
                detectiontype: result.type,
                detail: result.detail,
                confidence: result.confidence,
                screenshotb64: data.frame,
              },
              {
                headers: {
                  Authorization: `Bearer ${data.token}`,
                },
              }
            );

            safeSend(mainWindow, "detection-result", response.data);
          } catch (e) {
            console.log("Detection post error", e.message);
          }
        }
      }
    } catch (e) {
      console.log("Detection error", e.message);
    }
  });
}

module.exports = registerIpcHandlers;