// Correct — destructures useState from React
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";
import Login from "./pages/Login";
import PreCheck from "./pages/candidate/PreCheck";
import Instructions from "./pages/candidate/Instructions";
import WaitScreen from "./pages/candidate/WaitScreen";
import ActiveExam from "./pages/candidate/ActiveExam";
import ExaminerDashboard from "./pages/examiner/ExaminerDashboard";
import useAuthStore from "./store/authStore";
import useExamStore from "./store/examStore";
import { useSocket } from "./hooks/useSocket";
import axios from "axios";
import AdminPanel from "./pages/admin/AdminPanel";

const API = 'http://localhost:3000'

function App() {
  const { user, accessToken, clearAuth } = useAuthStore()
  const { currentExam, currentAssessment, setExam, setAssessment } = useExamStore()
  const [screen, setScreen] = useState('login') // login|precheck|instructions|wait|exam|examiner
  const socket = useSocket(accessToken)

  const handleLogin = (loggedUser) => {
  if (loggedUser.role === 'Admin') {
    setScreen('admin')
  } else if (loggedUser.role === 'Examiner') {
    setScreen('examiner')
  } else {
    setScreen('precheck')
    loadCandidateExam(loggedUser)
  }
}


  const loadCandidateExam = async (loggedUser) => {
    try {
      // Get upcoming exam for this candidate
      const res = await axios.get(`${API}/api/exams/candidate/upcoming`,
        { headers: { Authorization: `Bearer ${accessToken}` } })
      if (res.data) {
        setExam(res.data.exam)
        setAssessment(res.data.assessment)
      }
    } catch (e) { console.log('No exam found') }
  }

  const handlePreCheckPass = () => setScreen('instructions')
  const handleStartMonitoring = () => {
    // Join socket room
    if (socket && currentExam) {
      socket.emit('join_exam', {
        exam_id: currentExam.exam_id,
        candidate_id: user.user_id,
        role: 'Candidate'
      })
    }
    setScreen('wait')
  }

  // Listen for examiner START signal
  useEffect(() => {
    if (!socket) return
    socket.on('exam_started', () => setScreen('exam'))
    socket.on('control_command', ({ action }) => {
      if (action === 'terminate') setScreen('complete')
    })
    return () => {
      socket.off('exam_started')
      socket.off('control_command')
    }
  }, [socket])

  const handleExamComplete = () => setScreen('complete')

  if (screen === 'login') return <Login onLogin={handleLogin} />
  if (screen === 'admin') return <AdminPanel />
  if (screen === 'examiner') return <ExaminerDashboard />
  if (screen === 'precheck') return <PreCheck onPass={handlePreCheckPass} />
  if (screen === 'instructions') return <Instructions exam={currentExam} onStart={handleStartMonitoring} />
  if (screen === 'wait') return <WaitScreen exam={currentExam} onExamStart={() => setScreen('exam')} />
  if (screen === 'exam') return (
    <ActiveExam exam={currentExam} assessment={currentAssessment} onComplete={handleExamComplete} />
  )
  if (screen === 'complete') return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', background:'#0f1117' }}>
      <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Exam Completed</h2>
      <p style={{ color: '#8b90a0', fontSize: 14 }}>
        Your assessment has ended. You may now close this application.
      </p>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)