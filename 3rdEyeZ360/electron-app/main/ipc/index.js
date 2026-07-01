const { ipcMain } = require("electron");
const { setupLockdown, removeLockdown } = require("../lockdown/window");
const {
  createBrowserView,
  destroyBrowserView,
  navigateTo,
  updateBrowserBounds,
} = require("../lockdown/browser-view");
const { runDetection, startCapture, stopCapture } = require("../services/webcam");
const axios = require("axios");

const BACKEND_URL = "http://localhost:3000";

function registerIpcHandlers(mainWindow) {
  ipcMain.handle("enable-lockdown", () => {
    setupLockdown(mainWindow);
    return { success: true };
  });

  ipcMain.handle("disable-lockdown", () => {
    removeLockdown(mainWindow);
    return { success: true };
  });

  ipcMain.handle("set-closable", (_, val) => {
    mainWindow.setClosable(!!val);
    return { success: true };
  });

  ipcMain.handle("open-browser", (_, data) => {
    createBrowserView(mainWindow, data?.allowedWebsites || []);
    return { success: true };
  });

  ipcMain.handle("close-browser", () => {
    destroyBrowserView(mainWindow);
    return { success: true };
  });

  ipcMain.handle("navigate-browser", (_, url) => {
    navigateTo(url);
    return { success: true };
  });

  ipcMain.handle("resize-browser", (_, layout) => {
    updateBrowserBounds(mainWindow, layout || {});
    return { success: true };
  });

  ipcMain.handle("start-capture", (_, data) => {
    startCapture(data, mainWindow);
    return { success: true };
  });

  ipcMain.handle("stop-capture", () => {
    stopCapture(mainWindow);
    return { success: true };
  });

  ipcMain.handle("dev-reset-to-login", async () => {
    try {
      stopCapture(mainWindow);
    } catch (e) {
      console.log("stopCapture cleanup:", e.message);
    }

    try {
      destroyBrowserView(mainWindow);
    } catch (e) {
      console.log("destroyBrowserView cleanup:", e.message);
    }

    try {
      removeLockdown(mainWindow);
    } catch (e) {
      console.log("removeLockdown cleanup:", e.message);
    }

    try {
      mainWindow.setClosable(true);
    } catch (e) {
      console.log("setClosable cleanup:", e.message);
    }

    mainWindow.webContents.send("dev-force-login");
    return { success: true };
  });

  ipcMain.on("webcam-frame", async (_, data) => {
    try {
      const results = await runDetection(
        data.frame,
        data.assessmentId,
        data.candidateId,
        data.examId
      );

      for (const result of results) {
        if (result.detail !== "ok" && result.detail !== "noface") {
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
                headers: { Authorization: `Bearer ${data.token}` },
              }
            );

            mainWindow.webContents.send("detection-result", response.data);
          } catch (e) {
            console.log("Detection post error:", e.message);
          }
        }
      }
    } catch (e) {
      console.log("Detection error:", e.message);
    }
  });
}

module.exports = registerIpcHandlers;