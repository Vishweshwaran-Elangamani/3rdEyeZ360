import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";
import Login from "./pages/Login";
import CandidateDashboard from "./pages/candidate/CandidateDashboard";
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
const SPLASH_DURATION = 3000;
const CANDIDATE_FLOW_SCREENS = new Set([
  "precheck",
  "instructions",
  "wait",
  "exam",
  "complete",
]);

function AppLogo({ size = 56 }) {
  return (
    <img
      src={appLogo}
      alt="3rdEyeZ360 logo"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "contain", display: "block" }}
    />
  );
}

function SplashScreen() {
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
          "radial-gradient(circle at top, rgba(79,152,163,0.10), transparent 38%), linear-gradient(180deg, #0b1114 0%, #0f1418 100%)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "min(520px, calc(100vw - 48px))",
          padding: "36px 30px",
          borderRadius: 28,
          background: "rgba(18, 25, 30, 0.88)",
          border: "1px solid rgba(79, 152, 163, 0.16)",
          boxShadow: "0 20px 70px rgba(0,0,0,0.38)",
          textAlign: "center",
          backdropFilter: "blur(10px)",
          position: "relative",
        }}
      >
        <div
          style={{
            width: 180,
            height: 180,
            margin: "0 auto 24px",
            display: "grid",
            placeItems: "center",
            position: "relative",
            animation: "logoPulse 2.8s ease-in-out infinite",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(79,152,163,0.24) 0%, rgba(79,152,163,0.10) 42%, rgba(79,152,163,0.00) 72%)",
              filter: "blur(10px)",
              animation: "glowBreath 2.8s ease-in-out infinite",
            }}
          />
          <AppLogo size={140} />
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: "#eaf4f6",
          }}
        >
          3rdEyeZ360
        </h1>

        <div
          style={{
            margin: "10px 0 22px",
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
              boxShadow: "0 0 16px rgba(79,152,163,0.30)",
              animation: "bootLoad 1.35s ease-in-out infinite",
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
        @keyframes logoPulse {
          0% { opacity: 0.78; transform: scale(0.985); }
          50% { opacity: 1; transform: scale(1.02); }
          100% { opacity: 0.78; transform: scale(0.985); }
        }
        @keyframes glowBreath {
          0% { opacity: 0.35; transform: scale(0.92); }
          50% { opacity: 0.85; transform: scale(1.08); }
          100% { opacity: 0.35; transform: scale(0.92); }
        }
        @keyframes bootLoad {
          0% { transform: translateX(-110%); }
          100% { transform: translateX(310%); }
        }
      `}</style>
    </div>
  );
}

function normalizeAssessment(exam) {
  if (!exam) return null;

  return {
    assessmentid: exam.assessmentid ?? exam.assessment_id ?? null,
    examid: exam.examid ?? exam.exam_id ?? null,
    status: exam.status ?? exam.assessment_status ?? null,
    examstatus: exam.examstatus ?? exam.exam_status ?? null,
    durationminutes: exam.durationminutes ?? exam.duration_minutes ?? 0,
    allowedwebsites: Array.isArray(exam.allowedwebsites)
      ? exam.allowedwebsites
      : Array.isArray(exam.allowed_websites)
        ? exam.allowed_websites
        : [],
    allowedapplications: Array.isArray(exam.allowedapplications)
      ? exam.allowedapplications
      : Array.isArray(exam.allowed_applications)
        ? exam.allowed_applications
        : [],
    violationthreshold: exam.violationthreshold ?? exam.violation_threshold ?? null,
    instructions: exam.instructions ?? "",
    name: exam.name ?? "",
    description: exam.description ?? "",
    date: exam.date ?? "",
    starttime: exam.starttime ?? exam.start_time ?? "",
    endtime: exam.endtime ?? exam.end_time ?? "",
  };
}

function AppShell() {
  const { user, accessToken, hasHydrated } = useAuthStore();
  const {
    currentExam,
    currentAssessment,
    setExam,
    setAssessment,
    reset: resetExamStore,
  } = useExamStore();

  const [screen, setScreen] = useState("login");
  const [bootstrapping, setBootstrapping] = useState(true);
  const socket = useSocket(accessToken);

  const resetToLogin = useCallback(() => {
    useAuthStore.getState().clearAuth();
    resetExamStore();
    setScreen("login");
  }, [resetExamStore]);

  useEffect(() => {
    if (!window.electronAPI?.onDevForceLogin) return;

    const handleDevForceLogin = () => {
      resetToLogin();
    };

    window.electronAPI.onDevForceLogin(handleDevForceLogin);

    return () => {
      window.electronAPI.removeDevForceLoginListener?.();
    };
  }, [resetToLogin]);

  const handleLogout = useCallback(async () => {
    try {
      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          await axios.post(`${API}/api/auth/logout`, { refreshtoken: refreshToken });
        } catch (e) {
          console.log("Logout API failed, clearing local session anyway", e);
        }
      }
    } finally {
      try {
        await window.electronAPI?.stopCapture?.();
        await window.electronAPI?.closeBrowser?.();
        await window.electronAPI?.disableLockdown?.();
        await window.electronAPI?.setClosable?.(true);
      } catch (e) {
        console.log("Electron cleanup during logout failed", e);
      }
      resetToLogin();
    }
  }, [resetToLogin]);

  const loadCandidateExam = useCallback(async () => {
    try {
      const token = useAuthStore.getState().accessToken;
      if (!token) return null;

      const res = await axios.get(`${API}/api/exams/candidate/upcoming`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (Array.isArray(res.data) && res.data.length > 0) {
        const firstExam = res.data[0];
        setExam(firstExam);
        setAssessment(normalizeAssessment(firstExam));
        return firstExam;
      }
    } catch (e) {
      console.log("No exam found", e);
    }
    return null;
  }, [setExam, setAssessment]);

  const handleLogin = async (loggedUser) => {
    if (loggedUser.role === "Admin") {
      setScreen("admin");
      return;
    }

    if (loggedUser.role === "Examiner") {
      setScreen("examiner");
      return;
    }

    await loadCandidateExam();
    setScreen("candidate-dashboard");
  };

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.background = "#0b1114";
    document.documentElement.style.background = "#0b1114";
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;

    const bootstrap = async () => {
      try {
        if (!user || !accessToken) {
          setScreen("login");
          setBootstrapping(false);
          return;
        }

        if (user.role === "Admin") {
          setScreen("admin");
          setBootstrapping(false);
          return;
        }

        if (user.role === "Examiner") {
          setScreen("examiner");
          setBootstrapping(false);
          return;
        }

        if (user.role === "Candidate") {
          if (!currentExam) {
            await loadCandidateExam();
          }

          setScreen((prev) => {
            if (CANDIDATE_FLOW_SCREENS.has(prev)) return prev;
            return "candidate-dashboard";
          });

          setBootstrapping(false);
          return;
        }

        setScreen("login");
        setBootstrapping(false);
      } catch (e) {
        console.log("Bootstrap failed", e);
        resetToLogin();
        setBootstrapping(false);
      }
    };

    bootstrap();
  }, [hasHydrated, user, accessToken, loadCandidateExam, resetToLogin, currentExam]);

  const handleEnterExam = (exam) => {
    setExam(exam);
    setAssessment(normalizeAssessment(exam));
    setScreen("precheck");
  };

  const handlePreCheckPass = () => {
    setScreen("instructions");
  };

  const handleStartMonitoring = () => {
    if (socket && currentExam && user) {
      socket.emit("joinexam", {
        examid: currentExam.examid,
        candidateid: user.userid,
        role: "Candidate",
      });
    }
    setScreen("wait");
  };

  const handleReturnToDashboard = useCallback(async () => {
    try {
      await window.electronAPI?.stopCapture?.();
      await window.electronAPI?.closeBrowser?.();
      await window.electronAPI?.disableLockdown?.();
      await window.electronAPI?.setClosable?.(true);
    } catch (e) {
      console.log("Return-to-dashboard cleanup failed", e);
    }

    await loadCandidateExam();
    setScreen("candidate-dashboard");
  }, [loadCandidateExam]);

  useEffect(() => {
    if (!socket) return;

    const onExamStarted = () => {
      setScreen((prev) => (prev === "exam" ? prev : "wait"));
    };

    const onControlCommand = (action) => {
      if (action === "terminate") {
        setScreen("wait");
      }
    };

    socket.on("examstarted", onExamStarted);
    socket.on("controlcommand", onControlCommand);

    return () => {
      socket.off("examstarted", onExamStarted);
      socket.off("controlcommand", onControlCommand);
    };
  }, [socket]);

  if (!hasHydrated || bootstrapping) return null;

  const handleExamComplete = () => setScreen("complete");

  if (screen === "login") return <Login onLogin={handleLogin} />;
  if (screen === "admin") return <AdminPanel />;
  if (screen === "examiner") return <ExaminerDashboard />;
  if (screen === "candidate-dashboard") return <CandidateDashboard onEnterExam={handleEnterExam} />;
  if (screen === "precheck") {
    return (
      <PreCheck
        exam={currentExam}
        assessment={currentAssessment}
        onPass={handlePreCheckPass}
        onLogout={handleLogout}
      />
    );
  }
  if (screen === "instructions") {
    return (
      <Instructions
        exam={currentExam}
        assessment={currentAssessment}
        onStart={handleStartMonitoring}
      />
    );
  }
  if (screen === "wait") {
    return (
      <WaitScreen
        exam={currentExam}
        assessment={currentAssessment}
        onExamStart={() => setScreen("exam")}
        onLogout={handleLogout}
        onComplete={handleExamComplete}
        onReturnToDashboard={handleReturnToDashboard}
      />
    );
  }
  if (screen === "exam") {
    return (
      <ActiveExam
        exam={currentExam}
        assessment={currentAssessment}
        onComplete={handleExamComplete}
        onLogout={handleLogout}
      />
    );
  }
  if (screen === "complete") {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "#0f1117",
          color: "#fff",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div
          style={{
            height: 56,
            background: "#1a1d27",
            borderBottom: "1px solid #2e3347",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AppLogo size={22} />
            <span style={{ fontWeight: 700, fontSize: 15 }}>3rdEyeZ360</span>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-ghost"
            style={{ padding: "8px 14px", fontSize: 12 }}
          >
            Logout
          </button>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div style={{ marginBottom: 18 }}>
            <AppLogo size={72} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
            Exam Completed
          </h2>
          <p
            style={{
              color: "#8b90a0",
              fontSize: 14,
              marginBottom: 20,
              textAlign: "center",
            }}
          >
            Your assessment has ended. You may now close this application.
          </p>
          <button
            onClick={handleLogout}
            className="btn btn-primary"
            style={{ padding: "10px 20px", fontSize: 14 }}
          >
            Finish and Logout
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function Root() {
  const { hasHydrated } = useAuthStore();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, SPLASH_DURATION);
    return () => clearTimeout(timer);
  }, []);

  if (!hasHydrated) return showSplash ? <SplashScreen /> : null;
  return showSplash ? <SplashScreen /> : <AppShell />;
}

createRoot(document.getElementById("root")).render(<Root />);