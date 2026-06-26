const { globalShortcut, app } = require('electron')

const registeredShortcuts = new Set()

function safeRegister(accelerator, handler = () => false) {
  try {
    const ok = globalShortcut.register(accelerator, handler)
    if (ok) {
      registeredShortcuts.add(accelerator)
    } else {
      console.warn(`⚠️ Could not register shortcut: ${accelerator}`)
    }
  } catch (err) {
    console.warn(`⚠️ Failed to register shortcut ${accelerator}:`, err.message)
  }
}

function blockShortcuts(options = {}) {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const forceInDev = options.forceInDev === true

  if (isDevelopment && !forceInDev) {
    console.log('🛠️ Dev mode detected: shortcut blocking skipped')
    return
  }

  if (!app.isReady()) {
    console.warn('⚠️ App is not ready, shortcut blocking skipped')
    return
  }

  safeRegister('Alt+F4')
  safeRegister('F11')

  console.log('🔒 Exam shortcuts blocked')
}

function unblockShortcuts() {
  for (const accelerator of registeredShortcuts) {
    try {
      globalShortcut.unregister(accelerator)
    } catch (err) {
      console.warn(`⚠️ Failed to unregister shortcut ${accelerator}:`, err.message)
    }
  }

  registeredShortcuts.clear()
  console.log('🔓 Exam shortcuts unblocked')
}

module.exports = { blockShortcuts, unblockShortcuts }