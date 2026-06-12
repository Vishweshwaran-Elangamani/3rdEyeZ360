import React, { useState } from 'react'
import axios from 'axios'
import useAuthStore from '../store/authStore'

const API = 'http://localhost:3000'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore(s => s.setAuth)

  const handleLogin = async () => {
    setLoading(true); setError('')
    try {
      const res = await axios.post(`${API}/api/auth/login`, { email, password })
      setAuth(res.data.user, res.data.access_token, res.data.refresh_token)
      onLogin(res.data.user)
    } catch (e) {
      setError('Invalid email or password')
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#0f1117'
    }}>
      <div style={{
        background: '#1a1d27', border: '1px solid #2e3347',
        borderRadius: 16, padding: 40, width: 380,
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, #4f8ef7, #7c5ce7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, margin: '0 auto 12px'
          }}>👁️</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8eaf0' }}>3rdEyeZ360</h1>
          <p style={{ color: '#8b90a0', fontSize: 13, marginTop: 4 }}>Secure Assessment Platform</p>
        </div>

        {error && (
          <div style={{
            background: '#2a1010', border: '1px solid #f75f5f',
            borderRadius: 8, padding: '10px 14px', color: '#f75f5f',
            fontSize: 13, marginBottom: 16
          }}>{error}</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: '#8b90a0', marginBottom: 6, display: 'block' }}>
              Email
            </label>
            <input value={email} onChange={e => setEmail(e.target.value)}
              type="email" placeholder="your@email.com"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#8b90a0', marginBottom: 6, display: 'block' }}>
              Password
            </label>
            <input value={password} onChange={e => setPassword(e.target.value)}
              type="password" placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <button onClick={handleLogin} disabled={loading} className="btn btn-primary"
            style={{ width: '100%', marginTop: 8, padding: '11px 0', fontSize: 15 }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  )
}