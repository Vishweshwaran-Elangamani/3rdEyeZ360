const { BrowserView, session } = require('electron')

let browserView = null
let allowedDomains = []

function createBrowserView(mainWindow, websites) {
  allowedDomains = websites.map(url => {
    try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname }
    catch { return url }
  })

  browserView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Block navigation to non-allowed domains
    }
  })

  mainWindow.setBrowserView(browserView)

  // Position: below top bar (80px), full width, above bottom bar (40px)
  const bounds = mainWindow.getBounds()
  browserView.setBounds({
    x: 0,
    y: 80,
    width: bounds.width,
    height: bounds.height - 120
  })
  browserView.setAutoResize({ width: true, height: true })

  // Block navigation to non-allowed domains
  browserView.webContents.on('will-navigate', (event, url) => {
    const hostname = new URL(url).hostname
    if (!allowedDomains.some(d => hostname.includes(d))) {
      event.preventDefault()
      console.log(`🚫 Blocked navigation to: ${url}`)
    }
  })

  browserView.webContents.on('new-window', (event) => {
    event.preventDefault()
  })

  // Disable context menu
  browserView.webContents.on('context-menu', (e) => e.preventDefault())

  // Load first allowed website
  if (websites.length > 0) {
    const url = websites[0].startsWith('http') ? websites[0] : `https://${websites[0]}`
    browserView.webContents.loadURL(url)
  }

  console.log('🌐 Locked browser opened')
  return browserView
}

function navigateTo(url) {
  if (browserView) {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname
    if (allowedDomains.some(d => hostname.includes(d))) {
      browserView.webContents.loadURL(url.startsWith('http') ? url : `https://${url}`)
    }
  }
}

function destroyBrowserView(mainWindow) {
  if (browserView) {
    mainWindow.setBrowserView(null)
    browserView.webContents.destroy()
    browserView = null
    console.log('🌐 Locked browser closed')
  }
}

module.exports = { createBrowserView, destroyBrowserView, navigateTo }