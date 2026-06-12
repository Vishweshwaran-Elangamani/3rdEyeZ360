import React, { useState } from 'react'
import axios from 'axios'
import useAuthStore from '../../store/authStore'
import { getSocket } from '../../hooks/useSocket'

const API = 'http://localhost:3000'

export default function ReEntryRequest({ assessment, exam, onApproved }) {
  const { accessToken } = useAuthStore()
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!reason.trim()) { setError('Please explain why you need to re-enter'); return }
    setLoading(true); setError('')
    try {
      await axios.post(
        `${API}/api/assessments/${assessment.assessment_id}/reentry`,
        { reason: reason.trim() },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      setSubmitted(true)
      // Listen for approval via socket
      const socket = getSocket()
      if (socket) {
        socket.on('reentry_approved', ({ assessment_id }) => {
          if (assessment_id === assessment.assessment_id) {
            onApproved()
          }
        })
        socket.on('reentry_rejected', ({ assessment_id, reason: rejReason }) => {
          if (assessment_id === assessment.assessment_id) {
            setSubmitted(false)
            setError(`Re-entry rejected: ${rejReason || 'Contact your examiner'}`)
          }
        })
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to submit request')
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#0f1117'
    }}>
      <div style={{
        background: '#1a1d27', border: '1px solid #f5a623',
        borderRadius: 16, padding: 40, width: 440,
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)'
      }}>
        <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>⚠️</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
          Assessment Interrupted
        </h2>
        <p style={{ color: '#8b90a0', fontSize: 13, textAlign: 'center', marginBottom: 28 }}>
          Your assessment was interrupted. To re-enter, please provide a reason
          and wait for your examiner to approve.
        </p>

        {error && (
          <div style={{
            background: '#2a1010', border: '1px solid #f75f5f',
            borderRadius: 8, padding: '10px 14px', color: '#f75f5f',
            fontSize: 13, marginBottom: 16
          }}>{error}</div>
        )}

        {!submitted ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#8b90a0', display: 'block', marginBottom: 6 }}>
                Reason for interruption *
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={4}
                placeholder="e.g. My laptop battery died and I had to restart..."
                style={{
                  width: '100%', background: '#22263a', border: '1px solid #2e3347',
                  borderRadius: 8, padding: '10px 12px', color: '#e8eaf0',
                  fontSize: 14, resize: 'none', outline: 'none',
                  fontFamily: 'Inter, sans-serif', lineHeight: 1.6
                }}
              />
            </div>
            <button
              onClick={submit}
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px 0', fontSize: 15 }}
            >
              {loading ? 'Submitting...' : 'Request Re-entry'}
            </button>
          </>
        ) : (
          <div style={{
            background: '#0f2a1a', border: '1px solid #34c97a',
            borderRadius: 10, padding: 20, textAlign: 'center'
          }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
              Request Submitted
            </div>
            <p style={{ fontSize: 13, color: '#8b90a0' }}>
              Waiting for examiner approval. Please stay at your desk
              and keep your camera visible.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}