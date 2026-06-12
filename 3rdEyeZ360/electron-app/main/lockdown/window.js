const { blockShortcuts, unblockShortcuts } = require('./keyboard')

let targetWindow = null

function setupLockdown(win) {
  targetWindow = win
  blockShortcuts()

  // Prevent close
  win.on('close', (e) => {
    if (win.isLocked) {
      e.preventDefault()
    }
  })

  // Prevent minimize
  win.on('minimize', (e) => {
    if (win.isLocked) {
      e.preventDefault()
      win.restore()
    }
  })

  win.isLocked = true
  console.log('🔒 Window lockdown active')
}

function removeLockdown(win) {
  unblockShortcuts()
  if (win) win.isLocked = false
  console.log('🔓 Window lockdown removed')
}

module.exports = { setupLockdown, removeLockdown }