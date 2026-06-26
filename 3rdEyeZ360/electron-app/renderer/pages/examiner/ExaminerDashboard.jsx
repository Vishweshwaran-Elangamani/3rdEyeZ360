import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import useAuthStore from '../../store/authStore'
import { useSocket } from '../../hooks/useSocket'
import ChatWindow from '../../components/common/ChatWindow'
import CreateExam from './CreateExam'
import AssignCandidates from './AssignCandidates'

const API = 'http://localhost:3000'

const STATUS_COLORS = {
  ACTIVE: '#34c97a',
  READY: '#4f8ef7',
  INTERRUPTED: '#f5a623',
  LOCKED: '#f75f5f',
  COMPLETED: '#8b90a0',
  TERMINATED: '#f75f5f',
  ASSIGNED: '#555a6e',
  AVAILABLE: '#7c5ce7',
  PAUSED: '#f5a623',
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ background: '#22263a', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: '#8b90a0', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

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
      window.location.reload()
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="btn btn-ghost"
      style={{ padding: '7px 14px', fontSize: 13 }}
    >
      {loading ? 'Signing out...' : 'Logout'}
    </button>
  )
}

export default function ExaminerDashboard() {
  const [monitorTab, setMonitorTab] = useState('grid')
  const [reentryRequests, setReentryRequests] = useState([])
  const { user, accessToken } = useAuthStore()
  const socket = useSocket(accessToken)

  const [view, setView] = useState('list')
  const [exams, setExams] = useState([])
  const [selectedExam, setSelectedExam] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [liveData, setLiveData] = useState({})
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [violations, setViolations] = useState([])
  const [broadcastMsg, setBroadcastMsg] = useState('')
  const [loadingExams, setLoadingExams] = useState(false)
  const [actionMsg, setActionMsg] = useState('')

  const headers = { Authorization: `Bearer ${accessToken}` }

  const loadExams = useCallback(async () => {
    setLoadingExams(true)
    try {
      const res = await axios.get(`${API}/api/exams`, { headers })
      setExams(res.data || [])
    } catch (e) {
      console.error('loadExams:', e.message)
    } finally {
      setLoadingExams(false)
    }
  }, [accessToken])

  const loadCandidates = useCallback(async (examId) => {
    try {
      const res = await axios.get(`${API}/api/exams/${examId}/assessments`, { headers })
      setCandidates(res.data || [])
    } catch (e) {
      console.error('loadCandidates:', e.message)
    }
  }, [accessToken])

  const loadViolations = useCallback(async (candidateId, examId) => {
    try {
      const res = await axios.get(`${API}/api/violations/${examId}/${candidateId}`, { headers })
      setViolations(res.data || [])
    } catch (e) {
      console.error('loadViolations:', e.message)
    }
  }, [accessToken])

  useEffect(() => { loadExams() }, [loadExams])

  useEffect(() => {
    if (!socket || view !== 'monitor' || !selectedExam) return

    socket.emit('join_exam', { exam_id: selectedExam.exam_id, role: 'Examiner' })

    const onCandidateUpdate = (data) => {
      setLiveData(prev => ({ ...prev, [data.candidate_id]: data }))
    }
    const onViolationAlert = ({ candidate_id, violation }) => {
      setLiveData(prev => ({
        ...prev,
        [candidate_id]: { ...(prev[candidate_id] || {}), latestViolation: violation }
      }))
    }
    const onAssessmentUpdate = () => {
      loadCandidates(selectedExam.exam_id)
    }

    socket.on('candidate_update', onCandidateUpdate)
    socket.on('violation_alert', onViolationAlert)
    socket.on('assessment_updated', onAssessmentUpdate)

    return () => {
      socket.off('candidate_update', onCandidateUpdate)
      socket.off('violation_alert', onViolationAlert)
      socket.off('assessment_updated', onAssessmentUpdate)
    }
  }, [socket, view, selectedExam, loadCandidates])

  const openMonitor = (exam) => {
    setSelectedExam(exam)
    setSelectedCandidate(null)
    setViolations([])
    setLiveData({})
    loadCandidates(exam.exam_id)
    setView('monitor')
  }

  const startExam = async () => {
    if (!selectedExam) return
    try {
      await axios.patch(`${API}/api/exams/${selectedExam.exam_id}/start`, {}, { headers })
      if (socket) socket.emit('start_exam', { exam_id: selectedExam.exam_id })
      setActionMsg('✅ Exam started — candidates are being notified')
      setTimeout(() => setActionMsg(''), 4000)
      loadCandidates(selectedExam.exam_id)
    } catch (e) {
      setActionMsg('❌ Failed to start exam')
      setTimeout(() => setActionMsg(''), 4000)
    }
  }

  const doAction = async (assessmentId, action) => {
    const reason = window.prompt(`Reason for "${action}" (required):`)
    if (!reason || !reason.trim()) return
    try {
      await axios.post(
        `${API}/api/assessments/${assessmentId}/action`,
        { action, reason: reason.trim() },
        { headers }
      )
      if (socket) {
        socket.emit('examiner_control', {
          exam_id: selectedExam.exam_id,
          candidate_id: selectedCandidate?.candidate_id,
          action
        })
      }
      setActionMsg(`✅ ${action} applied`)
      setTimeout(() => setActionMsg(''), 3000)
      loadCandidates(selectedExam.exam_id)
    } catch (e) {
      setActionMsg(`❌ Action failed: ${e.response?.data?.detail || e.message}`)
      setTimeout(() => setActionMsg(''), 4000)
    }
  }

  const sendBroadcast = () => {
    if (!broadcastMsg.trim() || !socket) return
    socket.emit('broadcast_message', {
      exam_id: selectedExam.exam_id,
      examiner_id: user.user_id,
      message: broadcastMsg.trim()
    })
    setBroadcastMsg('')
    setActionMsg('📢 Broadcast sent to all candidates')
    setTimeout(() => setActionMsg(''), 3000)
  }

  const goBack = () => {
    setView('list')
    setSelectedExam(null)
    setSelectedCandidate(null)
    setCandidates([])
    setLiveData({})
    setViolations([])
    loadExams()
  }

  const loadReentryRequests = useCallback(async () => {
    try {
      if (!selectedExam?.exam_id) return

      const res = await axios.get(
        `${API}/api/exams/${selectedExam.exam_id}/requests`,
        { headers }
      )

      setReentryRequests(res.data || [])
    } catch (e) {
      console.error(e)
    }
  }, [selectedExam, accessToken])

  const handleReentry = async (assessmentId, requestId, approve) => {
    try {
      const url = `${API}/api/assessments/${assessmentId}/reentry/${requestId}/${approve ? 'approve' : 'reject'}`

      const body = approve ? {} : {
        reason: window.prompt('Rejection reason:') || 'Not approved'
      }

      await axios.post(url, body, { headers })

      if (socket) {
        socket.emit('reentry_decision', {
          assessment_id: assessmentId,
          approved: approve,
          exam_id: selectedExam.exam_id
        })
      }

      await loadReentryRequests()

      setActionMsg(approve ? '✅ Re-entry approved' : '❌ Re-entry rejected')
      setTimeout(() => setActionMsg(''), 3000)
    } catch (err) {
      console.error(err)
    }
  }

  if (view === 'create') {
    return (
      <CreateExam
        onBack={() => setView('list')}
        onCreated={(newExam) => {
          setSelectedExam(newExam)
          loadExams()
          setView('assign')
        }}
      />
    )
  }

  if (view === 'assign') {
    return (
      <AssignCandidates
        exam={selectedExam}
        onBack={() => {
          loadExams()
          setView('list')
        }}
      />
    )
  }

  if (view === 'list') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f1117' }}>
        <div style={{
          height: 56, background: '#1a1d27', borderBottom: '1px solid #2e3347',
          display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12,
          flexShrink: 0
        }}>
          <span style={{ fontSize: 20 }}>👁️</span>
          <span style={{ fontWeight: 700, fontSize: 16 }}>3rdEyeZ360</span>
          <span style={{ fontSize: 12, color: '#8b90a0' }}>— {user?.role} Dashboard</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#8b90a0' }}>{user?.name}</span>
            <LogoutButton />
            <button
              onClick={() => setView('create')}
              className="btn btn-primary"
              style={{ padding: '7px 18px', fontSize: 13 }}
            >
              + Create Exam
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Your Exams</h2>

          {loadingExams ? (
            <div style={{ textAlign: 'center', color: '#8b90a0', padding: 60 }}>
              Loading exams...
            </div>
          ) : exams.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#8b90a0', padding: '60px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
              <p style={{ marginBottom: 16 }}>No exams yet.</p>
              <button
                onClick={() => setView('create')}
                className="btn btn-primary"
                style={{ padding: '10px 24px', fontSize: 14 }}
              >
                Create your first exam
              </button>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 16
            }}>
              {exams.map(exam => (
                <div key={exam.exam_id} style={{
                  background: '#1a1d27', border: '1px solid #2e3347',
                  borderRadius: 12, padding: 20,
                  display: 'flex', flexDirection: 'column', gap: 10
                }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{exam.name}</div>
                  <div style={{ fontSize: 12, color: '#8b90a0' }}>
                    {exam.date} &nbsp;·&nbsp; {exam.start_time} – {exam.end_time}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      background: exam.status === 'Running' ? '#0f2a1a' : '#22263a',
                      color: exam.status === 'Running' ? '#34c97a' : '#8b90a0',
                      padding: '3px 10px', borderRadius: 20, fontSize: 12
                    }}>{exam.status}</span>
                    <span style={{ fontSize: 12, color: '#555a6e' }}>
                      ⏱ {exam.duration_minutes} min
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      onClick={() => openMonitor(exam)}
                      className="btn btn-primary"
                      style={{ flex: 1, fontSize: 13, padding: '7px 0' }}
                    >
                      🖥 Monitor
                    </button>
                    <button
                      onClick={() => { setSelectedExam(exam); setView('assign') }}
                      className="btn btn-ghost"
                      style={{ flex: 1, fontSize: 13, padding: '7px 0' }}
                    >
                      👥 Assign
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (view === 'monitor') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f1117' }}>
        <div style={{
          height: 52, background: '#1a1d27', borderBottom: '1px solid #2e3347',
          display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
          flexShrink: 0, flexWrap: 'wrap'
        }}>
          <button onClick={goBack} className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }}>
            ← Back
          </button>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{selectedExam?.name}</span>
          <span style={{ fontSize: 12, color: '#8b90a0' }}>
            · {candidates.length} candidate{candidates.length !== 1 ? 's' : ''}
          </span>

          {actionMsg && (
            <span style={{ fontSize: 12, color: '#34c97a', marginLeft: 8 }}>
              {actionMsg}
            </span>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <LogoutButton />
            <input
              value={broadcastMsg}
              onChange={e => setBroadcastMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendBroadcast()}
              placeholder="Broadcast to all candidates..."
              style={{ width: 220, padding: '6px 10px', fontSize: 12 }}
            />
            <button onClick={sendBroadcast} className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }}>
              📢 Send
            </button>
            <button onClick={startExam} className="btn btn-success" style={{ padding: '6px 16px', fontSize: 12 }}>
              ▶ Start Exam
            </button>
            <button
              onClick={() => { setSelectedExam(selectedExam); setView('assign') }}
              className="btn btn-ghost"
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              👥 Assign
            </button>
          </div>
        </div>

        <div style={{
          height: 40, background: '#1a1d27', borderBottom: '1px solid #2e3347',
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: 4, flexShrink: 0
        }}>
          {[
            { key: 'grid', label: '🖥 Live Grid' },
            {
              key: 'requests',
              label: `📬 Requests${reentryRequests.filter(r => r.status === 'Pending').length > 0
                ? ` (${reentryRequests.filter(r => r.status === 'Pending').length})` : ''}`
            }
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { setMonitorTab(t.key); if (t.key === 'requests') loadReentryRequests() }}
              style={{
                padding: '5px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                background: monitorTab === t.key ? '#22263a' : 'transparent',
                color: monitorTab === t.key ? '#e8eaf0' : '#8b90a0',
                border: monitorTab === t.key ? '1px solid #2e3347' : '1px solid transparent'
              }}
            >{t.label}</button>
          ))}
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{
            flex: 1, overflowY: 'auto', padding: 16,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12, alignContent: 'start'
          }}>
            {candidates.length === 0 && (
              <div style={{
                gridColumn: '1 / -1', textAlign: 'center',
                color: '#8b90a0', padding: '60px 0', fontSize: 13
              }}>
                No candidates assigned yet.{' '}
                <span
                  onClick={() => setView('assign')}
                  style={{ color: '#4f8ef7', cursor: 'pointer' }}
                >
                  Assign candidates →
                </span>
              </div>
            )}

            {candidates.map(c => {
              const live = liveData[c.candidate_id] || {}
              const color = STATUS_COLORS[c.status] || '#555a6e'
              const isAlert = !!live.latestViolation
              const isActive = c.candidate_id === selectedCandidate?.candidate_id

              return (
                <div
                  key={c.candidate_id}
                  onClick={() => {
                    setSelectedCandidate(c)
                    loadViolations(c.candidate_id, selectedExam.exam_id)
                  }}
                  style={{
                    background: isActive ? '#1e2235' : '#1a1d27',
                    border: `2px solid ${isAlert ? '#f75f5f' : isActive ? '#4f8ef7' : color}`,
                    borderRadius: 10, padding: 14, cursor: 'pointer',
                    transition: 'all 0.15s',
                    outline: isActive ? '1px solid #4f8ef7' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{
                      fontSize: 10, color: '#555a6e', maxWidth: 120,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {c.candidate_id}
                    </span>
                    <span style={{
                      width: 9, height: 9, borderRadius: '50%',
                      background: color, display: 'inline-block', flexShrink: 0
                    }} />
                  </div>

                  <div style={{
                    fontWeight: 600, fontSize: 13, marginBottom: 3,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>
                    {c.candidate_name || 'Candidate'}
                  </div>

                  <div style={{ fontSize: 11, color: color, marginBottom: 8, fontWeight: 500 }}>
                    {c.status}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8b90a0' }}>
                    <span>⚠️ {c.violation_count || 0}</span>
                    <span>📊 {c.risk_score || 0}</span>
                    <span>💯 {c.credibility_score ?? 100}</span>
                  </div>

                  {isAlert && (
                    <div style={{
                      marginTop: 8, fontSize: 10, background: '#2a1010',
                      borderRadius: 5, padding: '4px 8px', color: '#f75f5f',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                    }}>
                      🚨 {live.latestViolation.type}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {selectedCandidate && (
            <div style={{
              width: 320, background: '#1a1d27', borderLeft: '1px solid #2e3347',
              display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0
            }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #2e3347', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {selectedCandidate.candidate_name || selectedCandidate.candidate_id}
                    </div>
                    <div style={{ fontSize: 12, color: '#8b90a0', marginTop: 2 }}>
                      {selectedCandidate.status}
                    </div>
                  </div>
                  <button
                    onClick={() => { setSelectedCandidate(null); setViolations([]) }}
                    style={{ background: 'none', color: '#8b90a0', fontSize: 20, cursor: 'pointer' }}
                  >×</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <StatBox label="Violations" value={selectedCandidate.violation_count || 0} color="#f75f5f" />
                  <StatBox label="Risk Score" value={selectedCandidate.risk_score || 0} color="#f5a623" />
                  <StatBox label="Credibility" value={`${selectedCandidate.credibility_score ?? 100}%`} color="#34c97a" />
                  <StatBox label="Warnings" value={selectedCandidate.warning_count || 0} color="#8b90a0" />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => doAction(selectedCandidate.assessment_id, 'pause')}
                      className="btn btn-ghost"
                      style={{ flex: 1, fontSize: 12 }}
                    >⏸ Pause</button>
                    <button
                      onClick={() => doAction(selectedCandidate.assessment_id, 'resume')}
                      className="btn btn-ghost"
                      style={{ flex: 1, fontSize: 12 }}
                    >▶ Resume</button>
                  </div>
                  <button
                    onClick={() => doAction(selectedCandidate.assessment_id, 'terminate')}
                    className="btn btn-danger"
                    style={{ width: '100%', fontSize: 12 }}
                  >🛑 Terminate Assessment</button>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #2e3347' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
                    Violations ({violations.length})
                  </div>
                  {violations.length === 0 ? (
                    <p style={{ fontSize: 12, color: '#8b90a0' }}>No violations recorded.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {violations.map((v, i) => (
                        <div key={v.violation_id || i} style={{
                          background: '#22263a', borderRadius: 8, padding: '10px 12px',
                          borderLeft: '3px solid #f75f5f'
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
                            {v.type}
                          </div>
                          <div style={{ fontSize: 11, color: '#8b90a0' }}>
                            {v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : '—'}
                            {v.confidence != null ? ` · ${Math.round(v.confidence * 100)}% confidence` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ padding: '14px 20px' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
                    Chat with Candidate
                  </div>
                  <ChatWindow
                    examId={selectedExam.exam_id}
                    candidateId={selectedCandidate.candidate_id}
                    currentUser={{ user_id: user.user_id, role: user.role }}
                    token={accessToken}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}