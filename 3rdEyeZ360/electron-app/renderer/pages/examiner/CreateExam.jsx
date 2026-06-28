import React, { useState } from 'react'
import axios from 'axios'
import useAuthStore from '../../store/authStore'

const API = 'http://localhost:3000'

const defaultForm = {
  name: '',
  description: '',
  date: '',
  start_time: '',
  end_time: '',
  duration_minutes: 120,
  violation_threshold: 10,
  instructions: '',
  allowed_websites: [],
  allowed_applications: []
}

function Field({ label, error, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ fontSize: 12, color: '#8b90a0', display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {error && <div style={{ fontSize: 11, color: '#f75f5f', marginTop: 4 }}>{error}</div>}
    </div>
  )
}

const inputStyle = {
  background: '#22263a',
  border: '1px solid #2e3347',
  borderRadius: 8,
  padding: '8px 12px',
  color: '#e8eaf0',
  fontSize: 14,
  width: '100%',
  outline: 'none'
}

export default function CreateExam({ onBack, onCreated }) {
  const { user, accessToken } = useAuthStore()
  const [form, setForm] = useState(defaultForm)
  const [websiteInput, setWebsiteInput] = useState('')
  const [appInput, setAppInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [saved, setSaved] = useState(false)

  const headers = { Authorization: `Bearer ${accessToken}` }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const validate = () => {
    const e = {}

    if (!form.name.trim()) e.name = 'Exam name is required'
    if (!form.date) e.date = 'Date is required'
    if (!form.start_time) e.start_time = 'Start time is required'
    if (!form.end_time) e.end_time = 'End time is required'
    if (form.duration_minutes < 1) e.duration_minutes = 'Duration must be at least 1 minute'
    if (form.violation_threshold < 1) e.violation_threshold = 'Violation threshold must be at least 1'
    if (form.allowed_websites.length === 0) e.websites = 'Add at least one allowed website'

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const addWebsite = () => {
    if (!websiteInput.trim()) return

    let url = websiteInput.trim()
    if (!url.startsWith('http')) url = `https://${url}`

    if (!form.allowed_websites.includes(url)) {
      set('allowed_websites', [...form.allowed_websites, url])
    }

    setWebsiteInput('')
  }

  const removeWebsite = (url) => {
    set('allowed_websites', form.allowed_websites.filter(w => w !== url))
  }

  const addApp = () => {
    if (!appInput.trim()) return

    const value = appInput.trim()
    if (!form.allowed_applications.includes(value)) {
      set('allowed_applications', [...form.allowed_applications, value])
    }

    setAppInput('')
  }

  const removeApp = (app) => {
    set('allowed_applications', form.allowed_applications.filter(a => a !== app))
  }

  const handleSave = async (status = 'Published') => {
    if (!validate()) return

    setLoading(true)
    try {
      const res = await axios.post(
        `${API}/api/exams`,
        {
          ...form,
          examiner_id: user.user_id,
          status
        },
        { headers }
      )

      setSaved(true)
      setTimeout(() => onCreated?.(res.data), 1200)
    } catch (e) {
      setErrors({ submit: e.response?.data?.detail || 'Failed to create exam' })
    } finally {
      setLoading(false)
    }
  }

  if (saved) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f1117'
        }}
      >
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Exam Created!</h2>
        <p style={{ color: '#8b90a0', marginTop: 8 }}>Redirecting to exam list...</p>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f1117' }}>
      <div
        style={{
          height: 52,
          background: '#1a1d27',
          borderBottom: '1px solid #2e3347',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          gap: 12,
          flexShrink: 0
        }}
      >
        <button onClick={onBack} className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 13 }}>
          ← Back
        </button>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Create New Exam</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          {errors.submit && (
            <div
              style={{
                background: '#2a1010',
                border: '1px solid #f75f5f',
                borderRadius: 8,
                padding: '10px 16px',
                color: '#f75f5f',
                fontSize: 13,
                marginBottom: 20
              }}
            >
              {errors.submit}
            </div>
          )}

          <div
            style={{
              background: '#1a1d27',
              border: '1px solid #2e3347',
              borderRadius: 14,
              padding: 24,
              marginBottom: 20
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, color: '#4f8ef7' }}>
              📋 Basic Information
            </h3>

            <Field label="Exam Name *" error={errors.name}>
              <input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Java Technical Assessment"
                style={inputStyle}
              />
            </Field>

            <Field label="Description">
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                rows={3}
                placeholder="Brief description of this exam..."
                style={{
                  ...inputStyle,
                  resize: 'vertical'
                }}
              />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <Field label="Date *" error={errors.date}>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => set('date', e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label="Start Time *" error={errors.start_time}>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={e => set('start_time', e.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label="End Time *" error={errors.end_time}>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={e => set('end_time', e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Duration (minutes) *" error={errors.duration_minutes}>
                <input
                  type="number"
                  min={1}
                  max={480}
                  value={form.duration_minutes}
                  onChange={e => set('duration_minutes', parseInt(e.target.value, 10) || 0)}
                  style={inputStyle}
                />
              </Field>

              <Field label="Violation Threshold" error={errors.violation_threshold}>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.violation_threshold}
                  onChange={e => set('violation_threshold', parseInt(e.target.value, 10) || 10)}
                  style={inputStyle}
                />
                <div style={{ fontSize: 11, color: '#8b90a0', marginTop: 4 }}>
                  Assessment locks when total risk score reaches this number
                </div>
              </Field>
            </div>
          </div>

          <div
            style={{
              background: '#1a1d27',
              border: `1px solid ${errors.websites ? '#f75f5f' : '#2e3347'}`,
              borderRadius: 14,
              padding: 24,
              marginBottom: 20
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: '#4f8ef7' }}>
              🌐 Allowed Websites *
            </h3>

            <p style={{ fontSize: 12, color: '#8b90a0', marginBottom: 16 }}>
              Candidates can only visit these websites during the exam. Add the exam platform + login page.
            </p>

            {errors.websites && (
              <div style={{ fontSize: 11, color: '#f75f5f', marginBottom: 12 }}>{errors.websites}</div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                value={websiteInput}
                onChange={e => setWebsiteInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addWebsite()
                  }
                }}
                placeholder="exam.company.com"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={addWebsite} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>
                Add
              </button>
            </div>

            {form.allowed_websites.length === 0 ? (
              <div style={{ fontSize: 12, color: '#8b90a0', padding: '10px 0' }}>No websites added yet.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {form.allowed_websites.map(url => (
                  <div
                    key={url}
                    style={{
                      background: '#0f2a1a',
                      border: '1px solid #34c97a',
                      borderRadius: 20,
                      padding: '5px 12px',
                      fontSize: 12,
                      color: '#34c97a',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    🔗 {url}
                    <button
                      onClick={() => removeWebsite(url)}
                      style={{
                        background: 'none',
                        color: '#34c97a',
                        fontSize: 14,
                        cursor: 'pointer',
                        lineHeight: 1,
                        padding: 0
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              background: '#1a1d27',
              border: '1px solid #2e3347',
              borderRadius: 14,
              padding: 24,
              marginBottom: 20
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: '#4f8ef7' }}>
              💻 Allowed Applications
            </h3>

            <p style={{ fontSize: 12, color: '#8b90a0', marginBottom: 16 }}>
              Optional. Applications that are permitted to run (e.g. Calculator, Notepad). All others will be flagged.
            </p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                value={appInput}
                onChange={e => setAppInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addApp()
                  }
                }}
                placeholder="Calculator"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={addApp} className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: 13 }}>
                Add
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {form.allowed_applications.map(app => (
                <div
                  key={app}
                  style={{
                    background: '#22263a',
                    border: '1px solid #2e3347',
                    borderRadius: 20,
                    padding: '5px 12px',
                    fontSize: 12,
                    color: '#c8cad0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  {app}
                  <button
                    onClick={() => removeApp(app)}
                    style={{
                      background: 'none',
                      color: '#8b90a0',
                      fontSize: 14,
                      cursor: 'pointer',
                      lineHeight: 1,
                      padding: 0
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              background: '#1a1d27',
              border: '1px solid #2e3347',
              borderRadius: 14,
              padding: 24,
              marginBottom: 28
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: '#4f8ef7' }}>
              📝 Candidate Instructions
            </h3>

            <p style={{ fontSize: 12, color: '#8b90a0', marginBottom: 16 }}>
              These will be shown to candidates on the Instructions screen before the exam starts.
            </p>

            <textarea
              value={form.instructions}
              onChange={e => set('instructions', e.target.value)}
              rows={5}
              placeholder="e.g. This is a 2-hour Java assessment. Keep your camera on at all times. Read all questions carefully..."
              style={{
                ...inputStyle,
                padding: '10px 12px',
                resize: 'vertical',
                lineHeight: 1.7
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              onClick={() => handleSave('Draft')}
              disabled={loading}
              className="btn btn-ghost"
              style={{ padding: '11px 24px', fontSize: 14 }}
            >
              Save as Draft
            </button>

            <button
              onClick={() => handleSave('Published')}
              disabled={loading}
              className="btn btn-primary"
              style={{ padding: '11px 28px', fontSize: 14 }}
            >
              {loading ? 'Creating...' : '✅ Publish Exam'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}