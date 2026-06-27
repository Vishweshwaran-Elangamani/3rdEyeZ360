import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";
import Login from "./pages/Login";
import PreCheck from "./pages/candidate/PreCheck";
import Instructions from "./pages/candidate/Instructions";
import WaitScreen from "./pages/candidate/WaitScreen";
import ActiveExam from "./pages/candidate/ActiveExam";
import ExaminerDashboard from "./pages/examiner/ExaminerDashboard";
import AdminPanel from "./pages/admin/AdminPanel";
import useAuthStore from "./store/authStore";
import useExamStore from "./store/examStore";
import { useSocket } from "./hooks/useSocket";
import axios from "axios";
import appLogo from "../dist-renderer/assets/icons/app-icon.ico";

const API = "http://localhost:3000";
const SCREEN_STORAGE_KEY = "app-screen";
const SPLASH_DURATION = 10000;

function AppLogo({ size = 56 }) {
  return (
    <img
      src={appLogo}
      alt="3rdEyeZ360 logo"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        borderRadius: 16,
        display: "block",
      }}
    />
  );
}

function SplashScreen({ visible }) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at top, rgba(79,152,163,0.16), transparent 38%), radial-gradient(circle at bottom, rgba(79,152,163,0.08), transparent 42%), linear-gradient(180deg, #0b1114 0%, #0f1418 100%)",
      }}
    >
      <div
        style={{
          width: "min(440px, calc(100vw - 48px))",
          padding: "32px 28px",
          borderRadius: 24,
          background: "rgba(18, 25, 30, 0.92)",
          border: "1px solid rgba(79, 152, 163, 0.22)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.42)",
          textAlign: "center",
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            width: 110,
            height: 110,
            margin: "0 auto 20px",
            borderRadius: 28,
            display: "grid",
            placeItems: "center",
            background: "linear-gradient(180deg, rgba(79,152,163,0.18), rgba(79,152,163,0.05))",
            border: "1px solid rgba(79,152,163,0.24)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
            padding: 16,
          }}
        >
          <AppLogo size={76} />
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: "#eaf4f6",
          }}
        >
          3rdEyeZ360
        </h1>

        <div
          style={{
            margin: "8px 0 20px",
            fontSize: 13,
            color: "rgba(212, 232, 236, 0.72)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Secure Assessment Monitoring
        </div>

        <div
          style={{
            width: "100%",
            height: 6,
            borderRadius: 999,
            overflow: "hidden",
            background: "rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              width: "42%",
              height: "100%",
              borderRadius: 999,
              background: "linear-gradient(90deg, #4f98a3, #86d1dd)",
              boxShadow: "0 0 16px rgba(79,152,163,0.38)",
              animation: "bootLoad 1.2s ease-in-out infinite",
            }}
          />
        </div>

        <div
          style={{
            marginTop: 14,
            fontSize: 12,
            color: "rgba(212, 232, 236, 0.72)",
          }}
        >
          Preparing desktop workspace…
        </div>
      </div>

      <style>{`
        @keyframes bootLoad {
          0% { transform: translateX(-110%); }
          100% { transform: translateX(310%); }
        }
      `}</style>
    </div>
  );
}

function App() {
  const { user, accessToken } = useAuthStore();
  const { currentExam, currentAssessment, setExam, setAssessment } = useExamStore();
  const [screen, setScreenState] = useState(
    localStorage.getItem(SCREEN_STORAGE_KEY) || "login"
  );
  const [bootVisible, setBootVisible] = useState(true);

  const socket = useSocket(accessToken);

  const setScreen = (nextScreen) => {
    setScreenState(nextScreen);
    localStorage.setItem(SCREEN_STORAGE_KEY, nextScreen);
  };

  const resetToLogin = () => {
    useAuthStore.getState().clearAuth();
    useExamStore.getState().reset();
    localStorage.removeItem("auth-storage");
    localStorage.removeItem("exam-storage");
    localStorage.setItem(SCREEN_STORAGE_KEY, "login");
    setScreenState("login");
  };

  const handleLogout = async () => {
    try {
      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          await axios.post(`${API}/api/auth/logout`, {
            refresh_token: refreshToken,
          });
        } catch (e) {
          console.log("Logout API failed, clearing local session anyway", e);
        }
      }
    } finally {
      resetToLogin();
    }
  };

  const handleLogin = async (loggedUser) => {
    if (loggedUser.role === "Admin") {
      setScreen("admin");
    } else if (loggedUser.role === "Examiner") {
      setScreen("examiner");
    } else {
      await loadCandidateExam();
      setScreen("precheck");
    }
  };

  const loadCandidateExam = async () => {
    try {
      const token = useAuthStore.getState().accessToken;
      if (!token) return;

      const res = await axios.get(`${API}/api/exams/candidate/upcoming`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (Array.isArray(res.data) && res.data.length > 0) {
        const firstExam = res.data[0];
        setExam(firstExam);
        setAssessment({
          assessment_id: firstExam.assessment_id,
        });
      }
    } catch (e) {
      console.log("No exam found", e);
    }
  };

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.background = "#0b1114";
    document.documentElement.style.background = "#0b1114";
  }, []);

  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setBootVisible(false);
    }, SPLASH_DURATION);

    return () => {
      clearTimeout(splashTimer);
    };
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      if (!user || !accessToken) {
        setScreen("login");
        return;
      }

      try {
        if (user.role === "Admin") {
          if (screen === "login") setScreen("admin");
          return;
        }

        if (user.role === "Examiner") {
          if (screen === "login") setScreen("examiner");
          return;
        }

        if (user.role === "Candidate") {
          if (!currentExam) await loadCandidateExam();
          const savedScreen = localStorage.getItem(SCREEN_STORAGE_KEY);
          if (savedScreen && savedScreen !== "login") setScreen(savedScreen);
          else setScreen("precheck");
        }
      } catch (e) {
        console.log("Bootstrap failed", e);
        resetToLogin();
      }
    };

    bootstrap();
  }, [user, accessToken]);

  const handlePreCheckPass = () => setScreen("instructions");

  const handleStartMonitoring = () => {
    if (socket && currentExam) {
      socket.emit("join_exam", {
        exam_id: currentExam.exam_id,
        candidate_id: user?.user_id,
        role: "Candidate",
      });
    }
    setScreen("wait");
  };

  useEffect(() => {
    if (!socket) return;

    const onExamStarted = () => setScreen("exam");
    const onControlCommand = ({ action }) => {
      if (action === "terminate") setScreen("complete");
    };

    socket.on("exam_started", onExamStarted);
    socket.on("control_command", onControlCommand);

    return () => {
      socket.off("exam_started", onExamStarted);
      socket.off("control_command", onControlCommand);
    };
  }, [socket]);

  const handleExamComplete = () => setScreen("complete");

  return (
    <>
      <SplashScreen visible={bootVisible} />

      {screen === "login" && <Login onLogin={handleLogin} />}
      {screen === "admin" && <AdminPanel />}
      {screen === "examiner" && <ExaminerDashboard />}
      {screen === "precheck" && <PreCheck onPass={handlePreCheckPass} />}
      {screen === "instructions" && (
        <Instructions exam={currentExam} onStart={handleStartMonitoring} />
      )}
      {screen === "wait" && (
        <WaitScreen exam={currentExam} onExamStart={() => setScreen("exam")} />
      )}
      {screen === "exam" && (
        <ActiveExam
          exam={currentExam}
          assessment={currentAssessment}
          onComplete={handleExamComplete}
        />
      )}

      {screen === "complete" && (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0f1117", color: "#fff", fontFamily: "Inter, sans-serif" }}>
          <div style={{ height: 56, background: "#1a1d27", borderBottom: "1px solid #2e3347", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <AppLogo size={22} />
              <span style={{ fontWeight: 700, fontSize: 15 }}>3rdEyeZ360</span>
            </div>
            <button onClick={handleLogout} className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 12 }}>
              Logout
            </button>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ marginBottom: 18 }}>
              <AppLogo size={72} />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Exam Completed</h2>
            <p style={{ color: "#8b90a0", fontSize: 14, marginBottom: 20, textAlign: "center" }}>
              Your assessment has ended. You may now close this application.
            </p>
            <button onClick={handleLogout} className="btn btn-primary" style={{ padding: "10px 20px", fontSize: 14 }}>
              Finish and Logout
            </button>
          </div>
        </div>
      )}
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);