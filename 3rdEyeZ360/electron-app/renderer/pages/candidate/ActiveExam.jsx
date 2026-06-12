import React, { useEffect, useRef, useState } from 'react'
import useAuthStore from '../../store/authStore'
import useExamStore from '../../store/examStore'
import { useTimer } from '../../hooks/useTimer'
import { useToaster } from '../../hooks/useToaster'
import { getSocket } from '../../hooks/useSocket'
import Toaster from '../../components/common/Toaster'
import ChatWindow from '../../components/common/ChatWindow'

export default function ActiveExam({ exam, assessment, onComplete }) {
  const { user, accessToken } = useAuthStore()
  const { violationCount, incrementViolation, setLocked, isLocked } = useExamStore()
  const { toasts, addToast, removeToast } = useToaster()
  const { formatted } = useTimer(exam.duration_minutes, onComplete)
  const videoRef = useRef(null)
  const captureIntervalRef = useRef(null)
  const streamRef = useRef(null)
  const [warningCounts, setWarningCounts] = useState({})

  useEffect(() => {
    startMonitoring()
    setupSocketListeners()
    window.electronAPI?.enableLockdown()
    window.electronAPI?.setClosable(false)
    window.electronAPI?.openBrowser({ allowedWebsites: exam.allowed_websites })
    return () => {
      stopMonitoring()
      window.electronAPI?.disableLockdown()
      window.electronAPI?.setClosable(true)
      window.electronAPI?.closeBrowser()
    }
  }, [])

  const startMonitoring = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream

      // Send frame every 4 seconds
      captureIntervalRef.current = setInterval(() => {
        captureAndSendFrame()
      }, 4000)
    } catch (e) {
      addToast('⚠️ Camera access lost — please reconnect your camera', 'error', 8000)
    }
  }

  const captureAndSendFrame = () => {
  if (!videoRef.current || !window.electronAPI) return
  const canvas = document.createElement('canvas')
  canvas.width = 640; canvas.height = 480
  const ctx = canvas.getContext('2d')
  ctx.drawImage(videoRef.current, 0, 0, 640, 480)
  const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
  window.electronAPI.sendFrame({
    frame: base64,
    assessmentId: assessment.assessment_id,
    candidateId: user.user_id,
    examId: exam.exam_id,
    token: accessToken
  })
}

  const stopMonitoring = () => {
    if (captureIntervalRef.current) clearInterval(captureIntervalRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
  }

  const setupSocketListeners = () => {
    // Listen for detection results from main process
    window.electronAPI?.onDetectionResult((result) => {
      if (result.action === 'toast' || result.action === 'violation') {
        addToast(result.message, result.action === 'violation' ? 'error' : 'warning', 6000)
        if (result.action === 'violation') incrementViolation()
        if (result.locked) {
          setLocked(true)
          addToast('🔒 Your assessment has been locked. Contact your examiner.', 'error', 0)
        }
      }
    })

    // Examiner control commands via socket
    const socket = getSocket()
    if (socket) {
      socket.on('control_command', ({ action }) => {
        if (action === 'pause') {
          addToast('⏸️ Your assessment has been paused by the examiner.', 'warning', 0)
        } else if (action === 'resume') {
          addToast('▶️ Your assessment has been resumed.', 'success', 5000)
        } else if (action === 'terminate') {
          addToast('🛑 Your assessment has been terminated by the examiner.', 'error', 0)
          setTimeout(onComplete, 3000)
        }
      })
      socket.on('you_are_locked', () => {
        setLocked(true)
        addToast('🔒 Assessment locked due to violations. Waiting for examiner.', 'error', 0)
      })
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f1117' }}>

      {/* Top Bar */}
      <div style={{
        height: 50, background: '#1a1d27', borderBottom: '1px solid #2e3347',
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 16, flexShrink: 0
      }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>👁️ 3rdEyeZ360</span>
        <span style={{ color: '#8b90a0', fontSize: 13 }}>|</span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{exam.name}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Timer */}
          <div style={{
            background: '#22263a', padding: '5px 14px', borderRadius: 8,
            fontSize: 15, fontWeight: 700,
            color: parseInt(formatted().split(':')[0]) < 5 ? '#f75f5f' : '#34c97a'
          }}>
            ⏱ {formatted()}
          </div>
          {/* Violations */}
          <div style={{
            background: violationCount > 0 ? '#2a1010' : '#22263a',
            padding: '5px 12px', borderRadius: 8, fontSize: 13,
            color: violationCount > 0 ? '#f75f5f' : '#8b90a0'
          }}>
            ⚠️ {violationCount} violation{violationCount !== 1 ? 's' : ''}
          </div>
          {/* Status */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: '#34c97a'
          }}>
            <span style={{
              width: 8, height: 8, background: '#34c97a',
              borderRadius: '50%', animation: 'pulse 1.5s infinite'
            }} />
            Monitoring Active
          </div>
        </div>
      </div>

      {/* Quick links bar */}
      {exam.allowed_websites?.length > 0 && (
        <div style={{
          height: 36, background: '#22263a', borderBottom: '1px solid #2e3347',
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8, flexShrink: 0
        }}>
          <span style={{ fontSize: 11, color: '#8b90a0', marginRight: 4 }}>Allowed:</span>
          {exam.allowed_websites.map((site, i) => (
            <button key={i} style={{
              background: '#1a1d27', border: '1px solid #2e3347',
              borderRadius: 6, padding: '3px 10px', fontSize: 12, color: '#4f8ef7',
              cursor: 'pointer'
            }}>
              🔗 {site}
            </button>
          ))}
        </div>
      )}

      {/* Browser area — BrowserView is overlaid here by Electron */}
      <div style={{ flex: 1, background: '#0a0c14', position: 'relative' }}>
        {isLocked && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', zIndex: 100
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Assessment Locked</h2>
            <p style={{ color: '#8b90a0', fontSize: 14, textAlign: 'center', maxWidth: 320 }}>
              Your assessment has been locked due to repeated violations.<br/>
              Please wait for your examiner to take action.
            </p>
          </div>
        )}
      </div>

      {/* Bottom status bar */}
      <div style={{
        height: 32, background: '#1a1d27', borderTop: '1px solid #2e3347',
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 20,
        fontSize: 11, color: '#8b90a0', flexShrink: 0
      }}>
        <span>📷 Camera Active</span>
        <span>🌐 Connected</span>
        <span>🔴 Recording</span>
        <span style={{ marginLeft: 'auto', color: '#f75f5f', fontSize: 11 }}>
          ⚠️ Do not close this window during the exam
        </span>
      </div>

      {/* Hidden webcam for capture */}
      <video ref={videoRef} autoPlay muted style={{ display: 'none' }} />

      {/* Toaster overlay */}
      <Toaster toasts={toasts} onRemove={removeToast} />

      {/* Chat */}
      <ChatWindow
        examId={exam.exam_id}
        candidateId={user.user_id}
        currentUser={user}
        token={accessToken}
      />

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}