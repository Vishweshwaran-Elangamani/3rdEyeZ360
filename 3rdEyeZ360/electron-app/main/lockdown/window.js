const { blockShortcuts, unblockShortcuts } = require('./keyboard')

let targetWindow = null
let closeHandler = null
let minimizeHandler = null

function setupLockdown(win, options = {}) {
  if (!win) return

  const isDevelopment = process.env.NODE_ENV === 'development'
  const forceInDev = options.forceInDev === true

  if (isDevelopment && !forceInDev) {
    win.isLocked = false
    console.log('🛠️ Dev mode detected: lockdown skipped')
    return
  }

  removeLockdown(win)

  targetWindow = win
  blockShortcuts()

  closeHandler = (e) => {
    if (win.isLocked) {
      e.preventDefault()
    }
  }

  minimizeHandler = (e) => {
    if (win.isLocked) {
      e.preventDefault()
      win.restore()
      win.focus()
    }
  }

  win.on('close', closeHandler)
  win.on('minimize', minimizeHandler)

  win.isLocked = true
  console.log('🔒 Window lockdown active')
}

function removeLockdown(win = targetWindow) {
  unblockShortcuts()

  if (win) {
    win.isLocked = false

    if (closeHandler) {
      win.removeListener('close', closeHandler)
    }

    if (minimizeHandler) {
      win.removeListener('minimize', minimizeHandler)
    }
  }

  closeHandler = null
  minimizeHandler = null
  targetWindow = null

  console.log('🔓 Window lockdown removed')
}

function isLockdownActive(win = targetWindow) {
  return !!(win && win.isLocked)
}

module.exports = { setupLockdown, removeLockdown, isLockdownActive }