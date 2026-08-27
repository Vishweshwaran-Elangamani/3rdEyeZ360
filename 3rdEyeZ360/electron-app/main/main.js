const { app, BrowserWindow, Menu, dialog, screen } = require("electron");
const path = require("path");
const { spawnPythonApi } = require("./services/python-spawner");
const registerIpcHandlers = require("./ipc");

if (process.env.NODE_ENV !== "development") {
  Menu.setApplicationMenu(null);
}

let mainWindow = null;
let pythonProcess = null;

function getIconPath() {
  return path.join(__dirname, "..", "assets", "icons", "3rdeyez360-icon.ico");
}

function getPreloadPath() {
  return path.join(__dirname, "preload.js");
}

function getProdHtmlPath() {
  return path.join(__dirname, "..", "dist-renderer", "index.html");
}

function showMainWindowMaximized() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  // Keep the normal Windows title bar and taskbar visible.
  if (mainWindow.isFullScreen()) {
    mainWindow.setFullScreen(false);
  }

  mainWindow.maximize();
  mainWindow.show();
  mainWindow.focus();

  // Windows can restore the startup bounds while the window is first shown.
  // Reapply maximize after the native window has completed its initial layout.
  setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    if (!mainWindow.isMaximized()) {
      mainWindow.maximize();
    }
  }, 150);
}

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();

  mainWindow = new BrowserWindow({
    // Start with the complete usable desktop area as a fallback.
    // The taskbar is excluded from Electron's workArea dimensions.
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
    minWidth: 1024,
    minHeight: 700,

    // This is a normal maximized window, not true fullscreen.
    fullscreen: false,
    frame: true,
    resizable: true,
    movable: true,
    minimizable: true,
    maximizable: true,

    autoHideMenuBar: true,
    show: false,
    backgroundColor: "#0b1114",
    title: "3rdEyeZ360",
    icon: getIconPath(),

    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("Renderer process gone:", details);
  });

  mainWindow.webContents.on("did-fail-load", (_event, code, desc, url) => {
    console.error("Main window failed to load:", { code, desc, url });
    showMainWindowMaximized();
  });

  // Show the hidden native window only after its first visual frame is ready.
  mainWindow.once("ready-to-show", () => {
    showMainWindowMaximized();
  });

  if (process.env.NODE_ENV === "development") {
    const DEV_URL = "http://localhost:5173";

    const tryLoad = (retries = 10) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;

      mainWindow.loadURL(DEV_URL).catch((err) => {
        if (retries > 0) {
          console.log(
            "Vite not ready, retrying...",
            retries,
            "retries left"
          );

          setTimeout(() => tryLoad(retries - 1), 1500);
        } else {
          console.error("Could not connect to Vite on port 5173", err);
          showMainWindowMaximized();
        }
      });
    };

    tryLoad();
  } else {
    mainWindow.loadFile(getProdHtmlPath()).catch((err) => {
      console.error("Failed to load production HTML:", err);
      showMainWindowMaximized();
    });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  registerIpcHandlers(mainWindow);
}

app.whenReady().then(() => {
  try {
    pythonProcess = spawnPythonApi();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (err) {
    console.error("Electron startup failed", err);
    dialog.showErrorBox("Startup Error", String(err?.message || err));
  }
});

app.on("window-all-closed", () => {
  if (pythonProcess) {
    try {
      pythonProcess.kill();
    } catch (e) {
      console.log("Failed to kill python process", e.message);
    }
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});

module.exports = {
  getMainWindow: () => mainWindow,
};
