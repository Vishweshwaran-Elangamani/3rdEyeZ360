const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const { spawnPythonApi } = require("./services/python-spawner");
const registerIpcHandlers = require("./ipc");

if (process.env.NODE_ENV !== "development") {
  Menu.setApplicationMenu(null);
}

let mainWindow = null;
let pythonProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    frame: true,
    resizable: true,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: "#0b1114",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
    icon: path.join(__dirname, "../dist-renderer/assets/icons/app-icon.ico"),
    title: "3rdEyeZ360",
  });

  if (process.env.NODE_ENV === "development") {
    const DEV_URL = "http://localhost:5173";

    const tryLoad = (retries = 10) => {
      mainWindow.loadURL(DEV_URL).catch(() => {
        if (retries > 0) {
          console.log("Main: Vite not ready, retrying...", retries, "retries left");
          setTimeout(() => tryLoad(retries - 1), 1500);
        } else {
          console.error("Main: Could not connect to Vite on port 5173");
        }
      });
    };

    tryLoad();

    mainWindow.webContents.on("before-input-event", async (event, input) => {
      // ORIGINAL SAFE CODE
      /*
      if (
        (input.control && input.shift && input.key.toLowerCase() === "i") ||
        input.key === "F12"
      ) {
        mainWindow.webContents.toggleDevTools();
        event.preventDefault();
      }
      */

      // Ctrl+Shift+I or F12 => toggle DevTools
      if (
        (input.control && input.shift && input.key.toLowerCase() === "i") ||
        input.key === "F12"
      ) {
        mainWindow.webContents.toggleDevTools();
        event.preventDefault();
        return;
      }

      // Ctrl+Shift+L => DEV RESET to login
      // Step 1: clear renderer storage
      // Step 2: call devResetToLogin IPC (destroys BrowserView, removes lockdown)
      // Step 3: IPC sends "dev-force-login" back to renderer to switch screen
      if (input.control && input.shift && input.key.toLowerCase() === "l") {
        event.preventDefault();

        try {
          await mainWindow.webContents.executeJavaScript(`
            try {
              localStorage.removeItem("auth-storage");
              localStorage.removeItem("exam-storage");
              localStorage.removeItem("app-screen");
              localStorage.removeItem("zustand");
              sessionStorage.clear();
            } catch (e) {
              console.error("Storage clear failed:", e);
            }
          `);
        } catch (e) {
          console.error("Storage clear JS failed:", e);
        }

        // Now call the IPC handler which destroys BrowserView + lockdown
        // and sends "dev-force-login" to renderer
        try {
          const { destroyBrowserView } = require("./lockdown/browser-view");
          const { removeLockdown } = require("./lockdown/window");
          const { stopCapture } = require("./services/webcam");

          try { stopCapture(mainWindow); } catch (_) {}
          try { destroyBrowserView(mainWindow); } catch (_) {}
          try { removeLockdown(mainWindow); } catch (_) {}
          try { mainWindow.setClosable(true); } catch (_) {}

          // small delay to let native BrowserView detach
          await new Promise((r) => setTimeout(r, 200));

          mainWindow.webContents.send("dev-force-login");
        } catch (e) {
          console.error("Failed to destroy BrowserView during reset:", e);
        }

        return;
      }
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist-renderer/index.html"));
  }

  mainWindow.webContents.once("did-finish-load", () => {
    if (!mainWindow) return;
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  registerIpcHandlers(mainWindow);
}

app.whenReady().then(async () => {
  try {
    pythonProcess = spawnPythonApi();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (err) {
    console.error("Electron startup failed:", err);
  }
});

app.on("window-all-closed", () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

module.exports = {
  getMainWindow: () => mainWindow,
};