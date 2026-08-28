const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  screen,
  ipcMain,
} = require("electron");
const path = require("path");
const { spawnPythonApi } = require("./services/python-spawner");
const registerIpcHandlers = require("./ipc");

if (process.env.NODE_ENV !== "development") {
  Menu.setApplicationMenu(null);
}

let mainWindow = null;
let pythonProcess = null;
let rendererReloadTimer = null;

function getIconPath() {
  return path.join(
    __dirname,
    "..",
    "assets",
    "icons",
    "3rdeyez360-icon.ico"
  );
}

function getPreloadPath() {
  return path.join(__dirname, "preload.js");
}

function getProdHtmlPath() {
  return path.join(__dirname, "..", "dist-renderer", "index.html");
}

const TITLE_BAR_THEMES = {
  splash: { color: "#00000000", symbolColor: "#111827", height: 32 },
  app: { color: "#00000000", symbolColor: "#f8fafc", height: 32 },
};

function setTitleBarTheme(themeName = "app") {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  const theme = themeName === "splash" ? TITLE_BAR_THEMES.splash : TITLE_BAR_THEMES.app;
  mainWindow.setTitleBarOverlay(theme);
  return true;
}

function showMainWindowMaximized() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (mainWindow.isFullScreen()) {
    mainWindow.setFullScreen(false);
  }

  mainWindow.maximize();
  mainWindow.show();
  mainWindow.focus();

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
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
    minWidth: 1024,
    minHeight: 700,

    fullscreen: false,
    frame: true,
    resizable: true,
    movable: true,
    minimizable: true,
    maximizable: true,

    titleBarStyle: "hidden",
    titleBarOverlay: TITLE_BAR_THEMES.splash,

    autoHideMenuBar: true,
    show: false,
    backgroundColor: "#0f1117",
    title: "3rdEyeZ360",
    icon: getIconPath(),

    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  // Debounce repeated Ctrl+R/F5 input. Multiple overlapping reloads can
  // temporarily destroy the renderer faster than Vite can recreate it.
  mainWindow.webContents.on("before-input-event", (event, input) => {
    const key = String(input.key || "").toLowerCase();
    const isRefresh =
      key === "f5" ||
      (input.control && key === "r") ||
      (input.meta && key === "r");

    if (!isRefresh) return;

    event.preventDefault();

    if (rendererReloadTimer) {
      clearTimeout(rendererReloadTimer);
    }

    rendererReloadTimer = setTimeout(() => {
      rendererReloadTimer = null;

      if (!mainWindow || mainWindow.isDestroyed()) return;

      setTitleBarTheme("app");
      mainWindow.webContents.reload();
    }, 300);
  });

  mainWindow.webContents.on("did-start-loading", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.setBackgroundColor("#0f1117");
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("Renderer process gone:", details);
  });

  mainWindow.webContents.on("did-fail-load", (_event, code, desc, url) => {
    console.error("Main window failed to load:", { code, desc, url });
    showMainWindowMaximized();
  });

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
    if (rendererReloadTimer) {
      clearTimeout(rendererReloadTimer);
      rendererReloadTimer = null;
    }

    mainWindow = null;
  });

  registerIpcHandlers(mainWindow);
}

ipcMain.on("set-title-bar-theme", (_event, themeName) => {
  setTitleBarTheme(themeName);
});

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
