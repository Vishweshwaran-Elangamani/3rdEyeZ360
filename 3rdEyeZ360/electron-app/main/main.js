const { app, BrowserWindow, ipcMain, session, Menu } = require('electron')
const path = require('path')
const { setupLockdown, removeLockdown } = require('./lockdown/window')
const { spawnPythonApi } = require('./services/python-spawner')
const { registerIpcHandlers } = require('./ipc/index')

// Remove native menu bar completely
Menu.setApplicationMenu(null)

let mainWindow = null
let pythonProcess = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    frame: true,
    resizable: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    },
    icon: path.join(__dirname, '../assets/icons/app-icon.png'),
    title: '3rdEyeZ360'
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')

    // -------------------------------------------------------
    // DEV TOOLS SHORTCUTS (Ctrl+Shift+I and F12)
    // To DISABLE inspect in dev: comment out the block below
    // -------------------------------------------------------
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.control && input.shift && input.key.toLowerCase() === 'i') {
        mainWindow.webContents.toggleDevTools()
        event.preventDefault()
      }
      if (input.key === 'F12') {
        mainWindow.webContents.toggleDevTools()
        event.preventDefault()
      }
    })
    // -------------------------------------------------------

  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-renderer/index.html'))
    // DevTools shortcuts are NOT available in production build
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(async () => {
  pythonProcess = spawnPythonApi()
  createWindow()
  registerIpcHandlers(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (pythonProcess) pythonProcess.kill()
  if (process.platform !== 'darwin') app.quit()
})

module.exports = { getMainWindow: () => mainWindow }