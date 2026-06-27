import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import useAuthStore from '../../store/authStore'

const API = 'http://localhost:3000'

function LogoutButton() {
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    if (loading) return
    setLoading(true)

    try {
      const { refreshToken } = useAuthStore.getState()

      if (refreshToken) {
        try {
          await axios.post(`${API}/api/auth/logout`, { refreshtoken: refreshToken })
        } catch (e) {
          console.log('Logout API failed, clearing local session anyway', e)
        }
      }
    } finally {
      localStorage.removeItem('app-screen')
      localStorage.removeItem('auth-storage')
      localStorage.removeItem('exam-storage')
      useAuthStore.getState().clearAuth()
      
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="btn btn-ghost"
      style={{ padding: '8px 14px', fontSize: 12 }}
    >
      {loading ? 'Signing out...' : 'Logout'}
    </button>
  )
}

export default function PreCheck({ onPass }) {
  const videoRef = useRef(null)
  const [checks, setChecks] = useState({
    camera: null, face: null, internet: null
  })
  const [stream, setStream] = useState(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    startChecks()
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()) }
  }, [])

  const startChecks = async () => {
    setRunning(true)
    const results = { camera: false, face: false, internet: false }

    try {
      await fetch('http://localhost:3000/health')
      results.internet = true
    } catch {
      results.internet = false
    }
    setChecks(prev => ({ ...prev, internet: results.internet }))

    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      setStream(s)
      if (videoRef.current) videoRef.current.srcObject = s
      results.camera = true
      setChecks(prev => ({ ...prev, camera: true }))

      await new Promise(r => setTimeout(r, 2000))
      results.face = true
      setChecks(prev => ({ ...prev, face: true }))
    } catch {
      results.camera = false
      setChecks(prev => ({ ...prev, camera: false, face: false }))
    }

    setRunning(false)
  }

  const allPassed = Object.values(checks).every(v => v === true)

  const Item = ({ label, status }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', background: '#22263a',
      borderRadius: 8, border: `1px solid ${status === true ? '#34c97a' : status === false ? '#f75f5f' : '#2e3347'}`
    }}>
      <span style={{ fontSize: 20 }}>
        {status === null ? '⏳' : status ? '✅' : '❌'}
      </span>
      <span style={{ fontSize: 14, color: '#e8eaf0' }}>{label}</span>
      {status === false && (
        <span style={{ fontSize: 12, color: '#f75f5f', marginLeft: 'auto' }}>
          {label === 'Camera' ? 'Allow camera access' :
           label === 'Internet' ? 'Check connection' : 'Show your face'}
        </span>
      )}
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: '#0f1117'
    }}>
      <div style={{
        height: 56, background: '#1a1d27', borderBottom: '1px solid #2e3347',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>👁️</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#e8eaf0' }}>3rdEyeZ360</span>
        </div>
        <LogoutButton />
      </div>

      <div style={{
        flex: 1, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 20
      }}>
        <div style={{
          background: '#1a1d27', border: '1px solid #2e3347',
          borderRadius: 16, padding: 40, width: 480,
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)'
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>System Check</h2>
          <p style={{ color: '#8b90a0', fontSize: 13, marginBottom: 24 }}>
            We need to verify your setup before the exam starts.
          </p>

          <div style={{
            width: '100%', aspectRatio: '16/9',
            background: '#0f1117', borderRadius: 10,
            overflow: 'hidden', marginBottom: 20
          }}>
            <video ref={videoRef} autoPlay muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            <Item label="Camera & Microphone" status={checks.camera} />
            <Item label="Face Visible" status={checks.face} />
            <Item label="Internet Connection" status={checks.internet} />
          </div>

          {running && (
            <p style={{ color: '#8b90a0', fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
              Running checks...
            </p>
          )}

          {!running && !allPassed && (
            <button onClick={startChecks} className="btn btn-ghost" style={{ width: '100%', marginBottom: 12 }}>
              Retry Checks
            </button>
          )}

          <button
            onClick={onPass}
            disabled={!allPassed}
            className="btn btn-primary"
            style={{
              width: '100%', padding: '12px 0', fontSize: 15,
              opacity: allPassed ? 1 : 0.4, cursor: allPassed ? 'pointer' : 'not-allowed'
            }}
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  )
}