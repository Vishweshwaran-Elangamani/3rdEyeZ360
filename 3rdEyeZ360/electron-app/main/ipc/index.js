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
const {
  runDetection,
  startCapture,
  stopCapture,
} = require("../services/webcam");
const axios = require("axios");

const BACKEND_URL = "http://localhost:3000";

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

function registerIpcHandlers(mainWindow) {
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
    try {
      const results = await runDetection(
        data.frame,
        data.assessmentId,
        data.candidateId,
        data.examId,
      );

      for (const result of results) {
        if (result.detail === "ok" || result.detail === "no_face") {
          continue;
        }

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
            },
          );

          safeSend(mainWindow, "detection-result", response.data);
        } catch (error) {
          console.log("Detection post error", error.message);
        }
      }
    } catch (error) {
      console.log("Detection error", error.message);
    }
  });
}

module.exports = registerIpcHandlers;
