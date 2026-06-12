import React, { useState, useEffect } from 'react'

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
    // Examiner will emit socket event — handled in ActiveExam
    // This screen just waits
  }, [])

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: '#0f1117'
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
              {mins}m {String(secs).padStart(2,'0')}s remaining
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
  )
}