import React, { useState } from 'react'
import axios from 'axios'
import useAuthStore from '../store/authStore'
import useExamStore from '../store/examStore'

const API = 'http://localhost:3000'
const SCREEN_STORAGE_KEY = 'app-screen'

export default function LogoutButton({ onLoggedOut, style = {} }) {
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    if (loading) return

    setLoading(true)

    try {
      const { refreshToken } = useAuthStore.getState()

      if (refreshToken) {
        try {
          await axios.post(`${API}/api/auth/logout`, {
            refreshtoken: refreshToken,
          })
        } catch (e) {
          console.log('Logout API failed, clearing local session anyway', e)
        }
      }
    } finally {
      useAuthStore.getState().clearAuth()
      useExamStore.getState().reset()
      localStorage.removeItem(SCREEN_STORAGE_KEY)
      localStorage.removeItem('auth-storage')
      localStorage.removeItem('exam-storage')
      onLoggedOut?.()
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="btn"
      style={{
        padding: '10px 16px',
        borderRadius: 10,
        border: '1px solid #3a4057',
        background: '#1a1d27',
        color: '#e8eaf0',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        ...style,
      }}
    >
      {loading ? 'Signing out...' : 'Logout'}
    </button>
  )
}