import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";
import StartupSplash from "./components/SplashScreen";
import AppTitleBar from "./components/AppTitleBar";
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
import { stopCandidateWebRTC } from "./services/candidateWebRTC";
import { stopCameraStream } from "./services/cameraStream";
import { useSocket, disconnectSocket } from "./hooks/useSocket";
import axios from "axios";

const STARTUP_SPLASH_SESSION_KEY = "3rdeyez360-startup-splash-shown";

function shouldShowStartupSplash() {
  try {
    if (sessionStorage.getItem(STARTUP_SPLASH_SESSION_KEY) === "true") {
      document.documentElement.dataset.windowTheme = "app";
      return false;
    }

    // Mark the splash as shown for this Electron window session before React
    // renders. Renderer refreshes keep sessionStorage, while closing the
    // Electron window destroys the session and enables the splash next launch.
    sessionStorage.setItem(STARTUP_SPLASH_SESSION_KEY, "true");
    document.documentElement.dataset.windowTheme = "splash";
    return true;
  } catch (error) {
    console.warn("Unable to access startup splash session state:", error);
    return true;
  }
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Renderer error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="app-error-fallback" role="alert">
        <div className="app-error-fallback__panel">
          <h1>Unable to display this page</h1>
          <p>The application encountered a renderer error. Reload the page to recover.</p>
          <button type="button" className="btn btn-primary" onClick={this.handleReload}>
            Reload application
          </button>
        </div>
      </div>
    );
  }
}

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

function CompletionView({ onLogout, exam, assessment }) {
  const storedTheme = (() => {
    try {
      return localStorage.getItem("3rdeyez360.theme") === "light" ? "light" : "dark";
    } catch (error) {
      return "dark";
    }
  })();

  const isLight = storedTheme === "light";
  const examName = firstValue(
    assessment?.name,
    assessment?.examname,
    assessment?.exam_name,
    exam?.name,
    exam?.examname,
    exam?.exam_name,
    "Assessment"
  );
  const rawStatus = toUpper(
    firstValue(
      assessment?.finalstatus,
      assessment?.final_status,
      assessment?.assessmentstatus,
      assessment?.assessment_status,
      assessment?.status,
      exam?.examstatus,
      exam?.exam_status,
      exam?.status,
      "COMPLETED"
    )
  );
  const isTerminated = rawStatus === "TERMINATED";
  const heading = isTerminated ? "Assessment Terminated" : "Assessment Completed";
  const description = isTerminated
    ? "The examiner has terminated this assessment. Your secured session has been closed safely."
    : "The examiner has ended this assessment. Your secured session has been closed safely.";
  const statusLabel = isTerminated ? "Terminated" : "Completed";

  const palette = isLight
    ? {
        canvas: "#eef1fb",
        canvasTint:
          "radial-gradient(circle at 18% 18%, rgba(75,96,232,0.18), transparent 34%), radial-gradient(circle at 82% 78%, rgba(233,74,168,0.14), transparent 34%)",
        header: "rgba(255,255,255,0.82)",
        card: "rgba(255,255,255,0.9)",
        cardSoft: "rgba(75,96,232,0.06)",
        border: "rgba(20,28,60,0.10)",
        borderStrong: "rgba(20,28,60,0.16)",
        text: "#0b1024",
        secondary: "#4b5475",
        muted: "#78809b",
        accent: "#4b60e8",
        accent2: "#7c3aed",
        success: "#0ea564",
        successSoft: "rgba(14,165,100,0.12)",
        danger: "#dc2626",
        dangerSoft: "rgba(220,38,38,0.10)",
        shadow: "0 28px 80px rgba(38,48,94,0.18)",
      }
    : {
        canvas: "#07080d",
        canvasTint:
          "radial-gradient(circle at 18% 18%, rgba(91,140,255,0.18), transparent 34%), radial-gradient(circle at 82% 78%, rgba(255,110,199,0.12), transparent 34%)",
        header: "rgba(15,18,32,0.82)",
        card: "rgba(21,25,39,0.9)",
        cardSoft: "rgba(255,255,255,0.035)",
        border: "rgba(255,255,255,0.07)",
        borderStrong: "rgba(255,255,255,0.13)",
        text: "#f3f5fc",
        secondary: "#aeb5ce",
        muted: "#747c98",
        accent: "#6c8cff",
        accent2: "#a065ff",
        success: "#3ecf8e",
        successSoft: "rgba(62,207,142,0.11)",
        danger: "#ef6a6a",
        dangerSoft: "rgba(239,106,106,0.11)",
        shadow: "0 30px 90px rgba(0,0,0,0.48)",
      };

  const stateColor = isTerminated ? palette.danger : palette.success;
  const stateSoft = isTerminated ? palette.dangerSoft : palette.successSoft;

  return (
    <div
      className="completion-page-scroll"
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        background: palette.canvas,
        backgroundImage: palette.canvasTint,
        color: palette.text,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        overflowX: "hidden",
        overflowY: "auto",
        scrollbarGutter: "stable",
        position: "relative",
      }}
    >
      <style>{`
        @keyframes completionFadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes completionPulse {
          0%, 100% { transform: scale(1); opacity: 0.55; }
          50% { transform: scale(1.08); opacity: 0.22; }
        }
        .completion-page-scroll::-webkit-scrollbar { width: 9px; }
        .completion-page-scroll::-webkit-scrollbar-track { background: transparent; }
        .completion-page-scroll::-webkit-scrollbar-thumb {
          background: ${isLight ? "rgba(75,84,117,0.28)" : "rgba(174,181,206,0.24)"};
          border: 2px solid transparent;
          background-clip: padding-box;
          border-radius: 999px;
        }
        .completion-page-scroll::-webkit-scrollbar-thumb:hover {
          background: ${isLight ? "rgba(75,84,117,0.42)" : "rgba(174,181,206,0.38)"};
          border: 2px solid transparent;
          background-clip: padding-box;
        }
      `}</style>



      <main
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          minHeight: 540,
          boxSizing: "border-box",
          position: "relative",
          zIndex: 1,
        }}
      >
        <section
          style={{
            width: "min(620px, 100%)",
            borderRadius: 24,
            border: `1px solid ${palette.borderStrong}`,
            background: palette.card,
            boxShadow: palette.shadow,
            backdropFilter: "blur(26px)",
            WebkitBackdropFilter: "blur(26px)",
            overflow: "hidden",
            animation: "completionFadeUp 0.45s ease both",
          }}
        >
          <div
            style={{
              height: 4,
              background: isTerminated
                ? "linear-gradient(90deg, #ff7a7a, #dc2626)"
                : "linear-gradient(90deg, #3ecf8e, #5b8cff, #a065ff)",
            }}
          />

          <div style={{ padding: "30px 34px 24px", textAlign: "center" }}>
            <div
              style={{
                width: 78,
                height: 78,
                margin: "0 auto 20px",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: stateSoft,
                  border: `1px solid ${stateColor}44`,
                  animation: "completionPulse 2.4s ease-in-out infinite",
                }}
              />
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isTerminated
                    ? "linear-gradient(135deg, #ff7a7a, #dc2626)"
                    : "linear-gradient(135deg, #3ecf8e, #4b60e8)",
                  color: "#ffffff",
                  boxShadow: `0 14px 34px ${stateColor}44`,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {isTerminated ? (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <line x1="8.8" y1="8.8" x2="15.2" y2="15.2" />
                    <line x1="15.2" y1="8.8" x2="8.8" y2="15.2" />
                  </svg>
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </div>

            <div style={{ color: stateColor, fontSize: 10, fontWeight: 850, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
              Secured session closed
            </div>
            <h1 style={{ margin: 0, color: palette.text, fontSize: 28, fontWeight: 800, letterSpacing: -0.75 }}>
              {heading}
            </h1>
            <p style={{ margin: "12px auto 0", maxWidth: 470, color: palette.secondary, fontSize: 13.5, lineHeight: 1.7 }}>
              {description}
            </p>
          </div>

          <div style={{ padding: "0 34px 26px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(150px, 0.58fr)",
                gap: 10,
              }}
            >
              <div style={{ padding: "14px 16px", borderRadius: 14, background: palette.cardSoft, border: `1px solid ${palette.border}` }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: palette.muted }}>Assessment</div>
                <div style={{ marginTop: 6, color: palette.text, fontSize: 13, fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={examName}>
                  {examName}
                </div>
              </div>

              <div style={{ padding: "14px 16px", borderRadius: 14, background: stateSoft, border: `1px solid ${stateColor}33` }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: palette.muted }}>Final status</div>
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 7, color: stateColor, fontSize: 13, fontWeight: 800 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: stateColor, boxShadow: `0 0 9px ${stateColor}88` }} />
                  {statusLabel}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 13, background: palette.cardSoft, border: `1px solid ${palette.border}`, display: "flex", alignItems: "flex-start", gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={palette.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="9" />
                <line x1="12" y1="11" x2="12" y2="16" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <div style={{ color: palette.muted, fontSize: 11.5, lineHeight: 1.55, textAlign: "left" }}>
                Camera monitoring, secured browsing, and assessment controls have been closed. Select Finish and Logout to leave the application safely.
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "16px 34px 22px",
              borderTop: `1px solid ${palette.border}`,
              display: "flex",
              justifyContent: "center",
              background: palette.cardSoft,
            }}
          >
            <button
              type="button"
              onClick={onLogout}
              style={{
                minWidth: 178,
                minHeight: 42,
                padding: "0 20px",
                border: "none",
                borderRadius: 12,
                background: "linear-gradient(135deg, #5b8cff 0%, #7c3aed 55%, #e94aa8 100%)",
                color: "#ffffff",
                fontSize: 12.5,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 12px 28px rgba(91,140,255,0.30)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              Finish and Logout
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <polyline points="13 6 19 12 13 18" />
              </svg>
            </button>
          </div>
        </section>
      </main>
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
    waitingsessionid: firstValue(raw.waitingsessionid, raw.waiting_session_id),
    waitingregisteredat: firstValue(raw.waitingregisteredat, raw.waiting_registered_at),
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
  const [showStartupSplash, setShowStartupSplash] = useState(
    shouldShowStartupSplash
  );
  const { user, accessToken, hasHydrated, clearAuth } = useAuthStore();
  const {
    currentExam,
    currentAssessment,
    setExam,
    setAssessment,
    clearExam,
    reset,
    waitingSessionId,
    setWaitingSessionId,
    clearWaitingSession,
  } = useExamStore();
  const socket = useSocket(accessToken);

  const [screen, setScreen] = useState("login");
  const [bootstrapping, setBootstrapping] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    // If a renderer refresh skips the splash, switch the title bar to the
    // application theme immediately on the first committed render.
    if (!showStartupSplash) {
      document.documentElement.dataset.windowTheme = "app";
      window.electronAPI?.setTitleBarTheme?.("app");
    }
  }, [showStartupSplash]);

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
    stopCandidateWebRTC();
  } catch (error) {
    console.log("stopCandidateWebRTC cleanup failed", error);
  }

  try {
    stopCameraStream();
  } catch (error) {
    console.log("stopCameraStream cleanup failed", error);
  }

  try {
    await window.electronAPI?.stopCapture?.();
  } catch (error) {
    console.log("stopCapture cleanup failed", error);
  }

  try {
    await window.electronAPI?.closeBrowser?.();
  } catch (error) {
    console.log("closeBrowser cleanup failed", error);
  }

  try {
    await window.electronAPI?.disableLockdown?.();
  } catch (error) {
    console.log("disableLockdown cleanup failed", error);
  }

  try {
    await window.electronAPI?.setClosable?.(true);
  } catch (error) {
    console.log("setClosable cleanup failed", error);
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
      if (
        canGoDirectToExam(merged) &&
        (waitingSessionId ||
          ["ACTIVE", "PAUSED", "LATEENTRYAPPROVED", "LATEENTRY_APPROVED", "REENTRYAPPROVED", "REENTRY_APPROVED"].includes(assessmentStatus))
      ) return "exam";
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
  }, [waitingSessionId]);

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
  // Candidate flow pages receive state changes through Socket.IO.
  // REST is retained only for bootstrap, explicit navigation and recovery.


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

    const merged = mergeExamAssessment(
      examRef.current,
      assessmentRef.current
    );
    const assessmentId = merged?.assessmentid;
    const examStatus = getExamStatus(merged);
    const assessmentStatus = getAssessmentStatus(merged);

    if (!assessmentId || !accessToken) {
      return;
    }

    if (socket && merged && user) {
      socket.emit("join_exam", {
        examid: merged.examid,
        assessmentid: assessmentId,
        candidateid: user?.userid || user?.user_id,
        role: "Candidate",
      });
    }

    if (examStatus !== "RUNNING") {
      try {
        const waitingId =
          waitingSessionId ||
          globalThis.crypto?.randomUUID?.() ||
          `WAIT-${Date.now()}-${Math.random().toString(16).slice(2)}`;

        const response = await axios.post(
          `${API}/api/assessments/${assessmentId}/enter`,
          {
            sessionid: waitingId,
            fromwaitingroom: true,
          },
          { headers }
        );

        if (response.data?.waiting !== true) {
          throw new Error("The backend did not register the waiting session.");
        }

        const registeredId =
          response.data?.sessionid ||
          response.data?.session_id ||
          waitingId;

        setWaitingSessionId(registeredId);

        if (response.data?.assessment) {
          const nextAssessment = normalizeAssessment(response.data.assessment);
          setAssessment(nextAssessment);
          setExam(mergeExamAssessment(examRef.current, nextAssessment));
        }

        setScreen("wait");
        return;
      } catch (error) {
        console.error("Waiting-room registration failed", error);
        clearWaitingSession();
        await loadPrimaryCandidateState();
        setScreen("candidate-dashboard");
        return;
      }
    }

    if (
      [
        "LATEENTRYAPPROVED",
        "LATEENTRY_APPROVED",
        "REENTRYAPPROVED",
        "REENTRY_APPROVED",
      ].includes(assessmentStatus)
    ) {
      clearWaitingSession();
      setScreen("exam");
      return;
    }

    await loadPrimaryCandidateState();
    setScreen("candidate-dashboard");
  }, [
    accessToken,
    clearWaitingSession,
    headers,
    loadPrimaryCandidateState,
    setAssessment,
    setExam,
    setWaitingSessionId,
    socket,
    user,
    waitingSessionId,
  ]);

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
      } else if (
        canGoDirectToExam(merged) &&
        (useExamStore.getState().waitingSessionId ||
          ["ACTIVE", "PAUSED", "LATEENTRYAPPROVED", "LATEENTRY_APPROVED", "REENTRYAPPROVED", "REENTRY_APPROVED"].includes(getAssessmentStatus(merged)))
      ) {
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

  if (showStartupSplash) {
    return <StartupSplash onFinish={() => setShowStartupSplash(false)} />;
  }

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
    return (
      <PreCheck
        exam={currentExam}
        assessment={currentAssessment}
        onPass={handlePreCheckPass}
        onBack={handleReturnToDashboard}
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
    return (
      <CompletionView
        onLogout={handleLogout}
        exam={currentExam}
        assessment={currentAssessment}
      />
    );
  }

  return <Login onLogin={handleLogin} />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppTitleBar />
    <main className="app-viewport">
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </main>
  </React.StrictMode>
);
