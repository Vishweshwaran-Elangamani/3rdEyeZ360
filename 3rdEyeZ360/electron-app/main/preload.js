const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {

    sendFrame: (data) => ipcRenderer.send('webcam-frame', data),
    startWebcamCapture: (callback) => ipcRenderer.on('start-webcam-capture', (_, d) => callback(d)),
    stopWebcamCapture: (callback) => ipcRenderer.on('stop-webcam-capture', () => callback()),
    // Lockdown
    enableLockdown: () => ipcRenderer.invoke('enable-lockdown'),
    disableLockdown: () => ipcRenderer.invoke('disable-lockdown'),

    // Webcam capture
    startCapture: (data) => ipcRenderer.invoke('start-capture', data),
    stopCapture: () => ipcRenderer.invoke('stop-capture'),

    // Detection results listener
    onDetectionResult: (callback) => ipcRenderer.on('detection-result', (_, data) => callback(data)),
    removeDetectionListener: () => ipcRenderer.removeAllListeners('detection-result'),

    // Browser view (locked browser)
    openBrowser: (data) => ipcRenderer.invoke('open-browser', data),
    closeBrowser: () => ipcRenderer.invoke('close-browser'),

    // App events
    onExamControl: (callback) => ipcRenderer.on('exam-control', (_, data) => callback(data)),
    removeExamControlListener: () => ipcRenderer.removeAllListeners('exam-control'),

    // Window control
    setClosable: (val) => ipcRenderer.invoke('set-closable', val)
})