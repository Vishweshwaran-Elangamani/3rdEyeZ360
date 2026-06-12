const { ipcMain } = require('electron')
const { setupLockdown, removeLockdown } = require('../lockdown/window')
const { createBrowserView, destroyBrowserView, navigateTo } = require('../lockdown/browser-view')
const { runDetection, startCapture, stopCapture } = require('../services/webcam')
const axios = require('axios')

const BACKEND_URL = 'http://localhost:3000'

function registerIpcHandlers(mainWindow) {

  // Lockdown
  ipcMain.handle('enable-lockdown', () => {
    setupLockdown(mainWindow)
    return { success: true }
  })

  ipcMain.handle('disable-lockdown', () => {
    removeLockdown(mainWindow)
    return { success: true }
  })

  // Window closable toggle
  ipcMain.handle('set-closable', (_, val) => {
    mainWindow.setClosable(val)
    return { success: true }
  })

  // Open locked browser
  ipcMain.handle('open-browser', (_, data) => {
    createBrowserView(mainWindow, data.allowedWebsites)
    return { success: true }
  })

  // Close browser
  ipcMain.handle('close-browser', () => {
    destroyBrowserView(mainWindow)
    return { success: true }
  })

  // Webcam frame received from renderer → send to Python → send result to renderer
  ipcMain.handle('start-capture', (_, data) => {
    startCapture(data, mainWindow)
    return { success: true }
  })

  ipcMain.handle('stop-capture', () => {
    stopCapture(mainWindow)
    return { success: true }
  })

  // Receive frame from renderer, run detection, send back result
  ipcMain.on('webcam-frame', async (_, data) => {
    try {
      const results = await runDetection(
        data.frame, data.assessmentId, data.candidateId, data.examId
      )
      // Post each detection to backend for processing
      for (const result of results) {
        if (result.detail !== 'ok' && result.detail !== 'no_face') {
          try {
            const response = await axios.post(`${BACKEND_URL}/api/assessments/detect`, {
              assessment_id: data.assessmentId,
              candidate_id: data.candidateId,
              exam_id: data.examId,
              detection_type: result.type,
              detail: result.detail,
              confidence: result.confidence,
              screenshot_b64: data.frame
            }, {
              headers: { Authorization: `Bearer ${data.token}` }
            })
            mainWindow.webContents.send('detection-result', response.data)
          } catch (e) {
            console.log('Detection post error:', e.message)
          }
        }
      }
    } catch (e) {
      console.log('Detection error:', e.message)
    }
  })
}

module.exports = { registerIpcHandlers }