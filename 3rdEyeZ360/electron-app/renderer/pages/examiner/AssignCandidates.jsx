import React, { useState, useEffect } from 'react'
import axios from 'axios'
import useAuthStore from '../../store/authStore'

const API = 'http://localhost:3000'

export default function AssignCandidates({ exam, onBack }) {
  const { accessToken } = useAuthStore()
  const [allCandidates, setAllCandidates] = useState([])
  const [assigned, setAssigned] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const headers = { Authorization: `Bearer ${accessToken}` }

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [allRes, assignedRes] = await Promise.all([
      axios.get(`${API}/api/users?role=Candidate`, { headers }),
      axios.get(`${API}/api/exams/${exam.exam_id}/assessments`, { headers })
    ])
    setAllCandidates(allRes.data)
    setAssigned(assignedRes.data.map(a => a.candidate_id))
    setLoading(false)
  }

  const toggle = async (candidateId) => {
    setSaving(true)
    const isAssigned = assigned.includes(candidateId)
    try {
      if (isAssigned) {
        await axios.delete(`${API}/api/exams/${exam.exam_id}/assign/${candidateId}`, { headers })
        setAssigned(prev => prev.filter(id => id !== candidateId))
      } else {
        await axios.post(`${API}/api/exams/${exam.exam_id}/assign`,
          { candidate_id: candidateId }, { headers })
        setAssigned(prev => [...prev, candidateId])
      }
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const filtered = allCandidates.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f1117' }}>
      {/* Header */}
      <div style={{
        height: 52, background: '#1a1d27', borderBottom: '1px solid #2e3347',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12, flexShrink: 0
      }}>
        <button onClick={onBack} className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 13 }}>
          ← Back
        </button>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Assign Candidates</span>
        <span style={{ fontSize: 12, color: '#8b90a0' }}>— {exam.name}</span>
        <div style={{
          marginLeft: 'auto', background: '#22263a', borderRadius: 8,
          padding: '5px 14px', fontSize: 13
        }}>
          {assigned.length} assigned
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          {/* Search */}
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search candidates by name or email..."
            style={{ marginBottom: 20, fontSize: 14 }}
          />

          {loading ? (
            <div style={{ textAlign: 'center', color: '#8b90a0', padding: 40 }}>Loading candidates...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#8b90a0', padding: 40 }}>
              No candidates found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(c => {
                const isAssigned = assigned.includes(c.user_id)
                return (
                  <div key={c.user_id} style={{
                    background: '#1a1d27',
                    border: `1px solid ${isAssigned ? '#34c97a' : '#2e3347'}`,
                    borderRadius: 10, padding: '14px 18px',
                    display: 'flex', alignItems: 'center', gap: 14
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%',
                      background: isAssigned ? '#0f2a1a' : '#22263a',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, flexShrink: 0
                    }}>
                      {isAssigned ? '✅' : '👤'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: '#8b90a0' }}>{c.email}</div>
                    </div>
                    <button
                      onClick={() => toggle(c.user_id)}
                      disabled={saving}
                      className={isAssigned ? 'btn btn-ghost' : 'btn btn-primary'}
                      style={{ padding: '7px 16px', fontSize: 13, minWidth: 90 }}>
                      {isAssigned ? 'Remove' : 'Assign'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}