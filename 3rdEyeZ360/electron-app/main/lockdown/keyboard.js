const { globalShortcut } = require('electron')

function blockShortcuts() {
  globalShortcut.register('Alt+F4', () => false)
  globalShortcut.register('Alt+Tab', () => false)
  globalShortcut.register('Super', () => false)
  globalShortcut.register('Control+Alt+Delete', () => false)
  globalShortcut.register('Control+Shift+Escape', () => false)
  globalShortcut.register('Control+Escape', () => false)
  globalShortcut.register('F11', () => false)
  console.log('🔒 Keyboard shortcuts blocked')
}

function unblockShortcuts() {
  globalShortcut.unregisterAll()
  console.log('🔓 Keyboard shortcuts unblocked')
}

module.exports = { blockShortcuts, unblockShortcuts }