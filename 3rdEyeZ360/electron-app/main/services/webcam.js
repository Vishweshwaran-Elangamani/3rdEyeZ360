// Webcam capture runs in renderer via getUserMedia
// Main process receives base64 frames via IPC and forwards to Python API
const axios = require('axios')

const DETECTION_URL = 'http://127.0.0.1:5001'
let captureInterval = null
let sessionData = null

async function runDetection(frame, assessmentId, candidateId, examId) {
  const payload = { frame, candidate_id: candidateId, exam_id: examId }
  const results = await Promise.allSettled([
    axios.post(`${DETECTION_URL}/detect/face`, payload),
    axios.post(`${DETECTION_URL}/detect/phone`, payload),
    axios.post(`${DETECTION_URL}/detect/pose`, payload)
  ])
  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value.data)
}

function startCapture(data, mainWindow) {
  sessionData = data
  // Tell renderer to start sending frames every 4 seconds
  mainWindow.webContents.send('start-webcam-capture', data)
  console.log('📷 Capture started for', data.candidateId)
}

function stopCapture(mainWindow) {
  mainWindow.webContents.send('stop-webcam-capture')
  sessionData = null
  console.log('📷 Capture stopped')
}

module.exports = { runDetection, startCapture, stopCapture }