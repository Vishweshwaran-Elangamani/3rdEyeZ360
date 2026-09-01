const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  sendFrame: (data) => ipcRenderer.send("webcam-frame", data),
  sendAudio: (data) => ipcRenderer.send("webcam-audio", data),

  startWebcamCapture: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("start-webcam-capture", handler);
    return () => ipcRenderer.removeListener("start-webcam-capture", handler);
  },

  stopWebcamCapture: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("stop-webcam-capture", handler);
    return () => ipcRenderer.removeListener("stop-webcam-capture", handler);
  },

  enableLockdown: () => ipcRenderer.invoke("enable-lockdown"),
  disableLockdown: () => ipcRenderer.invoke("disable-lockdown"),

  startCapture: (data) => ipcRenderer.invoke("start-capture", data),
  stopCapture: () => ipcRenderer.invoke("stop-capture"),

  onDetectionResult: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("detection-result", handler);
    return () => ipcRenderer.removeListener("detection-result", handler);
  },

  removeDetectionListener: () => {
    ipcRenderer.removeAllListeners("detection-result");
  },

  captureWebsitePreview: (url) =>
    ipcRenderer.invoke("capture-website-preview", url),

  openBrowser: (data) => ipcRenderer.invoke("open-browser", data),
  closeBrowser: () => ipcRenderer.invoke("close-browser"),
  navigateBrowser: (url) => ipcRenderer.invoke("navigate-browser", url),
  resizeBrowser: (layout) => ipcRenderer.invoke("resize-browser", layout),

  showBrowser: () => ipcRenderer.invoke("show-browser"),
  hideBrowser: () => ipcRenderer.invoke("hide-browser"),
  focusBrowser: () => ipcRenderer.invoke("focus-browser"),
  restoreBrowser: () => ipcRenderer.invoke("restore-browser"),

  devResetToLogin: () => ipcRenderer.invoke("dev-reset-to-login"),

  onDevForceLogin: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("dev-force-login", handler);
    return () => ipcRenderer.removeListener("dev-force-login", handler);
  },

  removeDevForceLoginListener: () => {
    ipcRenderer.removeAllListeners("dev-force-login");
  },

  onExamControl: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("exam-control", handler);
    return () => ipcRenderer.removeListener("exam-control", handler);
  },

  removeExamControlListener: () => {
    ipcRenderer.removeAllListeners("exam-control");
  },

  setClosable: (val) => ipcRenderer.invoke("set-closable", val),
  enterExamWindowMode: () => ipcRenderer.invoke("enter-exam-window-mode"),
  exitExamWindowMode: () => ipcRenderer.invoke("exit-exam-window-mode"),

  setTitleBarTheme: (themeName) =>
    ipcRenderer.send("set-title-bar-theme", themeName),
});
