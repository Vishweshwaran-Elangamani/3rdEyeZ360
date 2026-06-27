import React, { useState } from 'react'
import axios from 'axios'
import useAuthStore from '../../store/authStore'

const API = 'http://localhost:3000'

const RULES = [
  '👁️  Keep your face clearly visible in the camera at all times',
  '📵  No mobile phones or secondary devices on your desk',
  '👥  Ensure you are alone — no other person should be visible',
  '🔇  Stay in a quiet room — background voices will be flagged',
  '🖥️  Only the allowed exam websites will be accessible',
  '⚡  Keep your laptop charger connected throughout',
  '🚫  Do not attempt to close, minimize, or switch windows',
  '👀  Keep your eyes focused on the screen',
  '💬  Use the chat button if you need to contact the examiner',
  '⏳  You will receive friendly guidance before any violation is recorded',
]

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

export default function Instructions({ exam, onStart }) {
  const [agreed, setAgreed] = useState(false)

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
        flex: 1, overflowY: 'auto',
        display: 'flex', alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}>
        <div style={{
          background: '#1a1d27', border: '1px solid #2e3347',
          borderRadius: 16, padding: 40, width: 560,
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)'
        }}>
          <div style={{
            background: '#0f2a1a', border: '1px solid #34c97a',
            borderRadius: 10, padding: '12px 16px', marginBottom: 24,
            display: 'flex', alignItems: 'center', gap: 10
          }}>
            <span style={{ fontSize: 18 }}>📋</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{exam?.name}</div>
              <div style={{ fontSize: 12, color: '#8b90a0' }}>
                {exam?.date} · {exam?.start_time} – {exam?.end_time} · {exam?.duration_minutes} mins
              </div>
            </div>
          </div>

          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Exam Instructions</h2>

          {exam?.instructions && (
            <div style={{
              background: '#22263a', borderRadius: 8, padding: '12px 16px',
              fontSize: 13, color: '#c8cad0', marginBottom: 16, lineHeight: 1.7
            }}>
              {exam.instructions}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {RULES.map((rule, i) => (
              <div key={i} style={{
                fontSize: 13, color: '#c8cad0', padding: '8px 12px',
                background: '#22263a', borderRadius: 6, lineHeight: 1.5
              }}>{rule}</div>
            ))}
          </div>

          <label style={{
            display: 'flex', alignItems: 'center', gap: 10,
            cursor: 'pointer', marginBottom: 24, fontSize: 14
          }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <span>I have read and understood all the instructions</span>
          </label>

          <button
            onClick={onStart}
            disabled={!agreed}
            className="btn btn-primary"
            style={{
              width: '100%', padding: '12px 0', fontSize: 15,
              opacity: agreed ? 1 : 0.4, cursor: agreed ? 'pointer' : 'not-allowed'
            }}
          >
            Start Monitoring →
          </button>
        </div>
      </div>
    </div>
  )
}