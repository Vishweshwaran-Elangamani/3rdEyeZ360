const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  sendFrame: (data) => ipcRenderer.send('webcam-frame', data),
  startWebcamCapture: (callback) => ipcRenderer.on('start-webcam-capture', (_, d) => callback(d)),
  stopWebcamCapture: (callback) => ipcRenderer.on('stop-webcam-capture', () => callback()),

  enableLockdown: () => ipcRenderer.invoke('enable-lockdown'),
  disableLockdown: () => ipcRenderer.invoke('disable-lockdown'),

  startCapture: (data) => ipcRenderer.invoke('start-capture', data),
  stopCapture: () => ipcRenderer.invoke('stop-capture'),

  onDetectionResult: (callback) => ipcRenderer.on('detection-result', (_, data) => callback(data)),
  removeDetectionListener: () => ipcRenderer.removeAllListeners('detection-result'),

  openBrowser: (data) => ipcRenderer.invoke('open-browser', data),
  closeBrowser: () => ipcRenderer.invoke('close-browser'),

  onExamControl: (callback) => ipcRenderer.on('exam-control', (_, data) => callback(data)),
  removeExamControlListener: () => ipcRenderer.removeAllListeners('exam-control'),

  setClosable: (val) => ipcRenderer.invoke('set-closable', val)
})