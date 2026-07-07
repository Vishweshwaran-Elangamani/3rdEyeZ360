import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import { useSocket, disconnectSocket } from "./hooks/useSocket";
import axios from "axios";

const API = "http://localhost:3000";

const TERMINAL_ASSESSMENT_STATUSES = new Set(["COMPLETED", "TERMINATED", "LOCKED"]);
const TERMINAL_EXAM_STATUSES = new Set(["COMPLETED", "TERMINATED"]);
const APPROVED_ENTRY_STATUSES = new Set([
  "ACTIVE",
  "PAUSED",
  "REENTRYAPPROVED",
  "LATEENTRYAPPROVED",
]);
const WAITING_ENTRY_STATUSES = new Set([
  "ASSIGNED",
  "AVAILABLE",
  "READY",
  "REENTRYREQUESTED",
  "LATEENTRYREQUESTED",
  "REENTRYREJECTED",
  "LATEENTRYREJECTED",
]);

function AppLogo({ size = 56 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        background: "linear-gradient(135deg, #4f8ef7, #7c5ce7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 800,
        fontSize: Math.max(12, Math.round(size * 0.28)),
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      3E
    </div>
  );
}

function SplashScreen({ text = "Loading..." }) {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b1114",
        color: "#dbe3f0",
        fontFamily: "Inter, sans-serif",
        fontSize: 14,
      }}
    >
      {text}
    </div>
  );
}

function CompletionView({ onLogout }) {
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
        <button onClick={onLogout} className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 12 }}>
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
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Exam Completed</h2>
        <p style={{ color: "#8b90a0", fontSize: 14, marginBottom: 20, textAlign: "center" }}>
          Your assessment has ended. You may now close this application.
        </p>
        <button onClick={onLogout} className="btn btn-primary" style={{ padding: "10px 20px", fontSize: 14 }}>
          Finish and Logout
        </button>
      </div>
    </div>
  );
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
}

function toUpper(value) {
  return String(value ?? "").trim().toUpperCase();
}

function canonicalStatus(value) {
  return toUpper(value).replace(/\s+/g, "").replace(/_/g, "");
}

function normalizeExam(raw) {
  if (!raw) return null;

  return {
    ...raw,
    examid: firstValue(raw.examid, raw.exam_id),
    assessmentid: firstValue(raw.assessmentid, raw.assessment_id),
    candidateid: firstValue(raw.candidateid, raw.candidate_id),
    name: firstValue(raw.name, raw.examname, raw.exam_name, "Exam"),
    description: firstValue(raw.description, raw.examdescription, raw.exam_description, ""),
    date: firstValue(raw.date, raw.examdate, raw.exam_date),
    starttime: firstValue(raw.starttime, raw.start_time, raw.examstarttime, raw.exam_start_time),
    endtime: firstValue(raw.endtime, raw.end_time, raw.examendtime, raw.exam_end_time),
    durationminutes: Number(firstValue(raw.durationminutes, raw.duration_minutes, 0) || 0),
    violationthreshold: Number(firstValue(raw.violationthreshold, raw.violation_threshold, 0) || 0),
    instructions: firstValue(raw.instructions, ""),
    allowedwebsites: Array.isArray(firstValue(raw.allowedwebsites, raw.allowed_websites))
      ? firstValue(raw.allowedwebsites, raw.allowed_websites)
      : [],
    allowedapplications: Array.isArray(firstValue(raw.allowedapplications, raw.allowed_applications))
      ? firstValue(raw.allowedapplications, raw.allowed_applications)
      : [],
    status: toUpper(firstValue(raw.status, raw.examstatus, raw.exam_status)),
    examstatus: toUpper(firstValue(raw.examstatus, raw.exam_status, raw.status)),
  };
}

function normalizeAssessment(raw) {
  if (!raw) return null;

  return {
    ...raw,
    assessmentid: firstValue(raw.assessmentid, raw.assessment_id),
    examid: firstValue(raw.examid, raw.exam_id),
    candidateid: firstValue(raw.candidateid, raw.candidate_id),
    examinerid: firstValue(raw.examinerid, raw.examiner_id),
    name: firstValue(raw.name, raw.examname, raw.exam_name, "Upcoming Exam"),
    description: firstValue(raw.description, raw.examdescription, raw.exam_description, ""),
    date: firstValue(raw.date, raw.examdate, raw.exam_date),
    starttime: firstValue(raw.starttime, raw.start_time, raw.examstarttime, raw.exam_start_time),
    endtime: firstValue(raw.endtime, raw.end_time, raw.examendtime, raw.exam_end_time),
    durationminutes: Number(firstValue(raw.durationminutes, raw.duration_minutes, 0) || 0),
    violationthreshold: Number(firstValue(raw.violationthreshold, raw.violation_threshold, 0) || 0),
    instructions: firstValue(raw.instructions, ""),
    allowedwebsites: Array.isArray(firstValue(raw.allowedwebsites, raw.allowed_websites))
      ? firstValue(raw.allowedwebsites, raw.allowed_websites)
      : [],
    allowedapplications: Array.isArray(firstValue(raw.allowedapplications, raw.allowed_applications))
      ? firstValue(raw.allowedapplications, raw.allowed_applications)
      : [],
    status: toUpper(firstValue(raw.status, raw.assessmentstatus, raw.assessment_status)),
    assessmentstatus: toUpper(firstValue(raw.assessmentstatus, raw.assessment_status, raw.status)),
    examstatus: toUpper(firstValue(raw.examstatus, raw.exam_status, raw.status_exam, raw.runtimestatus)),
    finalstatus: toUpper(firstValue(raw.finalstatus, raw.final_status)),
  };
}

function mergeExamAssessment(exam, assessment) {
  return {
    ...(exam || {}),
    ...(assessment || {}),
    examid: firstValue(assessment?.examid, exam?.examid),
    assessmentid: firstValue(assessment?.assessmentid, exam?.assessmentid),
    candidateid: firstValue(assessment?.candidateid, exam?.candidateid),
    name: firstValue(assessment?.name, exam?.name, "Exam"),
    description: firstValue(assessment?.description, exam?.description, ""),
    date: firstValue(assessment?.date, exam?.date),
    starttime: firstValue(assessment?.starttime, exam?.starttime),
    endtime: firstValue(assessment?.endtime, exam?.endtime),
    durationminutes: Number(firstValue(assessment?.durationminutes, exam?.durationminutes, 0) || 0),
    allowedwebsites: Array.isArray(firstValue(assessment?.allowedwebsites, exam?.allowedwebsites))
      ? firstValue(assessment?.allowedwebsites, exam?.allowedwebsites)
      : [],
    allowedapplications: Array.isArray(firstValue(assessment?.allowedapplications, exam?.allowedapplications))
      ? firstValue(assessment?.allowedapplications, exam?.allowedapplications)
      : [],
    status: toUpper(firstValue(assessment?.status, assessment?.assessmentstatus)),
    assessmentstatus: toUpper(firstValue(assessment?.assessmentstatus, assessment?.status)),
    examstatus: toUpper(firstValue(assessment?.examstatus, exam?.examstatus, exam?.status)),
    finalstatus: toUpper(firstValue(assessment?.finalstatus)),
  };
}

function getAssessmentStatus(source) {
  return canonicalStatus(firstValue(source?.assessmentstatus, source?.status));
}

function getFinalStatus(source) {
  return canonicalStatus(firstValue(source?.finalstatus));
}

function getExamStatus(source) {
  return canonicalStatus(firstValue(source?.examstatus, source?.status));
}

function isTerminalAssessmentState(source) {
  const assessmentStatus = getAssessmentStatus(source);
  const finalStatus = getFinalStatus(source);
  return (
    (assessmentStatus && TERMINAL_ASSESSMENT_STATUSES.has(assessmentStatus)) ||
    (finalStatus && TERMINAL_ASSESSMENT_STATUSES.has(finalStatus))
  );
}

function isTerminalExamState(source) {
  return TERMINAL_EXAM_STATUSES.has(getExamStatus(source));
}

function isExamRunning(source) {
  return getExamStatus(source) === "RUNNING";
}

function shouldWait(source) {
  const assessmentStatus = getAssessmentStatus(source);
  if (APPROVED_ENTRY_STATUSES.has(assessmentStatus) && isExamRunning(source)) return false;
  return WAITING_ENTRY_STATUSES.has(assessmentStatus) || !isExamRunning(source);
}

function canGoDirectToExam(source) {
  const assessmentStatus = getAssessmentStatus(source);
  return isExamRunning(source) && APPROVED_ENTRY_STATUSES.has(assessmentStatus);
}

function App() {
  const { user, accessToken, hasHydrated, clearAuth } = useAuthStore();
  const { currentExam, currentAssessment, setExam, setAssessment, clearExam, reset } = useExamStore();
  const socket = useSocket(accessToken);

  const [screen, setScreen] = useState("login");
  const [bootstrapping, setBootstrapping] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isLoggingOutRef = useRef(false);
  const screenRef = useRef("login");
  const examRef = useRef(currentExam);
  const assessmentRef = useRef(currentAssessment);
  const bootstrapDoneRef = useRef(false);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    examRef.current = currentExam;
  }, [currentExam]);

  useEffect(() => {
    assessmentRef.current = currentAssessment;
  }, [currentAssessment]);

  const headers = useMemo(() => {
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  }, [accessToken]);

  const resetToLogin = useCallback(() => {
    disconnectSocket(true);
    clearExam?.();
    reset?.();
    clearAuth?.();
    setScreen("login");
    setBootstrapping(false);
    setIsLoggingOut(false);
    isLoggingOutRef.current = false;
    bootstrapDoneRef.current = false;
  }, [clearAuth, clearExam, reset]);

  const cleanupElectron = useCallback(async () => {
    try {
      await window.electronAPI?.stopCapture?.();
    } catch (e) {
      console.log("stopCapture cleanup failed", e);
    }
    try {
      await window.electronAPI?.closeBrowser?.();
    } catch (e) {
      console.log("closeBrowser cleanup failed", e);
    }
    try {
      await window.electronAPI?.disableLockdown?.();
    } catch (e) {
      console.log("disableLockdown cleanup failed", e);
    }
    try {
      await window.electronAPI?.setClosable?.(true);
    } catch (e) {
      console.log("setClosable cleanup failed", e);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    setIsLoggingOut(true);
    await cleanupElectron();
    resetToLogin();
  }, [cleanupElectron, resetToLogin]);

  const fetchCandidateUpcoming = useCallback(async () => {
    if (!accessToken) return [];
    try {
      const res = await axios.get(`${API}/api/exams/candidate/upcoming`, { headers });
      return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
      console.log("Failed to load candidate upcoming exams", e);
      return [];
    }
  }, [accessToken, headers]);

  const fetchLiveAssessment = useCallback(
    async (assessmentId) => {
      if (!assessmentId || !accessToken) return null;
      try {
        const res = await axios.get(`${API}/api/assessments/${assessmentId}`, { headers });
        return normalizeAssessment(res.data);
      } catch (e) {
        console.log("Failed to fetch live assessment", e);
        return null;
      }
    },
    [accessToken, headers]
  );

  const fetchLiveExam = useCallback(
    async (examId) => {
      if (!examId || !accessToken) return null;
      try {
        const res = await axios.get(`${API}/api/exams/${examId}`, { headers });
        return normalizeExam(res.data);
      } catch (e) {
        console.log("Failed to fetch live exam", e);
        return null;
      }
    },
    [accessToken, headers]
  );

  const loadPrimaryCandidateState = useCallback(async () => {
    const rows = await fetchCandidateUpcoming();
    console.log("UPCOMING RAW", rows);
    return { rows };
  }, [fetchCandidateUpcoming]);

  const refreshCurrentCandidateState = useCallback(async () => {
    const currentAssessmentId = firstValue(assessmentRef.current?.assessmentid, examRef.current?.assessmentid);
    const currentExamId = firstValue(assessmentRef.current?.examid, examRef.current?.examid);

    if (!currentAssessmentId && !currentExamId) {
      return { assessment: null, exam: null, merged: null };
    }

    const [liveAssessment, liveExam] = await Promise.all([
      currentAssessmentId ? fetchLiveAssessment(currentAssessmentId) : Promise.resolve(null),
      currentExamId ? fetchLiveExam(currentExamId) : Promise.resolve(null),
    ]);

    const merged = mergeExamAssessment(liveExam, liveAssessment);

    if (liveAssessment) setAssessment(liveAssessment);
    if (merged) setExam(merged);

    return { assessment: liveAssessment, exam: liveExam, merged };
  }, [fetchLiveAssessment, fetchLiveExam, setAssessment, setExam]);

  const routeFromLiveState = useCallback((merged, currentScreen) => {
    console.log("LIVE ROUTE", {
      currentScreen,
      merged,
      assessmentStatus: getAssessmentStatus(merged),
      finalStatus: getFinalStatus(merged),
      examStatus: getExamStatus(merged),
    });

    if (!merged) return "candidate-dashboard";

    if (currentScreen === "precheck" || currentScreen === "instructions") {
      return currentScreen;
    }

    if (currentScreen === "candidate-dashboard") {
      return "candidate-dashboard";
    }

    if (isTerminalAssessmentState(merged) || isTerminalExamState(merged)) {
      return "complete";
    }

    if (currentScreen === "wait") {
      if (canGoDirectToExam(merged)) return "exam";
      return "wait";
    }

    if (currentScreen === "exam") {
      if (canGoDirectToExam(merged)) return "exam";
      if (shouldWait(merged)) return "wait";
      return "exam";
    }

    if (canGoDirectToExam(merged)) return "exam";
    if (shouldWait(merged)) return "wait";

    return "candidate-dashboard";
  }, []);

  const handleLogin = useCallback(
    async (loggedUser) => {
      disconnectSocket();
      clearExam?.();
      setAssessment(null);
      setExam(null);
      reset?.();
      bootstrapDoneRef.current = false;

      if (loggedUser.role === "Admin") {
        setScreen("admin");
        setBootstrapping(false);
        bootstrapDoneRef.current = true;
        return;
      }

      if (loggedUser.role === "Examiner") {
        setScreen("examiner");
        setBootstrapping(false);
        bootstrapDoneRef.current = true;
        return;
      }

      await cleanupElectron();
      await loadPrimaryCandidateState();

      if (isLoggingOutRef.current) return;

      setScreen("candidate-dashboard");
      setBootstrapping(false);
      bootstrapDoneRef.current = true;
    },
    [clearExam, reset, cleanupElectron, loadPrimaryCandidateState, setAssessment, setExam]
  );

  useEffect(() => {
    document.body.style.margin = 0;
    document.body.style.background = "#0b1114";
    document.documentElement.style.background = "#0b1114";
  }, []);

  useEffect(() => {
    console.log("STORE SNAPSHOT", {
      user,
      currentExam,
      currentAssessment,
      hasHydrated,
    });
  }, [user, currentExam, currentAssessment, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated || isLoggingOut) return;

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
          bootstrapDoneRef.current = true;
          return;
        }

        if (user.role === "Examiner") {
          setScreen("examiner");
          setBootstrapping(false);
          bootstrapDoneRef.current = true;
          return;
        }

        if (user.role === "Candidate") {
          await cleanupElectron();
          clearExam?.();
          setAssessment(null);
          setExam(null);
          await loadPrimaryCandidateState();

          if (isLoggingOutRef.current) return;

          setScreen("candidate-dashboard");
          setBootstrapping(false);
          bootstrapDoneRef.current = true;
          return;
        }

        setScreen("login");
        setBootstrapping(false);
      } catch (e) {
        console.log("Bootstrap failed", e);
        resetToLogin();
      }
    };

    bootstrap();
  }, [
    hasHydrated,
    isLoggingOut,
    user,
    accessToken,
    cleanupElectron,
    loadPrimaryCandidateState,
    resetToLogin,
    clearExam,
    setAssessment,
    setExam,
  ]);

  useEffect(() => {
    if (!bootstrapDoneRef.current) return;
    if (!accessToken || !user || user.role !== "Candidate") return;
    if (!["wait", "exam"].includes(screen)) return;
    if (isLoggingOut) return;

    const timer = setInterval(async () => {
      if (isLoggingOutRef.current) return;
      const latest = await refreshCurrentCandidateState();
      const next = routeFromLiveState(latest.merged, screenRef.current);

      setScreen((prev) => {
        if (isLoggingOutRef.current) return prev;
        return next;
      });
    }, 4000);

    return () => clearInterval(timer);
  }, [accessToken, user, screen, isLoggingOut, refreshCurrentCandidateState, routeFromLiveState]);

  const handleEnterExam = useCallback(
    async (examLike) => {
      if (isLoggingOutRef.current) return;

      const assessment = normalizeAssessment(examLike);
      const liveAssessment = assessment?.assessmentid
        ? await fetchLiveAssessment(assessment.assessmentid)
        : null;

      const examId = firstValue(assessment?.examid, liveAssessment?.examid);
      const liveExam = examId ? await fetchLiveExam(examId) : null;

      const finalAssessment = liveAssessment || assessment;
      const finalExam = mergeExamAssessment(liveExam || normalizeExam(examLike), finalAssessment);

      console.log("ENTER EXAM SELECTED", {
        clicked: examLike,
        finalAssessment,
        finalExam,
        canonicalAssessmentStatus: getAssessmentStatus(finalAssessment),
        canonicalExamStatus: getExamStatus(finalExam),
      });

      setAssessment(finalAssessment);
      setExam(finalExam);
      setScreen("precheck");
    },
    [fetchLiveAssessment, fetchLiveExam, setAssessment, setExam]
  );

  const handlePreCheckPass = useCallback(() => {
    if (isLoggingOutRef.current) return;
    setScreen("instructions");
  }, []);

  const handleStartMonitoring = useCallback(async () => {
    if (isLoggingOutRef.current) return;

    const merged = mergeExamAssessment(examRef.current, assessmentRef.current);

    if (socket && merged && user) {
      socket.emit("joinexam", {
        examid: merged.examid,
        candidateid: user?.userid,
        role: "Candidate",
      });
    }

    const latest = await refreshCurrentCandidateState();
    const live = latest.merged || merged;

    if (isLoggingOutRef.current) return;

    if (canGoDirectToExam(live)) {
      setScreen("exam");
      return;
    }

    setScreen("wait");
  }, [socket, user, refreshCurrentCandidateState]);

  const handleReturnToDashboard = useCallback(async () => {
    await cleanupElectron();
    clearExam?.();
    setAssessment(null);
    setExam(null);
    await loadPrimaryCandidateState();
    if (!isLoggingOutRef.current) {
      setScreen("candidate-dashboard");
    }
  }, [cleanupElectron, loadPrimaryCandidateState, clearExam, setAssessment, setExam]);

  useEffect(() => {
    if (!socket || isLoggingOut) return;

    const onExamStarted = async () => {
      if (isLoggingOutRef.current) return;
      if (!["wait", "candidate-dashboard"].includes(screenRef.current)) return;

      const latest = await refreshCurrentCandidateState();
      const merged = latest.merged;
      if (!merged) return;

      if (screenRef.current === "wait" && canGoDirectToExam(merged)) {
        setScreen("exam");
      }
    };

    const onControlCommand = async (payload) => {
      if (isLoggingOutRef.current) return;
      const action = toUpper(payload?.action ?? payload);

      if (action === "TERMINATE") {
        if (screenRef.current === "wait" || screenRef.current === "exam") {
          setScreen("complete");
        }
        return;
      }

      if (screenRef.current === "wait" || screenRef.current === "exam") {
        const latest = await refreshCurrentCandidateState();
        const next = routeFromLiveState(latest.merged, screenRef.current);
        setScreen(next);
      }
    };

    socket.on("examstarted", onExamStarted);
    socket.on("controlcommand", onControlCommand);

    return () => {
      socket.off("examstarted", onExamStarted);
      socket.off("controlcommand", onControlCommand);
    };
  }, [socket, isLoggingOut, refreshCurrentCandidateState, routeFromLiveState]);

  const handleExamComplete = useCallback(() => {
    setScreen("complete");
  }, []);

  if (!hasHydrated) return <SplashScreen text="Restoring session..." />;
  if (isLoggingOut) return <SplashScreen text="Signing out..." />;
  if (bootstrapping) return <SplashScreen text="Preparing application..." />;

  if (screen === "login") return <Login onLogin={handleLogin} />;
  if (screen === "admin") return <AdminPanel />;
  if (screen === "examiner") return <ExaminerDashboard />;

  if (screen === "candidate-dashboard") {
    return <CandidateDashboard onEnterExam={handleEnterExam} onLogout={handleLogout} />;
  }

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
        onBack={() => setScreen("precheck")}
        onLogout={handleLogout}
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
        onReturnToDashboard={handleReturnToDashboard}
      />
    );
  }

  if (screen === "complete") {
    return <CompletionView onLogout={handleLogout} />;
  }

  return <Login onLogin={handleLogin} />;
}

createRoot(document.getElementById("root")).render(<App />);