import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import Login from './pages/Login'
import PreCheck from './pages/candidate/PreCheck'
import Instructions from './pages/candidate/Instructions'
import WaitScreen from './pages/candidate/WaitScreen'
import ActiveExam from './pages/candidate/ActiveExam'
import ExaminerDashboard from './pages/examiner/ExaminerDashboard'
import AdminPanel from './pages/admin/AdminPanel'
import useAuthStore from './store/authStore'
import useExamStore from './store/examStore'
import { useSocket } from './hooks/useSocket'
import axios from 'axios'

const API = 'http://localhost:3000'
const SCREEN_STORAGE_KEY = 'app-screen'

function App() {
  const { user, accessToken } = useAuthStore()
  const { currentExam, currentAssessment, setExam, setAssessment } = useExamStore()
  const [screen, setScreenState] = useState(() => localStorage.getItem(SCREEN_STORAGE_KEY) || 'login')
  const socket = useSocket(accessToken)

  const setScreen = (nextScreen) => {
    setScreenState(nextScreen)
    localStorage.setItem(SCREEN_STORAGE_KEY, nextScreen)
  }

  const resetToLogin = () => {
    useAuthStore.getState().clearAuth()
    useExamStore.getState().reset()
    localStorage.removeItem('auth-storage')
    localStorage.removeItem('exam-storage')
    localStorage.setItem(SCREEN_STORAGE_KEY, 'login')
    setScreenState('login')
  }

  const handleLogout = async () => {
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
      resetToLogin()
    }
  }

  const handleLogin = async (loggedUser) => {
    if (loggedUser.role === 'Admin') {
      setScreen('admin')
    } else if (loggedUser.role === 'Examiner') {
      setScreen('examiner')
    } else {
      await loadCandidateExam()
      setScreen('precheck')
    }
  }

  const loadCandidateExam = async () => {
    try {
      const token = useAuthStore.getState().accessToken
      if (!token) return

      const res = await axios.get(`${API}/api/exams/candidate/upcoming`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (Array.isArray(res.data) && res.data.length > 0) {
        const firstExam = res.data[0]
        setExam(firstExam)
        setAssessment({
          assessmentid: firstExam.assessmentid || firstExam.assessment_id,
        })
      }
    } catch (e) {
      console.log('No exam found', e)
    }
  }

  useEffect(() => {
    const bootstrap = async () => {
      if (!user || !accessToken) {
        setScreen('login')
        return
      }

      try {
        if (user.role === 'Admin') {
          if (screen === 'login') setScreen('admin')
          return
        }

        if (user.role === 'Examiner') {
          if (screen === 'login') setScreen('examiner')
          return
        }

        if (user.role === 'Candidate') {
          if (!currentExam) {
            await loadCandidateExam()
          }

          const savedScreen = localStorage.getItem(SCREEN_STORAGE_KEY)

          if (savedScreen && savedScreen !== 'login') {
            setScreen(savedScreen)
          } else {
            setScreen('precheck')
          }
        }
      } catch (e) {
        console.log('Bootstrap failed', e)
        resetToLogin()
      }
    }

    bootstrap()
  }, [user, accessToken])

  const handlePreCheckPass = () => setScreen('instructions')

  const handleStartMonitoring = () => {
    if (socket && currentExam) {
      socket.emit('joinexam', {
        examid: currentExam.examid || currentExam.exam_id,
        candidateid: user?.userid || user?.user_id,
        role: 'Candidate',
      })
    }
    setScreen('wait')
  }

  useEffect(() => {
    if (!socket) return

    const onExamStarted = () => setScreen('exam')
    const onControlCommand = ({ action }) => {
      if (action === 'terminate') setScreen('complete')
    }

    socket.on('examstarted', onExamStarted)
    socket.on('controlcommand', onControlCommand)

    return () => {
      socket.off('examstarted', onExamStarted)
      socket.off('controlcommand', onControlCommand)
    }
  }, [socket])

  const handleExamComplete = () => setScreen('complete')

  if (screen === 'login') return <Login onLogin={handleLogin} />
  if (screen === 'admin') return <AdminPanel />
  if (screen === 'examiner') return <ExaminerDashboard />
  if (screen === 'precheck') return <PreCheck onPass={handlePreCheckPass} />
  if (screen === 'instructions') return <Instructions exam={currentExam} onStart={handleStartMonitoring} />
  if (screen === 'wait') return <WaitScreen exam={currentExam} onExamStart={() => setScreen('exam')} />

  if (screen === 'exam') {
    return (
      <ActiveExam
        exam={currentExam}
        assessment={currentAssessment}
        onComplete={handleExamComplete}
      />
    )
  }

  if (screen === 'complete') {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#0f1117',
          color: '#fff',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div
          style={{
            height: 56,
            background: '#1a1d27',
            borderBottom: '1px solid #2e3347',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>👁️</span>
            <span style={{ fontWeight: 700, fontSize: 15 }}>3rdEyeZ360</span>
          </div>

          <button
            onClick={handleLogout}
            className="btn btn-ghost"
            style={{ padding: '8px 14px', fontSize: 12 }}
          >
            Logout
          </button>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Exam Completed</h2>
          <p style={{ color: '#8b90a0', fontSize: 14, marginBottom: 20, textAlign: 'center' }}>
            Your assessment has ended. You may now close this application.
          </p>

          <button
            onClick={handleLogout}
            className="btn btn-primary"
            style={{ padding: '10px 20px', fontSize: 14 }}
          >
            Finish and Logout
          </button>
        </div>
      </div>
    )
  }

  return null
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)