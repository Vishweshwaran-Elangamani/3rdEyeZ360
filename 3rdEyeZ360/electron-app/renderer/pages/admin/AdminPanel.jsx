import React, { useState, useEffect } from 'react'
import axios from 'axios'
import useAuthStore from '../../store/authStore'

const API = 'http://localhost:3000'

const TABS = ['Dashboard', 'Candidates', 'Examiners', 'Audit Logs']

export default function AdminPanel() {
  const { user, accessToken } = useAuthStore()
  const [tab, setTab] = useState('Dashboard')
  const [stats, setStats] = useState({})
  const [users, setUsers] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'Candidate' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const headers = { Authorization: `Bearer ${accessToken}` }

  useEffect(() => { loadStats() }, [])
  useEffect(() => {
    if (tab === 'Candidates') loadUsers('Candidate')
    if (tab === 'Examiners') loadUsers('Examiner')
    if (tab === 'Audit Logs') loadAuditLogs()
  }, [tab])

  const loadStats = async () => {
    try {
      const res = await axios.get(`${API}/api/admin/stats`, { headers })
      setStats(res.data)
    } catch { setStats({ total_candidates: 0, total_examiners: 0, active_assessments: 0, total_exams: 0 }) }
  }

  const loadUsers = async (role) => {
    const res = await axios.get(`${API}/api/users?role=${role}`, { headers })
    setUsers(res.data)
  }

  const loadAuditLogs = async () => {
    const res = await axios.get(`${API}/api/admin/audit-logs`, { headers })
    setAuditLogs(res.data)
  }

  const toggleUserStatus = async (userId, currentStatus) => {
    const action = currentStatus === 'Active' ? 'disable' : 'enable'
    await axios.post(`${API}/api/users/${userId}/${action}`, {}, { headers })
    setUsers(prev => prev.map(u =>
      u.user_id === userId
        ? { ...u, status: action === 'disable' ? 'Disabled' : 'Active' }
        : u
    ))
  }

  const createUser = async () => {
    setCreating(true); setCreateError('')
    try {
      await axios.post(`${API}/api/auth/register`, newUser, { headers })
      setShowCreate(false)
      setNewUser({ name: '', email: '', password: '', role: 'Candidate' })
      loadUsers(tab === 'Examiners' ? 'Examiner' : 'Candidate')
    } catch (e) {
      setCreateError(e.response?.data?.detail || 'Failed to create user')
    } finally { setCreating(false) }
  }

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  const StatCard = ({ label, value, icon, color }) => (
    <div style={{
      background: '#1a1d27', border: '1px solid #2e3347',
      borderRadius: 12, padding: '20px 24px', flex: 1
    }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value ?? '—'}</div>
      <div style={{ fontSize: 12, color: '#8b90a0', marginTop: 4 }}>{label}</div>
    </div>
  )

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f1117' }}>
      {/* Header */}
      <div style={{
        height: 52, background: '#1a1d27', borderBottom: '1px solid #2e3347',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, flexShrink: 0
      }}>
        <span style={{ fontSize: 20 }}>👁️</span>
        <span style={{ fontWeight: 700, fontSize: 16 }}>3rdEyeZ360</span>
        <span style={{ color: '#8b90a0', fontSize: 12 }}>— Admin Panel</span>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#8b90a0' }}>
          {user?.name}
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{
        height: 44, background: '#1a1d27', borderBottom: '1px solid #2e3347',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 4, flexShrink: 0
      }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 16px', borderRadius: 6, fontSize: 13,
            background: tab === t ? '#22263a' : 'transparent',
            color: tab === t ? '#e8eaf0' : '#8b90a0',
            border: tab === t ? '1px solid #2e3347' : '1px solid transparent',
            cursor: 'pointer', transition: 'all 0.15s'
          }}>{t}</button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* DASHBOARD */}
        {tab === 'Dashboard' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>System Overview</h2>
            <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
              <StatCard label="Total Candidates" value={stats.total_candidates} icon="👤" color="#4f8ef7" />
              <StatCard label="Total Examiners" value={stats.total_examiners} icon="🧑‍💼" color="#34c97a" />
              <StatCard label="Total Exams" value={stats.total_exams} icon="📋" color="#f5a623" />
              <StatCard label="Active Assessments" value={stats.active_assessments} icon="🔴" color="#f75f5f" />
            </div>

            <div style={{
              background: '#1a1d27', border: '1px solid #2e3347',
              borderRadius: 12, padding: 20
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Quick Actions</h3>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setTab('Candidates')} className="btn btn-ghost"
                  style={{ fontSize: 13 }}>👤 Manage Candidates</button>
                <button onClick={() => setTab('Examiners')} className="btn btn-ghost"
                  style={{ fontSize: 13 }}>🧑‍💼 Manage Examiners</button>
                <button onClick={() => setTab('Audit Logs')} className="btn btn-ghost"
                  style={{ fontSize: 13 }}>📜 View Audit Logs</button>
              </div>
            </div>
          </div>
        )}

        {/* CANDIDATES / EXAMINERS */}
        {(tab === 'Candidates' || tab === 'Examiners') && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>{tab}</h2>
              <button onClick={() => { setShowCreate(true); setNewUser(f => ({ ...f, role: tab === 'Examiners' ? 'Examiner' : 'Candidate' })) }}
                className="btn btn-primary" style={{ padding: '8px 18px', fontSize: 13 }}>
                + Create {tab === 'Examiners' ? 'Examiner' : 'Candidate'}
              </button>
            </div>

            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${tab.toLowerCase()}...`}
              style={{ marginBottom: 16, fontSize: 14 }}
            />

            {/* Create User Modal */}
            {showCreate && (
              <div style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
              }}>
                <div style={{
                  background: '#1a1d27', border: '1px solid #2e3347',
                  borderRadius: 16, padding: 32, width: 420
                }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>
                    Create {newUser.role}
                  </h3>
                  {createError && (
                    <div style={{
                      background: '#2a1010', color: '#f75f5f',
                      borderRadius: 8, padding: '8px 14px', fontSize: 13, marginBottom: 14
                    }}>{createError}</div>
                  )}
                  {[
                    ['Full Name', 'name', 'text', 'John Smith'],
                    ['Email', 'email', 'email', 'john@company.com'],
                    ['Password', 'password', 'password', '••••••••']
                  ].map(([label, key, type, ph]) => (
                    <div key={key} style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 12, color: '#8b90a0', display: 'block', marginBottom: 5 }}>
                        {label}
                      </label>
                      <input type={type} value={newUser[key]}
                        onChange={e => setNewUser(f => ({ ...f, [key]: e.target.value }))}
                        placeholder={ph}
                      />
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                    <button onClick={() => setShowCreate(false)}
                      className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                    <button onClick={createUser} disabled={creating}
                      className="btn btn-primary" style={{ flex: 1 }}>
                      {creating ? 'Creating...' : 'Create User'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Users Table */}
            <div style={{
              background: '#1a1d27', border: '1px solid #2e3347',
              borderRadius: 12, overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2e3347', background: '#22263a' }}>
                    {['Name', 'Email', 'Status', 'Created', 'Actions'].map(h => (
                      <th key={h} style={{
                        padding: '12px 16px', textAlign: 'left',
                        fontSize: 12, color: '#8b90a0', fontWeight: 600
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u, i) => (
                    <tr key={u.user_id} style={{
                      borderBottom: i < filtered.length - 1 ? '1px solid #2e3347' : 'none',
                      transition: 'background 0.1s'
                    }}>
                      <td style={{ padding: '13px 16px', fontSize: 14, fontWeight: 500 }}>
                        {u.name}
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: '#8b90a0' }}>
                        {u.email}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{
                          background: u.status === 'Active' ? '#0f2a1a' : '#2a1010',
                          color: u.status === 'Active' ? '#34c97a' : '#f75f5f',
                          padding: '3px 10px', borderRadius: 20, fontSize: 12
                        }}>{u.status}</span>
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 12, color: '#8b90a0' }}>
                        {u.created_at?.split('T')[0] || '—'}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <button
                          onClick={() => toggleUserStatus(u.user_id, u.status)}
                          className="btn btn-ghost"
                          style={{ fontSize: 12, padding: '5px 12px' }}>
                          {u.status === 'Active' ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{
                        padding: 40, textAlign: 'center',
                        color: '#8b90a0', fontSize: 13
                      }}>No users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AUDIT LOGS */}
        {tab === 'Audit Logs' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Audit Logs</h2>
            <div style={{
              background: '#1a1d27', border: '1px solid #2e3347',
              borderRadius: 12, overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#22263a', borderBottom: '1px solid #2e3347' }}>
                    {['Timestamp', 'User', 'Action', 'Reason'].map(h => (
                      <th key={h} style={{
                        padding: '12px 16px', textAlign: 'left',
                        fontSize: 12, color: '#8b90a0', fontWeight: 600
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log, i) => (
                    <tr key={log.audit_id || i} style={{
                      borderBottom: i < auditLogs.length - 1 ? '1px solid #2e3347' : 'none'
                    }}>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#8b90a0' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13 }}>{log.user_id}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#4f8ef7' }}>
                        {log.action}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#8b90a0' }}>
                        {log.reason || '—'}
                      </td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{
                        padding: 40, textAlign: 'center',
                        color: '#8b90a0', fontSize: 13
                      }}>No audit logs yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}