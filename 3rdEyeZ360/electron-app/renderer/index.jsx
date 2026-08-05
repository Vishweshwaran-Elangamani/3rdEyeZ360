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

const FLOW_SCREENS = new Set([
  "candidate-dashboard",
  "precheck",
  "instructions",
  "wait",
  "exam",
  "complete",
]);

const TERMINAL_ASSESSMENT_STATUSES = new Set(["COMPLETED", "TERMINATED", "LOCKED"]);
const TERMINAL_EXAM_STATUSES = new Set(["COMPLETED", "TERMINATED"]);

const APPROVED_ENTRY_STATUSES = new Set([
  "ASSIGNED",
  "READY",
  "ACTIVE",
  "REENTRYAPPROVED",
  "REENTRY_APPROVED",
  "LATEENTRYAPPROVED",
  "LATEENTRY_APPROVED",
]);

const WAITING_ENTRY_STATUSES = new Set([
  "ASSIGNED",
  "AVAILABLE",
  "READY",
  "REENTRYREQUESTED",
  "REENTRY_REQUESTED",
  "LATEENTRYREQUESTED",
  "LATEENTRY_REQUESTED",
  "PENDING",
]);

const REJECTED_ENTRY_STATUSES = new Set([
  "REENTRYREJECTED",
  "REENTRY_REJECTED",
  "LATEENTRYREJECTED",
  "LATEENTRY_REJECTED",
  "REJECTED",
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

function normalizeList(...sources) {
  const unique = new Set();

  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const item of source) {
      const value = String(item || "").trim();
      if (value) unique.add(value);
    }
  }

  return Array.from(unique);
}

function normalizeExam(raw) {
  if (!raw) return null;

  const examStatus = toUpper(
    firstValue(
      raw.examstatus,
      raw.exam_status,
      raw.examStatus,
      raw.runtime_status,
      raw.runtimestatus,
      raw.status
    )
  );

  return {
    ...raw,
    examid: firstValue(raw.examid, raw.exam_id),
    assessmentid: firstValue(raw.assessmentid, raw.assessment_id),
    candidateid: firstValue(raw.candidateid, raw.candidate_id),
    examinerid: firstValue(raw.examinerid, raw.examiner_id),
    name: firstValue(raw.name, raw.examname, raw.exam_name, "Exam"),
    description: firstValue(raw.description, raw.examdescription, raw.exam_description, ""),
    date: firstValue(raw.date, raw.examdate, raw.exam_date, ""),
    starttime: firstValue(raw.starttime, raw.start_time, raw.examstarttime, raw.exam_start_time, ""),
    endtime: firstValue(raw.endtime, raw.end_time, raw.examendtime, raw.exam_end_time, ""),
    durationminutes: Number(firstValue(raw.durationminutes, raw.duration_minutes, 0)) || 0,
    violationthreshold: Number(firstValue(raw.violationthreshold, raw.violation_threshold, 0)) || 0,
    instructions: firstValue(raw.instructions, ""),
    allowedwebsites: normalizeList(raw.allowedwebsites, raw.allowed_websites),
    allowedapplications: normalizeList(raw.allowedapplications, raw.allowed_applications),
    status: examStatus,
    examstatus: examStatus,
  };
}

function normalizeAssessment(raw) {
  if (!raw) return null;

  const assessmentStatus = toUpper(
    firstValue(
      raw.assessmentstatus,
      raw.assessment_status,
      raw.assessmentStatus,
      raw.status,
      raw.finalstatus,
      raw.final_status
    )
  );

  const examStatus = toUpper(
    firstValue(
      raw.examstatus,
      raw.exam_status,
      raw.examStatus,
      raw.status_exam,
      raw.runtime_status,
      raw.runtimestatus
    )
  );

  const finalStatus = toUpper(firstValue(raw.finalstatus, raw.final_status));

  return {
    ...raw,
    assessmentid: firstValue(raw.assessmentid, raw.assessment_id),
    examid: firstValue(raw.examid, raw.exam_id),
    candidateid: firstValue(raw.candidateid, raw.candidate_id),
    examinerid: firstValue(raw.examinerid, raw.examiner_id),
    name: firstValue(raw.name, raw.examname, raw.exam_name, "Upcoming Exam"),
    description: firstValue(raw.description, raw.examdescription, raw.exam_description, ""),
    date: firstValue(raw.date, raw.examdate, raw.exam_date, ""),
    starttime: firstValue(raw.starttime, raw.start_time, raw.examstarttime, raw.exam_start_time, ""),
    endtime: firstValue(raw.endtime, raw.end_time, raw.examendtime, raw.exam_end_time, ""),
    durationminutes: Number(firstValue(raw.durationminutes, raw.duration_minutes, 0)) || 0,
    violationthreshold: Number(firstValue(raw.violationthreshold, raw.violation_threshold, 0)) || 0,
    instructions: firstValue(raw.instructions, ""),
    allowedwebsites: normalizeList(raw.allowedwebsites, raw.allowed_websites),
    allowedapplications: normalizeList(raw.allowedapplications, raw.allowed_applications),
    status: assessmentStatus,
    assessmentstatus: assessmentStatus,
    examstatus: examStatus,
    finalstatus: finalStatus,
  };
}

function mergeExamAssessment(exam, assessment) {
  const normalizedExam = normalizeExam(exam);
  const normalizedAssessment = normalizeAssessment(assessment);

  return {
    ...normalizedExam,
    ...normalizedAssessment,
    examid: firstValue(normalizedAssessment?.examid, normalizedExam?.examid),
    assessmentid: firstValue(normalizedAssessment?.assessmentid, normalizedExam?.assessmentid),
    candidateid: firstValue(normalizedAssessment?.candidateid, normalizedExam?.candidateid),
    examinerid: firstValue(normalizedAssessment?.examinerid, normalizedExam?.examinerid),
    name: firstValue(normalizedAssessment?.name, normalizedExam?.name, "Exam"),
    description: firstValue(normalizedAssessment?.description, normalizedExam?.description, ""),
    date: firstValue(normalizedAssessment?.date, normalizedExam?.date, ""),
    starttime: firstValue(normalizedAssessment?.starttime, normalizedExam?.starttime, ""),
    endtime: firstValue(normalizedAssessment?.endtime, normalizedExam?.endtime, ""),
    durationminutes: Number(firstValue(normalizedAssessment?.durationminutes, normalizedExam?.durationminutes, 0)) || 0,
    violationthreshold:
      Number(firstValue(normalizedAssessment?.violationthreshold, normalizedExam?.violationthreshold, 0)) || 0,
    instructions: firstValue(normalizedAssessment?.instructions, normalizedExam?.instructions, ""),
    allowedwebsites: normalizeList(normalizedAssessment?.allowedwebsites, normalizedExam?.allowedwebsites),
    allowedapplications: normalizeList(normalizedAssessment?.allowedapplications, normalizedExam?.allowedapplications),
    status: toUpper(firstValue(normalizedAssessment?.assessmentstatus, normalizedAssessment?.status)),
    assessmentstatus: toUpper(firstValue(normalizedAssessment?.assessmentstatus, normalizedAssessment?.status)),
    examstatus: toUpper(firstValue(normalizedAssessment?.examstatus, normalizedExam?.examstatus)),
    finalstatus: toUpper(firstValue(normalizedAssessment?.finalstatus)),
  };
}

function getAssessmentStatus(source) {
  return toUpper(firstValue(source?.assessmentstatus, source?.status));
}

function getFinalStatus(source) {
  return toUpper(firstValue(source?.finalstatus));
}

function getExamStatus(source) {
  return toUpper(firstValue(source?.examstatus, source?.status));
}

function isTerminalAssessmentState(source) {
  const assessmentStatus = getAssessmentStatus(source);
  const finalStatus = getFinalStatus(source);
  return TERMINAL_ASSESSMENT_STATUSES.has(assessmentStatus) || TERMINAL_ASSESSMENT_STATUSES.has(finalStatus);
}

function isTerminalExamState(source) {
  return TERMINAL_EXAM_STATUSES.has(getExamStatus(source));
}

function isExamRunning(source) {
  return getExamStatus(source) === "RUNNING";
}

function shouldWait(source) {
  const assessmentStatus = getAssessmentStatus(source);
  if (REJECTED_ENTRY_STATUSES.has(assessmentStatus)) return false;
  if (assessmentStatus === "PAUSED") return false;
  if (APPROVED_ENTRY_STATUSES.has(assessmentStatus) && isExamRunning(source)) return false;
  return WAITING_ENTRY_STATUSES.has(assessmentStatus) || !isExamRunning(source);
}

function canGoDirectToExam(source) {
  const assessmentStatus = getAssessmentStatus(source);
  return isExamRunning(source) && APPROVED_ENTRY_STATUSES.has(assessmentStatus);
}

function choosePrimaryAssessment(list) {
  if (!Array.isArray(list) || !list.length) return null;

  const normalized = list.map(normalizeAssessment).filter(Boolean);

  const active = normalized.find((item) => canGoDirectToExam(item));
  if (active) return active;

  const paused = normalized.find((item) => getAssessmentStatus(item) === "PAUSED");
  if (paused) return paused;

  const waiting = normalized.find((item) => {
    const status = getAssessmentStatus(item);
    return (
      !isTerminalAssessmentState(item) &&
      !isTerminalExamState(item) &&
      (WAITING_ENTRY_STATUSES.has(status) ||
        APPROVED_ENTRY_STATUSES.has(status) ||
        status === "ASSIGNED" ||
        status === "AVAILABLE" ||
        status === "READY")
    );
  });
  if (waiting) return waiting;

  const nonTerminal = normalized.find((item) => !isTerminalAssessmentState(item));
  if (nonTerminal) return nonTerminal;

  return normalized[0] || null;
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

  const headers = useMemo(() => (accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), [accessToken]);

  const resetToLogin = useCallback(() => {
    disconnectSocket();
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
  bootstrapDoneRef.current = false;

  /*
   * Remove the assessment React page immediately.
   */
  setIsLoggingOut(true);
  setScreen("login");
  screenRef.current = "login";

  /*
   * Destroy the Electron assessment resources before clearing auth.
   */
  await cleanupElectron();

  disconnectSocket();

  useExamStore.getState().clearExam?.();
  useExamStore.getState().reset?.();

  examRef.current = null;
  assessmentRef.current = null;

  try {
    localStorage.removeItem("app-screen");
    localStorage.removeItem("auth-storage");
    localStorage.removeItem("exam-storage");

    sessionStorage.removeItem("app-screen");
    sessionStorage.removeItem("auth-storage");
    sessionStorage.removeItem("exam-storage");
  } catch (error) {
    console.warn("Unable to clear logout state:", error);
  }

  useAuthStore.getState().clearAuth?.();

  setBootstrapping(false);
  setIsLoggingOut(false);
  isLoggingOutRef.current = false;
}, [cleanupElectron]);

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
    const primaryAssessment = choosePrimaryAssessment(rows);

    if (!primaryAssessment) {
      setAssessment(null);
      setExam(null);
      return { assessment: null, exam: null, merged: null };
    }

    const liveAssessment = primaryAssessment.assessmentid
      ? await fetchLiveAssessment(primaryAssessment.assessmentid)
      : primaryAssessment;

    const baseAssessment = liveAssessment || primaryAssessment;
    const liveExam = baseAssessment?.examid ? await fetchLiveExam(baseAssessment.examid) : null;
    const merged = mergeExamAssessment(liveExam, baseAssessment);

    setAssessment(baseAssessment);
    setExam(merged);

    return { assessment: baseAssessment, exam: liveExam, merged };
  }, [fetchCandidateUpcoming, fetchLiveAssessment, fetchLiveExam, setAssessment, setExam]);

  const refreshCurrentCandidateState = useCallback(async () => {
    const currentAssessmentId = firstValue(assessmentRef.current?.assessmentid, examRef.current?.assessmentid);
    const currentExamId = firstValue(assessmentRef.current?.examid, examRef.current?.examid);

    if (!currentAssessmentId && !currentExamId) {
      return { assessment: null, exam: null, merged: null };
    }

    const [liveAssessment, liveExam] = await Promise.all([
      fetchLiveAssessment(currentAssessmentId),
      fetchLiveExam(currentExamId),
    ]);

    const merged = mergeExamAssessment(liveExam, liveAssessment);

    if (liveAssessment) setAssessment(liveAssessment);
    if (merged) setExam(merged);

    return { assessment: liveAssessment, exam: liveExam, merged };
  }, [fetchLiveAssessment, fetchLiveExam, setAssessment, setExam]);


  const routeFromLiveState = useCallback((merged, currentScreen) => {
    if (!merged) return "candidate-dashboard";

    const terminalAssessment = isTerminalAssessmentState(merged);
    const terminalExam = isTerminalExamState(merged);
    const assessmentStatus = getAssessmentStatus(merged);

    if (currentScreen === "precheck" || currentScreen === "instructions") {
      if (terminalAssessment || terminalExam) return "candidate-dashboard";
      return currentScreen;
    }

    if (currentScreen === "wait") {
      if (terminalAssessment || terminalExam) return "complete";
      if (REJECTED_ENTRY_STATUSES.has(assessmentStatus)) return "candidate-dashboard";
      if (assessmentStatus === "PAUSED") return "exam";
      if (canGoDirectToExam(merged)) return "exam";
      return "wait";
    }

    if (currentScreen === "exam") {
      if (terminalAssessment || terminalExam) return "complete";
      if (assessmentStatus === "PAUSED") return "exam";
      if (canGoDirectToExam(merged)) return "exam";
      return "wait";
    }

    if (terminalAssessment || terminalExam) return "candidate-dashboard";
    if (REJECTED_ENTRY_STATUSES.has(assessmentStatus)) return "candidate-dashboard";
    if (assessmentStatus === "PAUSED") return "exam";
    if (canGoDirectToExam(merged)) return "exam";
    if (shouldWait(merged)) return "wait";
    return "candidate-dashboard";
  }, []);

  const handleLogin = useCallback(
  async (loggedUser) => {
    /*
     * Block bootstrap routing while login routing is being performed.
     */
    bootstrapDoneRef.current = false;
    isLoggingOutRef.current = false;

    setBootstrapping(true);

    /*
     * Remove any old assessment browser and capture session before rendering
     * the newly authenticated workspace.
     */
    await cleanupElectron();

    disconnectSocket();

    useExamStore.getState().clearExam?.();
    useExamStore.getState().reset?.();

    examRef.current = null;
    assessmentRef.current = null;

    try {
      localStorage.removeItem("app-screen");
      localStorage.removeItem("exam-storage");

      sessionStorage.removeItem("app-screen");
      sessionStorage.removeItem("exam-storage");
    } catch (error) {
      console.warn("Unable to clear previous assessment state:", error);
    }

    const role = toUpper(loggedUser?.role);

    if (role === "ADMIN") {
      setScreen("admin");
      screenRef.current = "admin";
      setBootstrapping(false);
      bootstrapDoneRef.current = true;
      return;
    }

    if (role === "EXAMINER") {
      setScreen("examiner");
      screenRef.current = "examiner";
      setBootstrapping(false);
      bootstrapDoneRef.current = true;
      return;
    }

    if (role === "CANDIDATE") {
      /*
       * A fresh candidate login must always open the dashboard.
       * The candidate can explicitly resume an ongoing assessment from there.
       */
      setScreen("candidate-dashboard");
      screenRef.current = "candidate-dashboard";

      try {
        localStorage.setItem("app-screen", "candidate-dashboard");
      } catch (error) {
        console.warn("Unable to persist dashboard screen:", error);
      }

      setBootstrapping(false);
      bootstrapDoneRef.current = true;
      return;
    }

    setScreen("login");
    screenRef.current = "login";
    setBootstrapping(false);
  },
  [cleanupElectron]
);

  useEffect(() => {
  if (!hasHydrated || isLoggingOut) return;

  let cancelled = false;

  const bootstrap = async () => {
    try {
      if (!user || !accessToken) {
        if (!cancelled) {
          setScreen("login");
          screenRef.current = "login";
          setBootstrapping(false);
          bootstrapDoneRef.current = false;
        }

        return;
      }

      const role = toUpper(user.role);

      if (role === "ADMIN") {
        if (!cancelled) {
          setScreen("admin");
          screenRef.current = "admin";
          setBootstrapping(false);
          bootstrapDoneRef.current = true;
        }

        return;
      }

      if (role === "EXAMINER") {
        if (!cancelled) {
          setScreen("examiner");
          screenRef.current = "examiner";
          setBootstrapping(false);
          bootstrapDoneRef.current = true;
        }

        return;
      }

      if (role === "CANDIDATE") {
        /*
         * Never automatically restore "wait" or "exam" when authentication is
         * restored or after a candidate logs in.
         */
        await cleanupElectron();

        if (cancelled || isLoggingOutRef.current) {
          return;
        }

        useExamStore.getState().clearExam?.();
        useExamStore.getState().reset?.();

        examRef.current = null;
        assessmentRef.current = null;

        setScreen("candidate-dashboard");
        screenRef.current = "candidate-dashboard";

        try {
          localStorage.setItem("app-screen", "candidate-dashboard");
          localStorage.removeItem("exam-storage");

          sessionStorage.setItem(
            "app-screen",
            "candidate-dashboard"
          );
          sessionStorage.removeItem("exam-storage");
        } catch (error) {
          console.warn(
            "Unable to clear bootstrap assessment state:",
            error
          );
        }

        setBootstrapping(false);
        bootstrapDoneRef.current = true;
        return;
      }

      if (!cancelled) {
        setScreen("login");
        screenRef.current = "login";
        setBootstrapping(false);
        bootstrapDoneRef.current = false;
      }
    } catch (error) {
      console.log("Bootstrap failed", error);

      if (!cancelled) {
        resetToLogin();
      }
    }
  };

  bootstrap();

  return () => {
    cancelled = true;
  };
}, [
  hasHydrated,
  isLoggingOut,
  user,
  accessToken,
  cleanupElectron,
  resetToLogin,
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
        return next || prev;
      });
    }, 4000);

    return () => clearInterval(timer);
  }, [accessToken, user, screen, isLoggingOut, refreshCurrentCandidateState, routeFromLiveState]);

  const handleEnterExam = useCallback(
    async (examLike) => {
      if (isLoggingOutRef.current) return;

      const rawAssessment = normalizeAssessment(examLike);
      const liveAssessment = rawAssessment?.assessmentid
        ? await fetchLiveAssessment(rawAssessment.assessmentid)
        : rawAssessment;

      const baseAssessment = liveAssessment || rawAssessment;
      const liveExam = baseAssessment?.examid ? await fetchLiveExam(baseAssessment.examid) : normalizeExam(examLike);
      const merged = mergeExamAssessment(liveExam, baseAssessment);

      setAssessment(baseAssessment);
      setExam(merged);
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
      socket.emit("join_exam", {
        examid: merged.examid,
        assessmentid: merged.assessmentid,
        candidateid: user?.userid,
        role: "Candidate",
      });
    }

    const latest = await refreshCurrentCandidateState();
    const live = latest.merged || merged;

    if (isLoggingOutRef.current) return;

    if (getAssessmentStatus(live) === "PAUSED") {
      setScreen("exam");
      return;
    }

    if (canGoDirectToExam(live)) {
      setScreen("exam");
      return;
    }

    setScreen("wait");
  }, [socket, user, refreshCurrentCandidateState]);

  const handleReturnToDashboard = useCallback(async () => {
    await cleanupElectron();
    await loadPrimaryCandidateState();
    if (!isLoggingOutRef.current) setScreen("candidate-dashboard");
  }, [cleanupElectron, loadPrimaryCandidateState]);

  useEffect(() => {
    if (!socket || isLoggingOut) return;

    const onExamStarted = async () => {
      if (isLoggingOutRef.current) return;
      if (!["wait", "candidate-dashboard"].includes(screenRef.current)) return;

      const latest = await refreshCurrentCandidateState();
      const merged = latest.merged;
      if (!merged) return;

      if (getAssessmentStatus(merged) === "PAUSED") {
        setScreen("exam");
      } else if (canGoDirectToExam(merged)) {
        setScreen("exam");
      } else if (shouldWait(merged)) {
        setScreen("wait");
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

    socket.on("exam_started", onExamStarted);
    socket.on("control_command", onControlCommand);

    return () => {
      socket.off("exam_started", onExamStarted);
      socket.off("control_command", onControlCommand);
    };
  }, [socket, isLoggingOut, refreshCurrentCandidateState, routeFromLiveState]);

  const handleExamComplete = useCallback(() => {
    setScreen("complete");
  }, []);

  if (!hasHydrated) return <SplashScreen text="Restoring session..." />;
  if (isLoggingOut) return <SplashScreen text="Signing out..." />;
  if (bootstrapping) return <SplashScreen text="Preparing application..." />;
/*
 * Never render a candidate flow screen without both current assessment
 * objects. This prevents one-frame rendering from stale screen state.
 */
if (
  ["precheck", "instructions", "wait", "exam"].includes(screen) &&
  (!currentExam || !currentAssessment)
) {
  if (user && accessToken && toUpper(user.role) === "CANDIDATE") {
    return (
      <CandidateDashboard
        onEnterExam={handleEnterExam}
        onLogout={handleLogout}
      />
    );
  }

  return <Login onLogin={handleLogin} />;
}
  if (screen === "login") return <Login onLogin={handleLogin} />;
  if (screen === "admin") return <AdminPanel />;
  if (screen === "examiner") return <ExaminerDashboard />;
  if (screen === "candidate-dashboard") {
    return <CandidateDashboard onEnterExam={handleEnterExam} onLogout={handleLogout} />;
  }
  if (screen === "precheck") {
    return <PreCheck exam={currentExam} assessment={currentAssessment} onPass={handlePreCheckPass} onLogout={handleLogout} />;
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
  if (screen === "complete") return <CompletionView onLogout={handleLogout} />;

  return <Login onLogin={handleLogin} />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);