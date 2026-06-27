import React, { useState, useEffect } from 'react'
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

export default function WaitScreen({ exam, onExamStart }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const startStr = `${exam?.date}T${exam?.start_time}:00`
  const startTime = new Date(startStr)
  const diffMs = startTime - now
  const diffSecs = Math.max(0, Math.floor(diffMs / 1000))
  const mins = Math.floor(diffSecs / 60)
  const secs = diffSecs % 60

  useEffect(() => {
  }, [])

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
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 20
      }}>
        <div style={{ textAlign: 'center', maxWidth: 440 }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>⏳</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
            Waiting for Exam to Begin
          </h2>
          <p style={{ color: '#8b90a0', fontSize: 14, marginBottom: 32 }}>
            Your examiner will start the exam. Please stay at your desk and remain visible on camera.
          </p>

          <div style={{
            background: '#1a1d27', border: '1px solid #2e3347',
            borderRadius: 16, padding: 32, marginBottom: 24
          }}>
            <div style={{ fontSize: 13, color: '#8b90a0', marginBottom: 8 }}>Exam starts at</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#4f8ef7' }}>
              {exam?.start_time}
            </div>
            {diffSecs > 0 && (
              <div style={{ fontSize: 13, color: '#8b90a0', marginTop: 8 }}>
                {mins}m {String(secs).padStart(2, '0')}s remaining
              </div>
            )}
          </div>

          <div style={{
            background: '#0f2a1a', border: '1px solid #34c97a',
            borderRadius: 10, padding: '12px 16px',
            fontSize: 13, color: '#34c97a'
          }}>
            ✅ Your monitoring is active. Stay visible on camera.
          </div>
        </div>
      </div>
    </div>
  )
}