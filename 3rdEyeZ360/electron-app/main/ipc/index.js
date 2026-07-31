const { ipcMain, BrowserWindow } = require("electron");
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
  ipcMain.removeHandler("capture-website-preview");
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
        "Chrome/124.0.0.0 Safari/537.36"
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
          (_loadEvent, errorCode, errorDescription, validatedURL, isMainFrame) => {
            if (!isMainFrame || errorCode === -3) return;
            cleanup();
            reject(
              new Error(
                errorDescription || `Unable to load ${validatedURL || normalizedUrl}`
              )
            );
          }
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

      const title = previewWindow.webContents.getTitle() || normalizedUrl;
      const finalUrl = previewWindow.webContents.getURL() || normalizedUrl;
      const dataUrl = image.toDataURL();

      return {
        success: true,
        requestedUrl: normalizedUrl,
        finalUrl,
        title,
        dataUrl,
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
