import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import axios from "axios";
import useAuthStore from "../../store/authStore";
import { useSocket } from "../../hooks/useSocket";
import ChatWindow from "../../components/common/ChatWindow";
import CreateExam from "./CreateExam";
import AssignCandidates from "./AssignCandidates";
import CandidateVideoTile from "../../components/CandidateVideoTile";
import useExaminerWebRTC from "../../services/examinerWebRTC";

const API = "http://localhost:3000";
const THEME_STORAGE_KEY = "3rdeyez360.theme";

/* ============= Theme system ============= */

const THEMES = {
  dark: {
    name: "dark",
    canvas: "#07080d",
    canvasTint:
      "radial-gradient(ellipse at top left, #10152a 0%, #07080d 50%), radial-gradient(ellipse at bottom right, #1a0f2e 0%, #07080d 60%)",
    surface: "rgba(22, 26, 40, 0.6)",
    surfaceSolid: "#141826",
    surfaceElevated: "rgba(30, 34, 50, 0.85)",
    surfaceGlass: "rgba(255, 255, 255, 0.05)",
    surfaceGlassHover: "rgba(255, 255, 255, 0.08)",
    cardSurface: "rgba(28, 32, 48, 0.72)",
    cardSurfaceHover: "rgba(34, 38, 56, 0.82)",
    panelBg: "#0f1220",
    border: "rgba(255, 255, 255, 0.09)",
    borderStrong: "rgba(255, 255, 255, 0.16)",
    borderAccent: "rgba(91, 140, 255, 0.45)",
    textPrimary: "#ffffff",
    textSecondary: "#d5daea",
    textMuted: "#98a0ba",
    textFaint: "#6b7286",
    accent: "#5b8cff",
    accent2: "#a065ff",
    accent3: "#ff6ec7",
    accentGradient:
      "linear-gradient(135deg, #5b8cff 0%, #a065ff 50%, #ff6ec7 100%)",
    accentGradientSoft:
      "linear-gradient(135deg, rgba(91,140,255,0.15) 0%, rgba(160,101,255,0.15) 50%, rgba(255,110,199,0.15) 100%)",
    accentSoft: "rgba(91,140,255,0.12)",
    success: "#57e0a0",
    successGradient: "linear-gradient(135deg, #3ecf8e 0%, #22a37a 100%)",
    successBg: "rgba(62,207,142,0.14)",
    warning: "#f0bd63",
    warningGradient: "linear-gradient(135deg, #ffc94b 0%, #e8850b 100%)",
    warningBg: "rgba(232,176,75,0.14)",
    danger: "#ff8686",
    dangerGradient: "linear-gradient(135deg, #ff7a7a 0%, #d94a4a 100%)",
    dangerBg: "rgba(239,106,106,0.14)",
    info: "#7fb0ff",
    infoBg: "rgba(109,165,255,0.14)",
    overlay: "rgba(3,5,10,0.78)",
    glowAccent:
      "0 8px 32px rgba(91,140,255,0.28), 0 0 60px rgba(160,101,255,0.15)",
    glowSuccess: "0 6px 24px rgba(62,207,142,0.28)",
    glowWarning: "0 6px 24px rgba(232,176,75,0.28)",
    glowDanger: "0 6px 24px rgba(239,106,106,0.28)",
    inputBg: "rgba(255,255,255,0.06)",
  },
  light: {
    name: "light",
    canvas: "#eef1fb",
    canvasTint:
      "radial-gradient(ellipse at top left, #dbe4ff 0%, #eef1fb 45%), radial-gradient(ellipse at bottom right, #ffd9ec 0%, #eef1fb 55%)",
    surface: "rgba(255, 255, 255, 0.82)",
    surfaceSolid: "#ffffff",
    surfaceElevated: "rgba(255, 255, 255, 0.94)",
    surfaceGlass: "rgba(255, 255, 255, 0.65)",
    surfaceGlassHover: "rgba(255, 255, 255, 0.9)",
    cardSurface: "#ffffff",
    cardSurfaceHover: "#fbfcff",
    panelBg: "#ffffff",
    border: "rgba(20, 28, 60, 0.10)",
    borderStrong: "rgba(20, 28, 60, 0.18)",
    borderAccent: "rgba(75, 96, 232, 0.45)",
    textPrimary: "#0b1024",
    textSecondary: "#2a3150",
    textMuted: "#5a6280",
    textFaint: "#98a0ba",
    accent: "#4b60e8",
    accent2: "#7c3aed",
    accent3: "#e94aa8",
    accentGradient:
      "linear-gradient(135deg, #4b60e8 0%, #7c3aed 50%, #e94aa8 100%)",
    accentGradientSoft:
      "linear-gradient(135deg, rgba(75,96,232,0.12) 0%, rgba(124,58,237,0.12) 50%, rgba(233,74,168,0.12) 100%)",
    accentSoft: "rgba(75,96,232,0.12)",
    success: "#0b8f57",
    successGradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    successBg: "rgba(14,165,100,0.16)",
    warning: "#c47908",
    warningGradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    warningBg: "rgba(217,119,6,0.16)",
    danger: "#c81e1e",
    dangerGradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    dangerBg: "rgba(220,38,38,0.14)",
    info: "#2563eb",
    infoBg: "rgba(37,99,235,0.14)",
    overlay: "rgba(20, 28, 60, 0.4)",
    glowAccent:
      "0 12px 40px rgba(75,96,232,0.25), 0 0 60px rgba(124,58,237,0.15)",
    glowSuccess: "0 8px 28px rgba(14,165,100,0.28)",
    glowWarning: "0 8px 28px rgba(217,119,6,0.28)",
    glowDanger: "0 8px 28px rgba(220,38,38,0.28)",
    inputBg: "#ffffff",
  },
};

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark") return stored;
    } catch (e) {}
    return "dark";
  });

  useEffect(() => {
    const handler = (e) => {
      if (
        e.key === THEME_STORAGE_KEY &&
        (e.newValue === "light" || e.newValue === "dark")
      ) {
        setTheme(e.newValue);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch (e) {}
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}

/* ============= Data normalizers ============= */

const STATUS_KEY = {
  ACTIVE: "success",
  READY: "accent",
  INTERRUPTED: "warning",
  LOCKED: "danger",
  COMPLETED: "textMuted",
  TERMINATED: "danger",
  ASSIGNED: "textFaint",
  AVAILABLE: "accent2",
  PAUSED: "warning",
  REENTRYAPPROVED: "success",
  REENTRY_APPROVED: "success",
  LATEENTRYAPPROVED: "success",
  LATEENTRY_APPROVED: "success",
  REENTRYREJECTED: "danger",
  REENTRY_REJECTED: "danger",
  LATEENTRYREJECTED: "danger",
  LATEENTRY_REJECTED: "danger",
  PENDING: "warning",
};

function statusColor(status, t) {
  const key = STATUS_KEY[String(status || "").toUpperCase()];
  return t[key] || t.textMuted;
}

function normalizeStatusKey(status) {
  return String(status ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, "");
}

function formatStatus(status) {
  if (status === undefined || status === null || String(status).trim() === "")
    return "Unknown";
  const labels = {
    DRAFT: "Draft",
    PUBLISHED: "Published",
    SCHEDULED: "Scheduled",
    AVAILABLE: "Available",
    ASSIGNED: "Assigned",
    READY: "Ready",
    PENDING: "Pending",
    RUNNING: "Running",
    ACTIVE: "Active",
    PAUSED: "Paused",
    RESUMED: "Resumed",
    INTERRUPTED: "Interrupted",
    COMPLETED: "Completed",
    TERMINATED: "Terminated",
    LOCKED: "Locked",
    CANCELLED: "Cancelled",
    CANCELED: "Canceled",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    LATEENTRYREQUESTED: "Late Entry Requested",
    LATEENTRYAPPROVED: "Late Entry Approved",
    LATEENTRYREJECTED: "Late Entry Rejected",
    REENTRYREQUESTED: "Re-entry Requested",
    REENTRYAPPROVED: "Re-entry Approved",
    REENTRYREJECTED: "Re-entry Rejected",
    NOTSTARTED: "Not Started",
    INPROGRESS: "In Progress",
    UNDERREVIEW: "Under Review",
    NOTATTENDED: "Not Attended",
  };
  const key = normalizeStatusKey(status);
  if (labels[key]) return labels[key];
  return String(status)
    .trim()
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeExam(exam) {
  if (!exam) return null;
  return {
    ...exam,
    examid: exam.examid ?? exam.exam_id ?? null,
    name: exam.name ?? "Untitled Exam",
    status: exam.status ?? exam.examstatus ?? exam.exam_status ?? "Draft",
    date: exam.date ?? "—",
    starttime: exam.starttime ?? exam.start_time ?? "—",
    endtime: exam.endtime ?? exam.end_time ?? "—",
    durationminutes: exam.durationminutes ?? exam.duration_minutes ?? 0,
    examtype: String(exam.examtype ?? exam.exam_type ?? "SINGLE_SESSION").toUpperCase(),
    timeframes: exam.timeframes ?? exam.flexibleintervals ?? exam.flexible_intervals ?? [],
    sessionnumber: Number(exam.sessionnumber ?? exam.session_number ?? 0),
    permanentlystopped: Boolean(exam.permanentlystopped ?? exam.permanently_stopped),
  };
}

function normalizeCandidate(c) {
  if (!c) return null;
  return {
    ...c,
    assessmentid: c.assessmentid ?? c.assessment_id ?? null,
    candidateid: c.candidateid ?? c.candidate_id ?? null,
    // Do not use c.name here. Assessment socket payloads use name for the exam name.
    candidatename: c.candidatename ?? c.candidate_name ?? null,
    candidateemail: c.candidateemail ?? c.candidate_email ?? "",
    status: c.status ?? "ASSIGNED",
    violationcount: c.violationcount ?? c.violation_count ?? 0,
    warningcount: c.warningcount ?? c.warning_count ?? 0,
    riskscore: c.riskscore ?? c.risk_score ?? 0,
    credibilityscore: c.credibilityscore ?? c.credibility_score ?? 100,
    attendancestatus: c.attendancestatus ?? c.attendance_status ?? "",
  };
}

function normalizeRequest(r) {
  if (!r) return null;
  return {
    ...r,
    requestid: r.requestid ?? r.request_id ?? null,
    assessmentid: r.assessmentid ?? r.assessment_id ?? null,
    examid: r.examid ?? r.exam_id ?? null,
    candidateid: r.candidateid ?? r.candidate_id ?? null,
    candidatename: r.candidatename ?? r.candidate_name ?? r.name ?? null,
    status: String(r.status ?? "").toUpperCase(),
    type: String(r.type ?? r.requesttype ?? r.request_type ?? "").toUpperCase(),
    reason: r.reason ?? r.message ?? "",
    reviewreason: r.reviewreason ?? r.review_reason ?? "",
    createdat: r.createdat ?? r.created_at ?? null,
    reviewedat: r.reviewedat ?? r.reviewed_at ?? null,
  };
}

function examStatusMeta(status, t) {
  const s = String(status || "").toUpperCase();
  if (s === "RUNNING")
    return { label: "Running", color: t.success, gradient: t.successGradient };
  if (s === "DRAFT")
    return {
      label: "Draft",
      color: t.textMuted,
      gradient: `linear-gradient(135deg, ${t.textMuted}, ${t.textFaint})`,
    };
  if (s === "PUBLISHED")
    return { label: "Published", color: t.accent, gradient: t.accentGradient };
  if (s === "COMPLETED")
    return {
      label: "Completed",
      color: t.textSecondary,
      gradient: `linear-gradient(135deg, ${t.textSecondary}, ${t.textMuted})`,
    };
  if (s === "STOPPED")
    return { label: "Stopped", color: t.danger, gradient: t.dangerGradient };
  if (s === "TERMINATED")
    return { label: "Terminated", color: t.danger, gradient: t.dangerGradient };
  return {
    label: status || "Unknown",
    color: t.textSecondary,
    gradient: `linear-gradient(135deg, ${t.textSecondary}, ${t.textMuted})`,
  };
}

function requestTypeLabel(type) {
  const t = String(type || "").toUpperCase();
  if (t === "REENTRY" || t === "RE-ENTRY") return "Re-entry";
  if (t === "LATEENTRY" || t === "LATE_ENTRY") return "Late entry";
  return t || "Request";
}

function requestStatusMeta(status, t) {
  const s = String(status || "").toUpperCase();
  if (s === "PENDING")
    return { color: t.warning, gradient: t.warningGradient, label: "Pending" };
  if (s === "APPROVED")
    return { color: t.success, gradient: t.successGradient, label: "Approved" };
  if (s === "REJECTED")
    return { color: t.danger, gradient: t.dangerGradient, label: "Rejected" };
  return {
    color: t.textSecondary,
    gradient: `linear-gradient(135deg, ${t.textSecondary}, ${t.textMuted})`,
    label: status || "Unknown",
  };
}

/* ============= Shared UI ============= */

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";
  const t = THEMES[theme];
  return (
    <button
      onClick={onToggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      style={{
        position: "relative",
        width: 58,
        height: 30,
        borderRadius: 999,
        border: `1px solid ${t.borderStrong}`,
        background: isDark
          ? "linear-gradient(135deg, #0f1428 0%, #1a0f2e 100%)"
          : "linear-gradient(135deg, #ffe9a8 0%, #ffcfd8 100%)",
        cursor: "pointer",
        padding: 0,
        overflow: "hidden",
        flexShrink: 0,
        transition: "background 0.6s ease, border-color 0.5s ease",
      }}
    >
      {[
        { top: 6, left: 10, size: 2, o: isDark ? 0.9 : 0 },
        { top: 18, left: 15, size: 1.5, o: isDark ? 0.6 : 0 },
        { top: 9, left: 20, size: 1.5, o: isDark ? 0.7 : 0 },
      ].map((s, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            borderRadius: "50%",
            background: "#ffffff",
            opacity: s.o,
            transition: "opacity 0.6s ease",
          }}
        />
      ))}
      <span
        style={{
          position: "absolute",
          top: 3,
          left: isDark ? 31 : 3,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: isDark
            ? "linear-gradient(135deg, #e2e6f2 0%, #b0b8d0 100%)"
            : "linear-gradient(135deg, #ffd75c 0%, #ff9640 100%)",
          boxShadow: isDark
            ? "0 2px 10px rgba(0,0,0,0.5), inset -2px -2px 5px rgba(0,0,0,0.2)"
            : "0 2px 12px rgba(255,150,0,0.45), inset -2px -2px 5px rgba(180,90,0,0.2)",
          transition:
            "left 0.5s cubic-bezier(0.68, -0.4, 0.27, 1.4), background 0.5s ease, box-shadow 0.5s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isDark ? "#3d4460" : "#7a4a00"}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            opacity: isDark ? 1 : 0,
            transform: isDark ? "rotate(0)" : "rotate(-140deg) scale(0.4)",
            transition: "opacity 0.4s ease, transform 0.5s ease",
            position: "absolute",
          }}
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#7a4a00"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            opacity: isDark ? 0 : 1,
            transform: isDark ? "rotate(140deg) scale(0.4)" : "rotate(0)",
            transition: "opacity 0.4s ease, transform 0.5s ease",
            position: "absolute",
          }}
        >
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22" />
          <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
          <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
          <line x1="2" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="22" y2="12" />
          <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
          <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
        </svg>
      </span>
    </button>
  );
}

function IconMorphButton({ theme, refreshing, loading, onClick }) {
  const t = THEMES[theme];
  const [hover, setHover] = useState(false);
  const active = loading || refreshing;
  return (
    <button
      onClick={onClick}
      disabled={active}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label="Refresh"
      title="Refresh"
      style={{
        position: "relative",
        width: 40,
        height: 40,
        borderRadius: 12,
        background: active
          ? t.accentGradient
          : hover
            ? t.surfaceGlassHover
            : t.surfaceGlass,
        border: `1px solid ${active ? "transparent" : hover ? t.borderStrong : t.border}`,
        cursor: active ? "wait" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: active ? "#ffffff" : t.textSecondary,
        transition: "all 0.3s ease",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          animation: active
            ? "spinFluid 0.9s cubic-bezier(0.4, 0, 0.2, 1) infinite"
            : "none",
        }}
      >
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
    </button>
  );
}

function LogoutButton({ theme }) {
  const t = THEMES[theme];
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState(false);

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { refreshToken } = useAuthStore.getState();
      if (refreshToken) {
        try {
          await axios.post(`${API}/api/auth/logout`, {
            refreshtoken: refreshToken,
          });
        } catch (e) {
          console.log("Logout API failed, clearing local session anyway", e);
        }
      }
    } finally {
      localStorage.removeItem("app-screen");
      localStorage.removeItem("auth-storage");
      localStorage.removeItem("exam-storage");
      useAuthStore.getState().clearAuth();
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label="Sign out"
      title="Sign out"
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        background: hover ? t.dangerBg : t.surfaceGlass,
        border: `1px solid ${hover ? t.danger + "55" : t.border}`,
        cursor: loading ? "wait" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: hover ? t.danger : t.textSecondary,
        transition: "all 0.3s ease",
        flexShrink: 0,
      }}
    >
      {loading ? (
        <span
          style={{
            width: 14,
            height: 14,
            border: `2px solid ${t.textMuted}44`,
            borderTopColor: t.textPrimary,
            borderRadius: "50%",
            animation: "spin 0.7s linear infinite",
          }}
        />
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: hover ? "translateX(2px)" : "translateX(0)",
            transition: "transform 0.3s ease",
          }}
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      )}
    </button>
  );
}

function GhostButton({ children, onClick, disabled, theme, style }) {
  const t = THEMES[theme];
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "8px 14px",
        fontSize: 12.5,
        fontWeight: 600,
        borderRadius: 10,
        background: hover && !disabled ? t.surfaceGlassHover : t.surfaceGlass,
        color: t.textSecondary,
        border: `1px solid ${hover && !disabled ? t.borderStrong : t.border}`,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "'Inter', sans-serif",
        transition: "all 0.2s ease",
        opacity: disabled ? 0.5 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function GradientButton({
  children,
  onClick,
  disabled,
  theme,
  gradient,
  glow,
  style,
}) {
  const t = THEMES[theme];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="cta-shine"
      style={{
        padding: "9px 18px",
        fontSize: 12.5,
        fontWeight: 700,
        borderRadius: 10,
        background: disabled ? t.borderStrong : gradient || t.accentGradient,
        color: "#ffffff",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "'Inter', sans-serif",
        letterSpacing: 0.3,
        boxShadow: disabled ? "none" : glow || t.glowAccent,
        transition: "all 0.2s ease",
        opacity: disabled ? 0.6 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      <span
        style={{
          position: "relative",
          zIndex: 2,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {children}
      </span>
    </button>
  );
}

function RingProgress({ value, total, color, size = 76, stroke = 6, theme }) {
  const t = THEMES[theme];
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  const offset = circumference - pct * circumference;
  return (
    <div
      style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={t.border}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: "stroke-dashoffset 0.9s cubic-bezier(0.2, 0.8, 0.2, 1)",
            filter: `drop-shadow(0 0 6px ${color}66)`,
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: t.textPrimary,
            fontFamily: "'Space Grotesk', sans-serif",
            letterSpacing: -0.5,
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function StatOrb({ label, value, total, color, gradient, theme, icon }) {
  const t = THEMES[theme];
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: t.cardSurface,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${hover ? t.borderStrong : t.border}`,
        borderRadius: 20,
        padding: 20,
        display: "flex",
        alignItems: "center",
        gap: 16,
        transition:
          "background 0.55s ease, border-color 0.35s ease, transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.35s ease",
        transform: hover ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hover
          ? `0 20px 40px ${color}22, 0 0 0 1px ${color}22 inset`
          : t.name === "light"
            ? "0 4px 14px rgba(20,28,60,0.06)"
            : "none",
        position: "relative",
        overflow: "hidden",
        cursor: "default",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -30,
          right: -30,
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: gradient,
          opacity: hover ? 0.22 : 0.1,
          filter: "blur(30px)",
          transition: "opacity 0.4s ease",
        }}
      />
      <RingProgress value={value} total={total} color={color} theme={theme} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          minWidth: 0,
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: "uppercase",
          }}
        >
          <span style={{ display: "inline-flex", opacity: 0.9 }}>{icon}</span>
          {label}
        </div>
        <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.4 }}>
          {total > 0 ? `${value} of ${total}` : "No data"}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status, theme }) {
  const t = THEMES[theme];
  const meta = examStatusMeta(status, t);
  const running = String(status).toUpperCase() === "RUNNING";
  return (
    <span
      style={{
        background: meta.gradient,
        color: "#ffffff",
        padding: "4px 12px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.3,
        whiteSpace: "nowrap",
        boxShadow: `0 4px 12px ${meta.color}44`,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {running && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#fff",
            animation: "pulseDot 1.4s ease-in-out infinite",
          }}
        />
      )}
      {meta.label}
    </span>
  );
}

/* ============= Confirm modal ============= */

function ConfirmModal({
  open,
  theme,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  danger,
  working,
}) {
  const t = THEMES[theme];
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: t.overlay,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: 20,
        animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: t.surfaceElevated,
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: `1px solid ${t.borderStrong}`,
          borderRadius: 20,
          padding: 28,
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          animation: "slideUp 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            margin: "0 auto 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: danger ? t.dangerBg : t.warningBg,
            border: `1px solid ${danger ? t.danger : t.warning}55`,
          }}
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke={danger ? t.danger : t.warning}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h3
          style={{
            fontSize: 19,
            fontWeight: 700,
            color: t.textPrimary,
            margin: 0,
            marginBottom: 8,
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontSize: 13.5,
            color: t.textSecondary,
            lineHeight: 1.6,
            margin: 0,
            marginBottom: 24,
          }}
        >
          {message}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={onCancel}
            disabled={working}
            style={{
              padding: "11px 22px",
              fontSize: 13.5,
              fontWeight: 700,
              borderRadius: 11,
              background: t.surfaceGlass,
              color: t.textPrimary,
              border: `1px solid ${t.borderStrong}`,
              cursor: working ? "not-allowed" : "pointer",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {cancelLabel || "Cancel"}
          </button>
          <button
            onClick={onConfirm}
            disabled={working}
            style={{
              padding: "11px 24px",
              fontSize: 13.5,
              fontWeight: 700,
              borderRadius: 11,
              background: danger ? t.dangerGradient : t.warningGradient,
              color: "#fff",
              border: "none",
              cursor: working ? "wait" : "pointer",
              fontFamily: "'Inter', sans-serif",
              boxShadow: danger ? t.glowDanger : t.glowWarning,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {working ? (
              <>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    border: "2px solid rgba(255,255,255,0.35)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
                Working...
              </>
            ) : (
              confirmLabel || "Confirm"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============= Action reason modal (replaces window.prompt) ============= */

function ReasonModal({
  open,
  theme,
  title,
  actionLabel,
  actionGradient,
  actionGlow,
  reason,
  onChange,
  onCancel,
  onConfirm,
  working,
}) {
  const t = THEMES[theme];
  if (!open) return null;

  const confirmationWord = ["Pause", "Resume", "Terminate"].includes(actionLabel)
    ? actionLabel
    : null;
  const normalizedValue = String(reason || "").trim().toLowerCase();
  const confirmationMatches = confirmationWord
    ? normalizedValue === confirmationWord.toLowerCase()
    : Boolean(normalizedValue);

  const handleKeyDown = (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (!confirmationMatches || working) return;
    event.preventDefault();
    onConfirm();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: t.overlay,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: 20,
        animation: "fadeIn 0.2s ease",
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !working) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          width: "100%",
          maxWidth: 460,
          background: t.surfaceElevated,
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: `1px solid ${t.borderStrong}`,
          borderRadius: 20,
          padding: 26,
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          animation: "slideUp 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        <h3
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: t.textPrimary,
            margin: 0,
            marginBottom: 6,
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {title}
        </h3>

        <p
          style={{
            fontSize: 12.5,
            color: t.textMuted,
            margin: "0 0 16px",
            lineHeight: 1.55,
          }}
        >
          {confirmationWord ? (
            <>
              {actionLabel === "Terminate"
                ? "This permanently finalizes this candidate's assessment. "
                : actionLabel === "Pause"
                  ? "This pauses this candidate's assessment. "
                  : "This resumes this candidate's assessment. "}
              To confirm, type <strong style={{ color: t.textPrimary }}>{confirmationWord}</strong> below.
            </>
          ) : (
            "Please provide a reason. This will be recorded and sent to the candidate."
          )}
        </p>

        {confirmationWord ? (
          <input
            autoFocus
            value={reason}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
            placeholder={`Type ${confirmationWord} to confirm`}
            aria-label={`Type ${confirmationWord} to confirm`}
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: t.inputBg,
              border: `1px solid ${confirmationMatches ? t.success : t.border}`,
              borderRadius: 12,
              color: t.textPrimary,
              padding: "12px 13px",
              fontSize: 14,
              outline: "none",
              fontFamily: "'Inter', sans-serif",
              boxShadow: confirmationMatches ? `0 0 0 3px ${t.successBg}` : "none",
            }}
          />
        ) : (
          <textarea
            autoFocus
            value={reason}
            onChange={(event) => onChange(event.target.value)}
            rows={4}
            placeholder="Type your reason..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              resize: "none",
              background: t.inputBg,
              border: `1px solid ${t.border}`,
              borderRadius: 12,
              color: t.textPrimary,
              padding: 12,
              fontSize: 13.5,
              outline: "none",
              fontFamily: "'Inter', sans-serif",
              lineHeight: 1.5,
            }}
          />
        )}

        {confirmationWord && reason.trim() && !confirmationMatches ? (
          <div style={{ marginTop: 8, color: t.danger, fontSize: 11.5, fontWeight: 600 }}>
            Type {confirmationWord} exactly to enable the action.
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 18,
          }}
        >
          <button
            onClick={onCancel}
            disabled={working}
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 11,
              background: t.surfaceGlass,
              color: t.textSecondary,
              border: `1px solid ${t.borderStrong}`,
              cursor: working ? "not-allowed" : "pointer",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={working || !confirmationMatches}
            style={{
              padding: "10px 22px",
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 11,
              background:
                working || !confirmationMatches
                  ? t.borderStrong
                  : actionGradient || t.accentGradient,
              color: "#fff",
              border: "none",
              cursor: working || !confirmationMatches ? "not-allowed" : "pointer",
              fontFamily: "'Inter', sans-serif",
              boxShadow:
                working || !confirmationMatches ? "none" : actionGlow || t.glowAccent,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {working ? (
              <>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    border: "2px solid rgba(255,255,255,0.35)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
                Working...
              </>
            ) : (
              actionLabel || "Confirm"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
/* ============= Request rejection modal ============= */
function RequestRejectionModal({
  open,
  theme,
  request,
  reason,
  onChange,
  onCancel,
  onConfirm,
  working,
}) {
  const t = THEMES[theme];
  if (!open || !request) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: t.overlay,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        animation: "fadeIn 0.2s ease",
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !working) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-rejection-title"
        style={{
          width: "min(460px, calc(100vw - 68px))",
          background: t.surfaceElevated,
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: `1px solid ${t.borderStrong}`,
          borderRadius: 20,
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          overflow: "hidden",
          animation: "slideUp 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "20px 22px",
            borderBottom: `1px solid ${t.border}`,
            background: t.dangerBg,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              color: t.danger,
              border: `1px solid ${t.danger}55`,
              background: t.surfaceGlass,
            }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="8" y1="8" x2="16" y2="16" />
              <line x1="16" y1="8" x2="8" y2="16" />
            </svg>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div id="request-rejection-title" style={{ color: t.textPrimary, fontSize: 17, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>
              Reject entry request
            </div>
            <div style={{ marginTop: 3, color: t.textMuted, fontSize: 11.5, lineHeight: 1.45 }}>
              {requestTypeLabel(request.type)} request from {request.candidatename || request.candidateid}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={working}
            aria-label="Close rejection dialog"
            style={{ width: 30, height: 30, borderRadius: 9, border: `1px solid ${t.border}`, background: t.surfaceGlass, color: t.textSecondary, cursor: working ? "not-allowed" : "pointer", fontSize: 18 }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 22 }}>
          <label style={{ display: "block", color: t.textMuted, fontSize: 9, fontWeight: 800, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 8 }}>
            Rejection reason
          </label>
          <textarea
            autoFocus
            value={reason}
            onChange={(event) => onChange(event.target.value)}
            rows={5}
            placeholder="Explain why the request is being rejected..."
            style={{ width: "100%", minHeight: 120, boxSizing: "border-box", resize: "vertical", padding: 13, borderRadius: 12, border: `1px solid ${t.border}`, outline: "none", background: t.inputBg, color: t.textPrimary, fontSize: 13.5, lineHeight: 1.55, fontFamily: "'Inter', sans-serif" }}
            onFocus={(event) => {
              event.target.style.borderColor = t.danger;
              event.target.style.boxShadow = `0 0 0 3px ${t.dangerBg}`;
            }}
            onBlur={(event) => {
              event.target.style.borderColor = t.border;
              event.target.style.boxShadow = "none";
            }}
          />
          <div style={{ marginTop: 10, color: t.textMuted, fontSize: 11.5, lineHeight: 1.5 }}>
            The reason will be recorded and shown to the candidate.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 22px 20px", borderTop: `1px solid ${t.border}` }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={working}
            style={{ padding: "10px 19px", borderRadius: 10, border: `1px solid ${t.borderStrong}`, background: t.surfaceGlass, color: t.textSecondary, fontSize: 13, fontWeight: 700, cursor: working ? "not-allowed" : "pointer" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={working || !reason.trim()}
            style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: working || !reason.trim() ? t.borderStrong : t.dangerGradient, color: "#fff", fontSize: 13, fontWeight: 800, cursor: working || !reason.trim() ? "not-allowed" : "pointer", boxShadow: working || !reason.trim() ? "none" : t.glowDanger, display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            {working ? "Rejecting..." : "Reject request"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============= Transition overlay (start / end) ============= */

function TransitionOverlay({ open, theme, variant, title, subtitle }) {
  const t = THEMES[theme];
  if (!open) return null;
  const color = variant === "end" ? t.danger : t.success;
  const gradient = variant === "end" ? t.dangerGradient : t.successGradient;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: t.overlay,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10001,
        animation: "fadeIn 0.3s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          animation: "slideUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        <div
          style={{
            position: "relative",
            width: 108,
            height: 108,
            marginBottom: 24,
          }}
        >
          <span
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: `2px solid ${color}`,
              opacity: 0.5,
              animation: "ringPulse 2s ease-out infinite",
            }}
          />
          <span
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: `2px solid ${color}`,
              opacity: 0.3,
              animation: "ringPulse 2s ease-out 0.7s infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 14,
              borderRadius: "50%",
              background: gradient,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 8px 30px ${color}66`,
              animation: "gentleFloat 2.4s ease-in-out infinite",
            }}
          >
            {variant === "end" ? (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="#ffffff">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="#ffffff">
                <polygon points="6 4 20 12 6 20 6 4" />
              </svg>
            )}
          </div>
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#ffffff",
            fontFamily: "'Space Grotesk', sans-serif",
            letterSpacing: -0.4,
            marginBottom: 6,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 13.5,
            color: "rgba(255,255,255,0.75)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              border: "2px solid rgba(255,255,255,0.3)",
              borderTopColor: "#fff",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          {subtitle}
        </div>
      </div>
    </div>
  );
}

/* ============= Exam card (list view) ============= */

function ExamCard({ exam, theme, index, onMonitor, onAssign, pendingRequestCount = 0, onOpenRequests }) {
  const t = THEMES[theme];
  const [hover, setHover] = useState(false);
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });
  const cardRef = useRef(null);
  const meta = examStatusMeta(exam.status, t);
  const running = String(exam.status).toUpperCase() === "RUNNING";
  const handleMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMouse({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  };
  return (
    <div
      ref={cardRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setMouse({ x: 0.5, y: 0.5 });
      }}
      onMouseMove={handleMove}
      style={{
        background: hover ? t.cardSurfaceHover : t.cardSurface,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: `1px solid ${hover ? t.borderStrong : t.border}`,
        borderRadius: 22,
        padding: 22,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        boxShadow: hover
          ? `0 24px 48px ${t.name === "light" ? "rgba(20,28,60,0.15)" : "rgba(0,0,0,0.28)"}, 0 0 0 1px ${meta.color}22 inset`
          : t.name === "light"
            ? "0 6px 20px rgba(20,28,60,0.08)"
            : "0 4px 20px rgba(0,0,0,0.12)",
        transition:
          "background 0.5s ease, border-color 0.3s ease, box-shadow 0.4s ease, transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)",
        transform: hover ? "translateY(-6px)" : "translateY(0)",
        position: "relative",
        overflow: "visible",
        animation: `cardEnter 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) ${index * 0.05}s both`,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: `${mouse.y * 100}%`,
          left: `${mouse.x * 100}%`,
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${meta.color}22 0%, transparent 70%)`,
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          opacity: hover ? 1 : 0,
          transition: "opacity 0.4s ease",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 12,
          right: 12,
          height: 3,
          borderRadius: 999,
          background: meta.gradient,
          opacity: hover ? 1 : 0.6,
          transition: "opacity 0.35s ease",
          pointerEvents: "none",
        }}
      />
      {pendingRequestCount > 0 ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenRequests?.(exam);
          }}
          title={`${pendingRequestCount} pending entry request${
            pendingRequestCount === 1 ? "" : "s"
          }`}
          aria-label={`${pendingRequestCount} pending entry request${
            pendingRequestCount === 1 ? "" : "s"
          }`}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            transform: "translate(50%, -50%)",
            zIndex: 9999,
            width: 24,
            height: 24,
            padding: 0,
            borderRadius: "50%",
            border: `2px solid ${t.canvas}`,
            background: t.dangerGradient,
            color: "#ffffff",
            boxShadow: `0 6px 16px ${t.danger}66`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
          </svg>

          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 13,
              height: 13,
              padding: "0 3px",
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: t.surfaceSolid,
              color: t.danger,
              border: `1px solid ${t.danger}99`,
              fontSize: 7,
              fontWeight: 900,
              boxSizing: "border-box",
              pointerEvents: "none",
            }}
          >
            {pendingRequestCount > 9 ? "9+" : pendingRequestCount}
          </span>
        </button>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: t.textPrimary,
              marginBottom: 8,
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: -0.4,
              lineHeight: 1.25,
            }}
          >
            {exam.name}
          </div>
          {exam.examtype !== "MULTI_SESSION" ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 12,
                  color: t.textMuted,
                  fontWeight: 500,
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {exam.date || "—"}
              </span>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 12,
                  color: t.textMuted,
                  fontWeight: 500,
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {exam.starttime} — {exam.endtime}
              </span>
            </div>
          ) : null}
        </div>
        <StatusPill status={exam.status} theme={theme} />
      </div>
      {exam.examtype === "MULTI_SESSION" ? (
        <div style={{ position: "relative", zIndex: 1, padding: "10px 12px", borderRadius: 12, background: t.accentSoft, border: `1px solid ${t.borderAccent}` }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: t.accent, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 7 }}>
            Multi-Session Exam
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            {exam.timeframes.map((frame, frameIndex) => (
              <div key={`${frame.date}-${frame.starttime || frame.start_time}-${frameIndex}`} style={{ fontSize: 11.5, color: t.textSecondary }}>
                {frame.date} · {frame.starttime || frame.start_time} - {frame.endtime || frame.end_time}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 8, position: "relative", zIndex: 1 }}>
        <div
          style={{
            flex: 1,
            background: t.surfaceGlass,
            border: `1px solid ${t.border}`,
            borderRadius: 12,
            padding: "10px 12px",
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: t.textMuted,
              marginBottom: 4,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Duration
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: t.textPrimary,
              fontFamily: "'Space Grotesk', sans-serif",
              display: "flex",
              alignItems: "baseline",
              gap: 4,
            }}
          >
            {exam.durationminutes}
            <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 500 }}>
              min
            </span>
          </div>
        </div>
        {/* <div
          style={{
            flex: 1,
            background: t.surfaceGlass,
            border: `1px solid ${t.border}`,
            borderRadius: 12,
            padding: "10px 12px",
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: t.textMuted,
              marginBottom: 4,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Session
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: running ? t.success : t.textPrimary,
              fontFamily: "'Space Grotesk', sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            {running && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: t.success,
                  boxShadow: `0 0 6px ${t.success}`,
                  animation: "pulseDot 1.4s ease-in-out infinite",
                }}
              />
            )}
            {meta.label}
          </div>
        </div> */}
      </div>
      <div style={{ display: "flex", gap: 8, position: "relative", zIndex: 1 }}>
        <GradientButton
          theme={theme}
          onClick={() => onMonitor(exam)}
          style={{ flex: 1, padding: "11px 0" }}
        >
          Monitor
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </GradientButton>
        <GhostButton
          theme={theme}
          onClick={() => onAssign(exam)}
          style={{ flex: 1, justifyContent: "center", padding: "11px 0" }}
        >
          Assign
        </GhostButton>
      </div>
    </div>
  );
}

/* ============= Monitor pieces ============= */

function StatCard({ label, value, color, icon, theme }) {
  const t = THEMES[theme];
  return (
    <div
      style={{
        background: t.cardSurface,
        border: `1px solid ${t.border}`,
        borderRadius: 16,
        padding: "16px 18px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        boxShadow:
          t.name === "light" ? "0 4px 14px rgba(20,28,60,0.05)" : "none",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background: `${color}18`,
          border: `1px solid ${color}44`,
          color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: t.textPrimary,
            fontFamily: "'Space Grotesk', sans-serif",
            lineHeight: 1,
          }}
        >
          {value}
        </div>
        <div
          style={{
            fontSize: 9,
            color: t.textMuted,
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            marginTop: 4,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

function MonitorTabButton({ active, label, count, onClick, theme, icon }) {
  const t = THEMES[theme];
  return (
    <button
      onClick={onClick}
      style={{
        height: 38,
        padding: "0 16px",
        borderRadius: 11,
        fontSize: 12.5,
        fontWeight: 700,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: active ? t.accentSoft : "transparent",
        color: active ? t.accent : t.textSecondary,
        border: active
          ? `1px solid ${t.borderAccent}`
          : `1px solid transparent`,
        fontFamily: "'Inter', sans-serif",
        transition: "all 0.2s ease",
      }}
    >
      {icon}
      <span>{label}</span>
      {typeof count === "number" ? (
        <span
          style={{
            minWidth: 18,
            height: 18,
            padding: "0 6px",
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: count > 0 ? t.warningGradient : t.surfaceGlass,
            color: count > 0 ? "#ffffff" : t.textMuted,
            fontSize: 11,
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function CandidateTile({
  c,
  stream,
  connectionState,
  isActive,
  onClick,
  theme,
  unreadCount = 0,
}) {
  const t = THEMES[theme];

  return (
    <div
      style={{
        position: "relative",
        overflow: "visible",
        isolation: "isolate",
        zIndex: unreadCount > 0 ? 20 : 1,
      }}
    >
      <CandidateVideoTile
        candidate={c}
        stream={stream}
        connectionState={connectionState}
        selected={isActive}
        onClick={onClick}
        theme={t}
      />

      {unreadCount > 0 ? (
        <div
          title={`${unreadCount} unread private message${unreadCount === 1 ? "" : "s"}`}
          aria-label={`${unreadCount} unread private message${unreadCount === 1 ? "" : "s"}`}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            transform: "translate(50%, -50%)",
            zIndex: 9999,
            minWidth: 30,
            height: 30,
            padding: "0 7px",
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            background: t.accentGradient,
            color: "#ffffff",
            border: `2px solid ${t.canvas}`,
            boxShadow: "0 8px 22px rgba(91,140,255,0.48)",
            fontSize: 10,
            fontWeight: 900,
            lineHeight: 1,
            pointerEvents: "none",
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
          </svg>
          <span>{unreadCount > 9 ? "9+" : unreadCount}</span>
        </div>
      ) : null}
    </div>
  );
}

function GlobalStyles({ theme }) {
  const t = THEMES[theme];
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes spinFluid { to { transform: rotate(360deg); } }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp { from { opacity: 0; transform: translateY(14px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes pulseDot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.4); } }
      @keyframes cardEnter { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes gradientShift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
      @keyframes floatBlob {
        0%, 100% { transform: translate(0, 0) scale(1); }
        33% { transform: translate(30px, -20px) scale(1.08); }
        66% { transform: translate(-20px, 30px) scale(0.94); }
      }
      @keyframes ringPulse { 0% { transform: scale(0.9); opacity: 0.6; } 100% { transform: scale(1.7); opacity: 0; } }
      @keyframes gentleFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
      @keyframes shine {
        0% { transform: translateX(-120%) skewX(-20deg); }
        100% { transform: translateX(220%) skewX(-20deg); }
      }
      .cta-shine::before {
        content: "";
        position: absolute;
        top: 0; left: 0; bottom: 0;
        width: 40%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
        transform: translateX(-120%) skewX(-20deg);
        pointer-events: none;
      }
      .cta-shine:hover::before { animation: shine 0.9s ease; }
      ::-webkit-scrollbar { width: 10px; height: 10px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: ${t.borderStrong}; border-radius: 999px; border: 2px solid transparent; background-clip: padding-box; }
      ::-webkit-scrollbar-thumb:hover { background: ${t.accent}; background-clip: padding-box; }
      .gradient-text {
        background: ${t.accentGradient}; background-size: 200% 200%; animation: gradientShift 6s ease infinite;
        -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; display: inline-block;
      }
      .clock-gradient {
        background: ${t.accentGradient}; background-size: 200% 200%; animation: gradientShift 6s ease infinite;
        -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; display: inline-block; line-height: 1;
      }
      .avatar-gradient { background: ${t.accentGradient}; background-size: 200% 200%; animation: gradientShift 6s ease infinite; }
      input::placeholder { color: ${t.textMuted}; opacity: 0.85; }
      button, a, input, textarea { transition: background-color 0.25s ease, border-color 0.25s ease, color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease, opacity 0.25s ease; }
    `}</style>
  );
}

/* ============= Main component ============= */

export default function ExaminerDashboard() {
  const { theme, toggleTheme } = useTheme();
  const t = THEMES[theme];

  const [monitorTab, setMonitorTab] = useState("grid");
  const [reentryRequests, setReentryRequests] = useState([]);
  const { user, accessToken } = useAuthStore();
  const socket = useSocket(accessToken);

  const [view, setView] = useState("list");
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [liveData, setLiveData] = useState({});
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [violations, setViolations] = useState([]);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [loadingExams, setLoadingExams] = useState(false);
  const [startingExam, setStartingExam] = useState(false);
  const [endingExam, setEndingExam] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [reviewingRequestId, setReviewingRequestId] = useState(null);
  const [clock, setClock] = useState(new Date());
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadPrivateMessages, setUnreadPrivateMessages] = useState({});

  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);
  const [stoppingExam, setStoppingExam] = useState(false);
  const [transition, setTransition] = useState(null);

  const [reasonModal, setReasonModal] = useState(null);
  const [reasonText, setReasonText] = useState("");
  const [reasonWorking, setReasonWorking] = useState(false);
  const [requestRejectionModal, setRequestRejectionModal] = useState(null);
  const [requestRejectionReason, setRequestRejectionReason] = useState("");

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken],
  );

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const selectedExamId = selectedExam?.examid ?? selectedExam?.exam_id ?? null;
  const examinerId = user?.userid || user?.user_id;
  const {
    streams: candidateCameraStreams,
    states: candidateCameraStates,
    requestStream: requestCandidateCamera,
  } = useExaminerWebRTC(socket, selectedExamId, examinerId);
  const normalizedExamStatus = String(selectedExam?.status || "").toUpperCase();
  const isExamRunning = normalizedExamStatus === "RUNNING";
  const isExamCompleted = normalizedExamStatus === "COMPLETED";
  const isExamStopped = normalizedExamStatus === "STOPPED";
  const isMultiSessionExam = selectedExam?.examtype === "MULTI_SESSION";
  const canStartExam = !isExamRunning && !isExamStopped && (!isExamCompleted || isMultiSessionExam);

  const pendingRequestsCount = useMemo(
    () =>
      reentryRequests.filter(
        (r) => String(r.status).toUpperCase() === "PENDING",
      ).length,
    [reentryRequests],
  );
  const pendingRequestCountsByExam = useMemo(() => {
    const counts = {};
    for (const request of reentryRequests) {
      if (String(request.status).toUpperCase() !== "PENDING") continue;
      if (!request.examid) continue;
      const examId = String(request.examid);
      counts[examId] = Number(counts[examId] || 0) + 1;
    }
    return counts;
  }, [reentryRequests]);

  const loadExams = useCallback(async () => {
    setLoadingExams(true);
    try {
      const res = await axios.get(`${API}/api/exams`, { headers });
      const rows = Array.isArray(res.data) ? res.data.map(normalizeExam) : [];
      setExams(rows);
      // Keep the selected exam stable while Create/Assign screens are open.
      if (view === "monitor" && selectedExamId) {
        const latest = rows.find((x) => x.examid === selectedExamId);
        if (latest) setSelectedExam(latest);
      }
    } catch (e) {
      console.error("loadExams:", e.message);
    } finally {
      setLoadingExams(false);
    }
  }, [headers, selectedExamId, view]);

  const loadExamById = useCallback(
    async (examId) => {
      if (!examId) return null;
      try {
        const res = await axios.get(`${API}/api/exams/${examId}`, { headers });
        const normalized = normalizeExam(res.data);
        setSelectedExam(normalized);
        setExams((prev) =>
          prev.map((e) => (e.examid === examId ? normalized : e)),
        );
        return normalized;
      } catch (e) {
        console.error("loadExamById:", e.message);
        return null;
      }
    },
    [headers],
  );

  const loadCandidates = useCallback(
    async (examId) => {
      if (!examId) return;
      try {
        const res = await axios.get(`${API}/api/exams/${examId}/assessments`, {
          headers,
        });
        setCandidates(
          Array.isArray(res.data) ? res.data.map(normalizeCandidate) : [],
        );
      } catch (e) {
        console.error("loadCandidates:", e.message);
      }
    },
    [headers],
  );

  const loadViolations = useCallback(
    async (candidateId, examId) => {
      if (!candidateId || !examId) return;
      try {
        const res = await axios.get(
          `${API}/api/violations/${examId}/${candidateId}`,
          { headers },
        );
        setViolations(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error("loadViolations:", e.message);
        setViolations([]);
      }
    },
    [headers],
  );

  const loadReentryRequests = useCallback(
    async (examIdArg) => {
      const examId = examIdArg ?? selectedExamId;
      if (!examId) {
        setReentryRequests([]);
        return [];
      }
      try {
        const res = await axios.get(
          `${API}/api/requests/exam/${examId}/pending`,
          { headers },
        );
        const rows = Array.isArray(res.data)
          ? res.data.map(normalizeRequest)
          : [];
        setReentryRequests(rows);
        return rows;
      } catch (e) {
        console.error("loadReentryRequests:", e.message);
        setReentryRequests([]);
        return [];
      }
    },
    [selectedExamId, headers],
  );

  useEffect(() => {
    // Only the list view owns the exam-list refresh.
    if (view !== "list") return;
    loadExams();
  }, [view, loadExams, refreshTick]);
  useEffect(() => {
    if (view !== "list" || exams.length === 0) return;

    let cancelled = false;
    const loadListRequestBadges = async () => {
      try {
        const responses = await Promise.all(
          exams
            .filter((exam) => exam?.examid)
            .map((exam) =>
              axios
                .get(`${API}/api/requests/exam/${exam.examid}/pending`, { headers })
                .then((response) =>
                  (Array.isArray(response.data) ? response.data : []).map(normalizeRequest),
                )
                .catch(() => []),
            ),
        );
        if (!cancelled) setReentryRequests(responses.flat().filter(Boolean));
      } catch (error) {
        console.error("loadListRequestBadges:", error.message);
      }
    };

    loadListRequestBadges();
    return () => {
      cancelled = true;
    };
  }, [view, exams, headers]);

  useEffect(() => {
    if (view !== "monitor" || !selectedExamId) return;
    // One initial snapshot only. All later changes arrive through Socket.IO.
    loadExamById(selectedExamId);
    loadCandidates(selectedExamId);
    loadReentryRequests(selectedExamId);
  }, [view, selectedExamId, loadExamById, loadCandidates, loadReentryRequests]);

  useEffect(() => {
    if (!socket) return;

    const onExamCreated = (payload) => {
      const next = normalizeExam(payload?.exam || payload);
      if (!next?.examid) return;
      setExams((previous) =>
        previous.some((item) => item.examid === next.examid)
          ? previous.map((item) =>
              item.examid === next.examid ? { ...item, ...next } : item,
            )
          : [next, ...previous],
      );
    };

    const onExamUpdated = (payload) => {
      const next = normalizeExam(payload?.exam || payload);
      if (!next?.examid) return;
      setExams((previous) =>
        previous.map((item) =>
          item.examid === next.examid ? { ...item, ...next } : item,
        ),
      );
      if (view === "monitor" && next.examid === selectedExamId) {
        setSelectedExam((previous) => ({ ...(previous || {}), ...next }));
      }
    };

    const onCandidateUpdate = (payload) => {
      const candidateId = payload?.candidateid ?? payload?.candidate_id;
      if (!candidateId) return;
      setLiveData((previous) => ({
        ...previous,
        [candidateId]: { ...(previous[candidateId] || {}), ...payload },
      }));
    };

    const onAssessmentUpdated = (payload) => {
      const next = normalizeCandidate(payload?.assessment || payload);
      const payloadExamId = payload?.examid ?? payload?.exam_id ?? next?.examid;
      if (
        selectedExamId &&
        payloadExamId &&
        String(payloadExamId) !== String(selectedExamId)
      )
        return;
      if (!next?.assessmentid) return;
      setCandidates((previous) => {
        const exists = previous.some(
          (item) => item.assessmentid === next.assessmentid,
        );
        if (!exists) return [...previous, next];
        return previous.map((item) =>
          item.assessmentid === next.assessmentid
            ? {
                ...item,
                ...next,
                // Assessment events contain the exam name in `name`. Preserve the
                // candidate identity obtained from the initial assessment list.
                candidatename: next.candidatename || item.candidatename,
                candidateemail: next.candidateemail || item.candidateemail,
              }
            : item,
        );
      });
      setSelectedCandidate((previous) => {
        if (!previous || previous.assessmentid !== next.assessmentid) return previous;
        return {
          ...previous,
          ...next,
          candidatename: next.candidatename || previous.candidatename,
          candidateemail: next.candidateemail || previous.candidateemail,
        };
      });
    };

    const onAssessmentRemoved = (payload) => {
      const assessmentId = payload?.assessmentid ?? payload?.assessment_id;
      setCandidates((previous) =>
        previous.filter((item) => item.assessmentid !== assessmentId),
      );
    };

    const onRequestCreated = (payload) => {
      const next = normalizeRequest(payload?.request || payload);
      if (
        !next?.requestid ||
        (selectedExamId && next.examid !== selectedExamId)
      )
        return;
      setReentryRequests((previous) =>
        previous.some((item) => item.requestid === next.requestid)
          ? previous
          : [next, ...previous],
      );
    };

    const onRequestReviewed = (payload) => {
      const requestId = payload?.requestid ?? payload?.request_id;
      setReentryRequests((previous) =>
        previous.filter((item) => item.requestid !== requestId),
      );
      if (payload?.assessment) onAssessmentUpdated(payload.assessment);
    };

    const onViolationAlert = ({ candidate_id, candidateid, violation }) => {
      const candidateId = candidate_id ?? candidateid;
      if (!candidateId) return;
      setLiveData((previous) => ({
        ...previous,
        [candidateId]: {
          ...(previous[candidateId] || {}),
          latestViolation: violation,
        },
      }));
    };

    const joinSelectedExamRoom = () => {
      if (!socket.connected || view !== "monitor" || !selectedExamId) return;
      socket.emit("join_exam", { examid: selectedExamId, role: "Examiner" });
    };

    const handleReconnect = () => {
      joinSelectedExamRoom();
      if (view === "monitor" && selectedExamId) {
        void Promise.all([
          loadCandidates(selectedExamId),
          loadExamById(selectedExamId),
          loadReentryRequests(selectedExamId),
        ]);
      } else {
        void loadExams();
      }
    };

    joinSelectedExamRoom();

    socket.on("connect", handleReconnect);
    socket.on("exam_created", onExamCreated);
    socket.on("exam_updated", onExamUpdated);
    socket.on("candidate_update", onCandidateUpdate);
    socket.on("assessment_created", onAssessmentUpdated);
    socket.on("assessment_updated", onAssessmentUpdated);
    socket.on("assessment_removed", onAssessmentRemoved);
    socket.on("request_created", onRequestCreated);
    socket.on("request_reviewed", onRequestReviewed);
    socket.on("violation_alert", onViolationAlert);

    return () => {
      socket.off("connect", handleReconnect);
      socket.off("exam_created", onExamCreated);
      socket.off("exam_updated", onExamUpdated);
      socket.off("candidate_update", onCandidateUpdate);
      socket.off("assessment_created", onAssessmentUpdated);
      socket.off("assessment_updated", onAssessmentUpdated);
      socket.off("assessment_removed", onAssessmentRemoved);
      socket.off("request_created", onRequestCreated);
      socket.off("request_reviewed", onRequestReviewed);
      socket.off("violation_alert", onViolationAlert);
    };
  }, [
    socket,
    view,
    selectedExamId,
    loadCandidates,
    loadExamById,
    loadReentryRequests,
    loadExams,
  ]);

  useEffect(() => {
    if (
      !socket ||
      view !== "monitor" ||
      !selectedExamId ||
      candidates.length === 0
    ) {
      return undefined;
    }

    const privateRoomPayloads = candidates
      .filter((candidate) => candidate?.candidateid)
      .map((candidate) => ({
        examid: selectedExamId,
        assessmentid: candidate.assessmentid || undefined,
        candidateid: candidate.candidateid,
        conversationtype: "PRIVATE",
      }));

    const joinPrivateRooms = () => {
      privateRoomPayloads.forEach((payload) => {
        socket.emit("chat_join", payload);
      });
    };

    const onPrivateMessageCreated = (incoming) => {
      const conversationType = String(
        incoming?.conversationtype || incoming?.conversation_type || "",
      ).toUpperCase();
      const messageExamId = incoming?.examid || incoming?.exam_id;
      const candidateId = incoming?.candidateid || incoming?.candidate_id;
      const senderRole = String(
        incoming?.senderrole || incoming?.sender_role || "",
      ).toLowerCase();

      if (conversationType !== "PRIVATE") return;
      if (String(messageExamId) !== String(selectedExamId)) return;
      if (!candidateId || senderRole !== "candidate") return;

      const currentlyReading =
        chatOpen &&
        String(selectedCandidate?.candidateid || "") === String(candidateId);

      if (currentlyReading) return;

      setUnreadPrivateMessages((current) => ({
        ...current,
        [String(candidateId)]: Number(current[String(candidateId)] || 0) + 1,
      }));
    };

    if (socket.connected) joinPrivateRooms();
    socket.on("connect", joinPrivateRooms);
    socket.on("chat_message_created", onPrivateMessageCreated);

    return () => {
      socket.off("connect", joinPrivateRooms);
      socket.off("chat_message_created", onPrivateMessageCreated);
      if (socket.connected) {
        privateRoomPayloads.forEach((payload) => {
          socket.emit("chat_leave", payload);
        });
      }
    };
  }, [
    socket,
    view,
    selectedExamId,
    candidates,
    chatOpen,
    selectedCandidate?.candidateid,
  ]);

  useEffect(() => {
    if (!chatOpen || !selectedCandidate?.candidateid) return;

    const candidateId = String(selectedCandidate.candidateid);
    setUnreadPrivateMessages((current) => {
      if (!current[candidateId]) return current;
      const next = { ...current };
      delete next[candidateId];
      return next;
    });
  }, [chatOpen, selectedCandidate?.candidateid]);

  const openMonitor = async (exam) => {
    const normalized = normalizeExam(exam);
    setSelectedExam(normalized);
    setSelectedCandidate(null);
    setViolations([]);
    setLiveData({});
    setReentryRequests([]);
    setCandidateSearch("");
    setChatOpen(false);
    setUnreadPrivateMessages({});
    setView("monitor");
    setMonitorTab("grid");
    const [requests] = await Promise.all([
      loadReentryRequests(normalized?.examid),
      loadExamById(normalized?.examid),
      loadCandidates(normalized?.examid),
    ]);
    const hasPending =
      Array.isArray(requests) &&
      requests.some((r) => String(r.status).toUpperCase() === "PENDING");
    setMonitorTab(hasPending ? "requests" : "grid");
  };

  useEffect(() => {
    if (!socket || !selectedExamId || candidates.length === 0) return undefined;

    const requestMissingStreams = (force = false) => {
      if (!socket.connected) return;

      candidates.forEach((candidate) => {
        const candidateId = candidate?.candidateid;
        if (!candidateId) return;

        const key = String(candidateId);
        const stream = candidateCameraStreams[key];
        const connectionState = candidateCameraStates[key];
        const hasLiveVideo = Boolean(
          stream
            ?.getVideoTracks?.()
            .some((track) => track.readyState === "live"),
        );
        const connectionInProgress = [
          "requesting",
          "connecting",
          "connected",
          "completed",
        ].includes(connectionState);

        if (!hasLiveVideo && (!connectionInProgress || force)) {
          requestCandidateCamera(
            candidateId,
            candidate.assessmentid,
            force,
          );
        }
      });
    };

    const initialTimer = window.setTimeout(
      () => requestMissingStreams(false),
      300,
    );
    const recoveryTimer = window.setTimeout(
      () => requestMissingStreams(true),
      2200,
    );
    const handleSocketConnect = () => {
      window.setTimeout(() => requestMissingStreams(true), 300);
    };

    socket.on("connect", handleSocketConnect);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearTimeout(recoveryTimer);
      socket.off("connect", handleSocketConnect);
    };
  }, [
    socket,
    selectedExamId,
    candidates,
    candidateCameraStreams,
    candidateCameraStates,
    requestCandidateCamera,
  ]);

  const startExam = async () => {
    if (!selectedExamId || startingExam || !canStartExam) return;
    setStartingExam(true);
    setTransition({
      variant: "start",
      title: isMultiSessionExam && isExamCompleted ? "Starting the next session" : "Starting the exam",
      subtitle: "Going live for eligible candidates...",
    });
    try {
      await axios.patch(
        `${API}/api/exams/${selectedExamId}/start`,
        {},
        { headers },
      );
      if (socket) socket.emit("start_exam", { exam_id: selectedExamId });
      await Promise.all([
        loadExamById(selectedExamId),
        loadCandidates(selectedExamId),
        loadReentryRequests(selectedExamId),
      ]);
      setRefreshTick((v) => v + 1);
      await new Promise((r) => setTimeout(r, 900));
      setActionMsg(isMultiSessionExam ? "Multi-session exam is now running" : "Exam is now running");
      setTimeout(() => setActionMsg(""), 5000);
    } catch (e) {
      setActionMsg(
        `Could not start the exam: ${e.response?.data?.detail || e.message}`,
      );
      setTimeout(() => setActionMsg(""), 5000);
    } finally {
      setTransition(null);
      setStartingExam(false);
    }
  };

  const performEndExam = async () => {
    if (!selectedExamId || endingExam || isExamCompleted) return;
    setEndingExam(true);
    setConfirmEndOpen(false);
    setTransition({
      variant: "end",
      title: isMultiSessionExam ? "Ending the current session" : "Ending the exam",
      subtitle: "Closing all active candidate sessions...",
    });
    try {
      await axios.patch(
        `${API}/api/exams/${selectedExamId}/end`,
        {},
        { headers },
      );
      await Promise.all([
        loadExamById(selectedExamId),
        loadCandidates(selectedExamId),
        loadReentryRequests(selectedExamId),
      ]);
      setRefreshTick((v) => v + 1);
      await new Promise((r) => setTimeout(r, 900));
      setActionMsg(isMultiSessionExam ? "Current session ended successfully" : "Exam ended successfully");
      setTimeout(() => setActionMsg(""), 5000);
    } catch (e) {
      setActionMsg(
        `Could not end the exam: ${e.response?.data?.detail || e.message}`,
      );
      setTimeout(() => setActionMsg(""), 5000);
    } finally {
      setTransition(null);
      setEndingExam(false);
    }
  };

  const performStopExam = async () => {
    if (!selectedExamId || stoppingExam || !isMultiSessionExam || isExamStopped) return;
    setStoppingExam(true);
    setConfirmStopOpen(false);
    setTransition({ variant: "end", title: "Stopping the exam", subtitle: "Permanently closing this multi-session exam..." });
    try {
      await axios.patch(`${API}/api/exams/${selectedExamId}/stop`, {}, { headers });
      await Promise.all([loadExamById(selectedExamId), loadCandidates(selectedExamId), loadReentryRequests(selectedExamId)]);
      setRefreshTick((value) => value + 1);
      setActionMsg("Multi-session exam permanently stopped");
      setTimeout(() => setActionMsg(""), 5000);
    } catch (error) {
      setActionMsg(`Could not stop the exam: ${error.response?.data?.detail || error.message}`);
      setTimeout(() => setActionMsg(""), 5000);
    } finally {
      setTransition(null);
      setStoppingExam(false);
    }
  };
  const requestAction = (assessmentId, action) => {
    if (!assessmentId) return;
    const currentStatus = normalizeStatusKey(selectedCandidate?.status);
    if (action === "pause" && currentStatus !== "ACTIVE") {
      setActionMsg(currentStatus === "PAUSED" ? "Assessment is already paused" : "Only an active assessment can be paused");
      setTimeout(() => setActionMsg(""), 3500);
      return;
    }
    if (action === "resume" && currentStatus !== "PAUSED") {
      setActionMsg(currentStatus === "ACTIVE" ? "Assessment is already active" : "Only a paused assessment can be resumed");
      setTimeout(() => setActionMsg(""), 3500);
      return;
    }
    if (action === "terminate" && ["TERMINATED", "COMPLETED", "LOCKED"].includes(currentStatus)) {
      setActionMsg("Finalized assessment cannot be modified");
      setTimeout(() => setActionMsg(""), 3500);
      return;
    }
    setReasonText("");
    setReasonModal({ assessmentid: assessmentId, action });
  };

  const performAction = async () => {
    if (!reasonModal) return;
    const { assessmentid, action } = reasonModal;
    const reason = reasonText.trim();
    const requiredConfirmation =
      action === "pause"
        ? "pause"
        : action === "resume"
          ? "resume"
          : action === "terminate"
            ? "terminate"
            : null;
    if (!reason) return;
    if (requiredConfirmation && reason.toLowerCase() !== requiredConfirmation) return;
    setReasonWorking(true);
    try {
      await axios.post(
        `${API}/api/assessments/${assessmentid}/action`,
        { action, reason },
        { headers },
      );
      if (socket) {
        socket.emit("examiner_control", {
          exam_id: selectedExamId,
          examid: selectedExamId,
          assessment_id: assessmentid,
          assessmentid: assessmentid,
          candidate_id: selectedCandidate?.candidateid,
          candidateid: selectedCandidate?.candidateid,
          action,
          status: action === "terminate" ? "TERMINATED" : undefined,
        });
      }
      setActionMsg(
        `${action.charAt(0).toUpperCase() + action.slice(1)} applied`,
      );
      setTimeout(() => setActionMsg(""), 3000);
      await loadCandidates(selectedExamId);
      if (selectedCandidate?.candidateid)
        await loadViolations(selectedCandidate.candidateid, selectedExamId);
      await loadExamById(selectedExamId);
      await loadReentryRequests(selectedExamId);
      setReasonModal(null);
      setReasonText("");
    } catch (e) {
      setActionMsg(`Action failed: ${e.response?.data?.detail || e.message}`);
      setTimeout(() => setActionMsg(""), 4000);
    } finally {
      setReasonWorking(false);
    }
  };

  const sendBroadcast = () => {
    if (!broadcastMsg.trim() || !socket || !selectedExamId) return;
    socket.emit("broadcast_message", {
      exam_id: selectedExamId,
      examiner_id: user?.user_id ?? user?.userid,
      message: broadcastMsg.trim(),
    });
    setBroadcastMsg("");
    setActionMsg("Broadcast sent to all candidates");
    setTimeout(() => setActionMsg(""), 3000);
  };

  const goBack = () => {
    setView("list");
    setSelectedExam(null);
    setSelectedCandidate(null);
    setCandidates([]);
    setLiveData({});
    setViolations([]);
    setReentryRequests([]);
    setMonitorTab("grid");
    setUnreadPrivateMessages({});
    loadExams();
  };

  const handleReentryReview = async (
    request,
    approve,
    suppliedReason = "",
  ) => {
    const requestId = request?.requestid;
    if (!requestId) return;

    if (!approve && !suppliedReason.trim()) {
      setRequestRejectionReason("");
      setRequestRejectionModal(request);
      return;
    }

    const decision = approve ? "APPROVED" : "REJECTED";
    const rejectionReason = approve ? "" : suppliedReason.trim();
    setReviewingRequestId(requestId);

    try {
      await axios.patch(
        `${API}/api/requests/${requestId}/review`,
        {
          decision,
          reason: approve ? undefined : rejectionReason,
        },
        { headers },
      );

      if (socket) {
        socket.emit("reentry_decision", {
          request_id: requestId,
          requestid: requestId,
          assessment_id: request?.assessmentid,
          assessmentid: request?.assessmentid,
          candidate_id: request?.candidateid,
          candidateid: request?.candidateid,
          approved: approve,
          exam_id: selectedExamId,
          examid: selectedExamId,
          decision,
          type: request?.type,
          next_status: approve
            ? request?.type === "LATEENTRY" || request?.type === "LATE_ENTRY"
              ? "LATEENTRY_APPROVED"
              : "REENTRY_APPROVED"
            : request?.type === "LATEENTRY" || request?.type === "LATE_ENTRY"
              ? "LATEENTRY_REJECTED"
              : "REENTRY_REJECTED",
        });
      }

      await Promise.all([
        loadReentryRequests(selectedExamId),
        loadCandidates(selectedExamId),
        loadExamById(selectedExamId),
      ]);

      if (!approve) {
        setRequestRejectionModal(null);
        setRequestRejectionReason("");
      }

      setActionMsg(approve ? "Request approved" : "Request rejected");
      setTimeout(() => setActionMsg(""), 3000);
    } catch (err) {
      console.error(err);
      setActionMsg(`${err.response?.data?.detail || err.message}`);
      setTimeout(() => setActionMsg(""), 4000);
    } finally {
      setReviewingRequestId(null);
    }
  };

  /* ============= CREATE / ASSIGN passthrough ============= */

  if (view === "create") {
    return (
      <CreateExam
        onBack={() => setView("list")}
        onCreated={(newExam) => {
          const normalized = normalizeExam(newExam);
          if (!normalized?.examid) return;
          setExams((previous) =>
            previous.some((item) => item.examid === normalized.examid)
              ? previous.map((item) =>
                  item.examid === normalized.examid ? normalized : item,
                )
              : [normalized, ...previous],
          );
          setSelectedExam(normalized);
          setView("assign");
        }}
      />
    );
  }

  if (view === "assign") {
    return (
      <AssignCandidates
        exam={selectedExam}
        onBack={() => {
          setSelectedExam(null);
          setView("list");
        }}
      />
    );
  }

  /* ============= LIST VIEW ============= */

  if (view === "list") {
    const hour = clock.getHours();
    const greeting =
      hour < 5
        ? "Good night"
        : hour < 12
          ? "Good morning"
          : hour < 17
            ? "Good afternoon"
            : hour < 21
              ? "Good evening"
              : "Good night";
    const timeText = clock.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const dateText = clock.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

    const total = exams.length;
    const running = exams.filter(
      (e) => String(e.status).toUpperCase() === "RUNNING",
    ).length;
    const published = exams.filter(
      (e) => String(e.status).toUpperCase() === "PUBLISHED",
    ).length;
    const draft = exams.filter(
      (e) => String(e.status).toUpperCase() === "DRAFT",
    ).length;
    const completed = exams.filter((e) => {
      const s = String(e.status).toUpperCase();
      return s === "COMPLETED" || s === "TERMINATED";
    }).length;
    const activeCountExams = total - completed;

    const statusChips = [
      {
        key: "active",
        label: "Active",
        count: activeCountExams,
        color: t.accent,
      },
      { key: "running", label: "Running", count: running, color: t.success },
      { key: "published", label: "Published", count: published, color: t.info },
      //    { key: "draft", label: "Draft", count: draft, color: t.textMuted },
      {
        key: "completed",
        label: "Completed",
        count: completed,
        color: t.textSecondary,
      },
      { key: "all", label: "All", count: total, color: t.accent2 },
    ];

    const matchesStatusFilter = (e) => {
      const s = String(e.status).toUpperCase();
      const isCompleted = s === "COMPLETED" || s === "TERMINATED";
      switch (statusFilter) {
        case "all":
          return true;
        case "active":
          return !isCompleted;
        case "running":
          return s === "RUNNING";
        case "published":
          return s === "PUBLISHED";
        case "draft":
          return s === "DRAFT";
        case "completed":
          return isCompleted;
        default:
          return true;
      }
    };

    const filteredExams = exams.filter((e) => {
      if (!matchesStatusFilter(e)) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [e.name, e.status, e.date, e.starttime, e.endtime]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase())
        .join(" ")
        .includes(q);
    });

    return (
      <div
        style={{
          minHeight: "100vh",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          background: t.canvas,
          backgroundImage: t.canvasTint,
          overflow: "hidden",
          color: t.textPrimary,
          fontFamily:
            "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          transition: "background 0.7s ease, color 0.6s ease",
          position: "relative",
        }}
      >
        <GlobalStyles theme={theme} />
        <div
          style={{
            position: "absolute",
            top: "-10%",
            left: "-10%",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${t.accent}22 0%, transparent 65%)`,
            filter: "blur(40px)",
            animation: "floatBlob 22s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-15%",
            right: "-10%",
            width: 620,
            height: 620,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${t.accent3}18 0%, transparent 65%)`,
            filter: "blur(50px)",
            animation: "floatBlob 28s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />

        <header
          style={{
            height: 68,
            padding: "0 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            borderBottom: `1px solid ${t.border}`,
            background: t.surface,
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            position: "relative",
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                lineHeight: 1.15,
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 16,
                  color: t.textPrimary,
                  fontFamily: "'Space Grotesk', sans-serif",
                  letterSpacing: -0.3,
                }}
              >
                3rdEyeZ360
              </span>
              <span
                style={{
                  fontSize: 9,
                  color: t.textMuted,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                {user?.role || "Examiner"} Workspace
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {user?.name && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "5px 14px 5px 5px",
                  borderRadius: 999,
                  background: t.surfaceGlass,
                  border: `1px solid ${t.border}`,
                }}
              >
                <div
                  className="avatar-gradient"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {String(user.name).charAt(0).toUpperCase()}
                </div>
                <span
                  style={{
                    fontSize: 13,
                    color: t.textPrimary,
                    fontWeight: 600,
                  }}
                >
                  {user.name}
                </span>
              </div>
            )}
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <IconMorphButton
              theme={theme}
              refreshing={false}
              loading={loadingExams}
              onClick={() => setRefreshTick((v) => v + 1)}
            />
            <LogoutButton theme={theme} />
            <GradientButton
              theme={theme}
              onClick={() => setView("create")}
              style={{ padding: "10px 18px" }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create Exam
            </GradientButton>
          </div>
        </header>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "32px 32px 40px",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ maxWidth: 1440, margin: "0 auto" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
                gap: 24,
                marginBottom: 32,
                animation: "cardEnter 0.5s ease",
              }}
            >
              <div
                style={{
                  background: t.cardSurface,
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                  border: `1px solid ${t.border}`,
                  borderRadius: 24,
                  padding: "32px 34px",
                  position: "relative",
                  overflow: "hidden",
                  boxShadow:
                    t.name === "light"
                      ? "0 8px 30px rgba(20,28,60,0.08)"
                      : "none",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: -80,
                    right: -80,
                    width: 260,
                    height: 260,
                    borderRadius: "50%",
                    background: t.accentGradient,
                    opacity: t.name === "light" ? 0.18 : 0.14,
                    filter: "blur(60px)",
                    animation: "floatBlob 18s ease-in-out infinite",
                  }}
                />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: t.textMuted,
                      letterSpacing: 1.4,
                      textTransform: "uppercase",
                      fontWeight: 700,
                      marginBottom: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: 24,
                        height: 1,
                        background: t.accentGradient,
                      }}
                    />
                    {dateText}
                  </div>
                  <h1
                    style={{
                      fontSize: 34,
                      fontWeight: 700,
                      margin: 0,
                      marginBottom: 10,
                      color: t.textPrimary,
                      fontFamily: "'Space Grotesk', sans-serif",
                      letterSpacing: -1,
                      lineHeight: 1.15,
                    }}
                  >
                    {greeting}
                    {user?.name ? (
                      <span className="gradient-text">
                        , {user.name.split(" ")[0]}
                      </span>
                    ) : null}
                  </h1>
                  <p
                    style={{
                      fontSize: 14.5,
                      color: t.textSecondary,
                      margin: 0,
                      lineHeight: 1.65,
                      maxWidth: 560,
                    }}
                  >
                    Create and monitor your exams, review candidate live-status,
                    and handle re-entry requests — all from one place.
                  </p>
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      marginTop: 22,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 14px",
                        borderRadius: 999,
                        background: t.surfaceGlass,
                        border: `1px solid ${t.border}`,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: t.success,
                          boxShadow: `0 0 6px ${t.success}`,
                          animation: "pulseDot 1.5s ease-in-out infinite",
                        }}
                      />
                      <span
                        style={{
                          fontSize: 12,
                          color: t.textSecondary,
                          fontWeight: 600,
                        }}
                      >
                        Live monitoring active
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 14px",
                        borderRadius: 999,
                        background: t.surfaceGlass,
                        border: `1px solid ${t.border}`,
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={t.textMuted}
                        strokeWidth="2.2"
                      >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      <span
                        style={{
                          fontSize: 12,
                          color: t.textSecondary,
                          fontWeight: 600,
                        }}
                      >
                        Secured proctoring
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div
                style={{
                  background: t.cardSurface,
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                  border: `1px solid ${t.border}`,
                  borderRadius: 24,
                  padding: 28,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  textAlign: "center",
                  position: "relative",
                  overflow: "hidden",
                  boxShadow:
                    t.name === "light"
                      ? "0 8px 30px rgba(20,28,60,0.08)"
                      : "none",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: t.accentGradientSoft,
                    opacity: 0.7,
                  }}
                />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div
                    style={{
                      fontSize: 9,
                      color: t.textMuted,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      fontWeight: 700,
                      marginBottom: 8,
                    }}
                  >
                    Local Time
                  </div>
                  <div
                    className="clock-gradient"
                    style={{
                      fontSize: 52,
                      fontWeight: 700,
                      fontFamily: "'Space Grotesk', sans-serif",
                      letterSpacing: -2,
                    }}
                  >
                    {timeText}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: t.textSecondary,
                      marginTop: 8,
                      fontWeight: 500,
                      letterSpacing: 0.3,
                    }}
                  >
                    {clock.toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 16,
                marginBottom: 24,
                animation: "cardEnter 0.55s ease",
              }}
            >
              <StatOrb
                theme={theme}
                label="Total Exams"
                value={total}
                total={Math.max(total, 1)}
                color={t.accent}
                gradient={t.accentGradient}
                icon={
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                  >
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                    <path d="M9 10h6M9 14h4" />
                  </svg>
                }
              />
              <StatOrb
                theme={theme}
                label="Running"
                value={running}
                total={Math.max(total, 1)}
                color={t.success}
                gradient={t.successGradient}
                icon={
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                }
              />
              <StatOrb
                theme={theme}
                label="Published"
                value={published}
                total={Math.max(total, 1)}
                color={t.info}
                gradient={`linear-gradient(135deg, ${t.info}, ${t.accent2})`}
                icon={
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                }
              />
              <StatOrb
                theme={theme}
                label="Completed"
                value={completed}
                total={Math.max(total, 1)}
                color={t.textSecondary}
                gradient={`linear-gradient(135deg, ${t.textSecondary}, ${t.textMuted})`}
                icon={
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                }
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: t.textPrimary,
                    margin: 0,
                    fontFamily: "'Space Grotesk', sans-serif",
                    letterSpacing: -0.4,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  Your Exams
                  <span
                    style={{
                      fontSize: 12,
                      color: t.textMuted,
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: 999,
                      background: t.surfaceGlass,
                      border: `1px solid ${t.border}`,
                    }}
                  >
                    {filteredExams.length}
                    {filteredExams.length !== total ? ` of ${total}` : ""}
                  </span>
                </h3>
                <p
                  style={{
                    fontSize: 12.5,
                    color: t.textMuted,
                    margin: "4px 0 0",
                    letterSpacing: 0.2,
                  }}
                >
                  Create, monitor, and manage your assessments.
                </p>
              </div>
            </div>

            <div
              style={{
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  position: "relative",
                  flex: "1 1 300px",
                  maxWidth: 420,
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={searchFocused ? t.accent : t.textMuted}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    transition: "stroke 0.25s ease",
                    pointerEvents: "none",
                  }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Search exams by name, status or date..."
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "11px 14px 11px 40px",
                    fontSize: 13.5,
                    color: t.textPrimary,
                    background: t.inputBg,
                    border: `1px solid ${searchFocused ? t.accent : t.border}`,
                    borderRadius: 12,
                    outline: "none",
                    fontFamily: "'Inter', sans-serif",
                    boxShadow: searchFocused
                      ? `0 0 0 3px ${t.accentSoft}`
                      : "none",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                {statusChips.map((c) => {
                  const active = statusFilter === c.key;
                  return (
                    <button
                      key={c.key}
                      onClick={() => setStatusFilter(c.key)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7,
                        padding: "8px 13px",
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: 0.3,
                        borderRadius: 999,
                        border: `1px solid ${active ? "transparent" : t.border}`,
                        background: active
                          ? `linear-gradient(135deg, ${c.color} 0%, ${c.color}cc 100%)`
                          : t.surfaceGlass,
                        color: active ? "#ffffff" : t.textSecondary,
                        cursor: "pointer",
                        fontFamily: "'Inter', sans-serif",
                        boxShadow: active ? `0 4px 12px ${c.color}55` : "none",
                        transition: "all 0.25s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!active)
                          e.currentTarget.style.background =
                            t.surfaceGlassHover;
                      }}
                      onMouseLeave={(e) => {
                        if (!active)
                          e.currentTarget.style.background = t.surfaceGlass;
                      }}
                    >
                      {c.label}
                      <span
                        style={{
                          fontSize: 9,
                          padding: "1px 7px",
                          borderRadius: 999,
                          background: active
                            ? "rgba(255,255,255,0.28)"
                            : t.surfaceGlassHover,
                          color: active ? "#ffffff" : t.textMuted,
                          fontWeight: 800,
                          minWidth: 18,
                          textAlign: "center",
                        }}
                      >
                        {c.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {loadingExams ? (
              <div
                style={{
                  textAlign: "center",
                  color: t.textMuted,
                  padding: 60,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    border: `3px solid ${t.border}`,
                    borderTopColor: t.accent,
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                Loading exams...
              </div>
            ) : filteredExams.length === 0 ? (
              <div
                style={{
                  background: t.cardSurface,
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  border: `1px dashed ${t.borderStrong}`,
                  borderRadius: 20,
                  padding: "56px 24px",
                  color: t.textMuted,
                  fontSize: 14,
                  textAlign: "center",
                  animation: "fadeIn 0.3s ease",
                }}
              >
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: "50%",
                    background: t.accentGradientSoft,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                    border: `1px solid ${t.border}`,
                  }}
                >
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={t.accent}
                    strokeWidth="1.8"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div
                  style={{
                    color: t.textPrimary,
                    fontWeight: 700,
                    marginBottom: 4,
                    fontSize: 16,
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  {search
                    ? "No matching exams"
                    : statusFilter === "completed"
                      ? "No completed exams yet"
                      : statusFilter !== "active" && statusFilter !== "all"
                        ? `No ${statusFilter} exams`
                        : total === 0
                          ? "No exams yet"
                          : "Nothing here right now"}
                </div>
                <div>
                  {search
                    ? "Try a different search term."
                    : statusFilter !== "active" &&
                        statusFilter !== "all" &&
                        total > 0
                      ? "Switch to another filter to see your other exams."
                      : "Create your first exam to get started."}
                </div>
                {!search && total === 0 && (
                  <div style={{ marginTop: 16 }}>
                    <GradientButton
                      theme={theme}
                      onClick={() => setView("create")}
                      style={{ padding: "10px 24px", fontSize: 14 }}
                    >
                      Create your first exam
                    </GradientButton>
                  </div>
                )}
                {!search && total > 0 && statusFilter !== "active" && (
                  <div style={{ marginTop: 16 }}>
                    <GhostButton
                      theme={theme}
                      onClick={() => setStatusFilter("active")}
                      style={{ padding: "9px 18px", justifyContent: "center" }}
                    >
                      Back to active exams
                    </GhostButton>
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                  gap: 20,
                  alignItems: "start",
                }}
              >
                {filteredExams.map((exam, i) => (
                  <ExamCard
                    key={exam.examid}
                    exam={exam}
                    index={i}
                    theme={theme}
                    onMonitor={openMonitor}
                    pendingRequestCount={
                      pendingRequestCountsByExam[String(exam.examid)] || 0
                    }
                    onOpenRequests={(requestedExam) => {
                      openMonitor(requestedExam);
                      setMonitorTab("requests");
                    }}
                    onAssign={(ex) => {
                      setSelectedExam(ex);
                      setView("assign");
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ============= MONITOR VIEW (redesigned) ============= */

  if (view === "monitor") {
    const activeCount = candidates.filter(
      (c) => String(c.status).toUpperCase() === "ACTIVE",
    ).length;
    const interruptedCount = candidates.filter(
      (c) => String(c.status).toUpperCase() === "INTERRUPTED",
    ).length;
    const lockedCount = candidates.filter(
      (c) => String(c.status).toUpperCase() === "LOCKED",
    ).length;
    const avgCredibility =
      candidates.length > 0
        ? Math.round(
            candidates.reduce(
              (sum, c) => sum + Number(c.credibilityscore || 0),
              0,
            ) / candidates.length,
          )
        : 0;

    const qq = candidateSearch.trim().toLowerCase();
    const filteredCandidates = qq
      ? candidates.filter((c) =>
          [c.candidatename, c.candidateid, c.status]
            .filter(Boolean)
            .map((v) => String(v).toLowerCase())
            .join(" ")
            .includes(qq),
        )
      : candidates;

    const reasonMeta =
      reasonModal?.action === "terminate"
        ? {
            title: "Terminate assessment",
            label: "Terminate",
            gradient: t.dangerGradient,
            glow: t.glowDanger,
          }
        : reasonModal?.action === "pause"
          ? {
              title: "Pause assessment",
              label: "Pause",
              gradient: t.warningGradient,
              glow: t.glowWarning,
            }
          : {
              title: "Resume assessment",
              label: "Resume",
              gradient: t.successGradient,
              glow: t.glowSuccess,
            };

    const selectedAssessmentStatus = normalizeStatusKey(selectedCandidate?.status);
    const selectedAssessmentFinalized = ["TERMINATED", "COMPLETED", "LOCKED"].includes(
      selectedAssessmentStatus,
    );
    const canPauseSelected = selectedAssessmentStatus === "ACTIVE";
    const canResumeSelected = selectedAssessmentStatus === "PAUSED";
    const canTerminateSelected = Boolean(selectedCandidate) && !selectedAssessmentFinalized;
    return (
      <div
        style={{
          height: "calc(100vh - 50px)",
          maxHeight: "calc(100vh - 50px)",
          display: "flex",
          flexDirection: "column",
          background: t.canvas,
          backgroundImage: t.canvasTint,
          color: t.textPrimary,
          fontFamily:
            "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          transition: "background 0.7s ease, color 0.6s ease",
          overflow: "hidden",
        }}
      >
        <GlobalStyles theme={theme} />

        {/* Control bar */}
        <div
          style={{
            minHeight: 62,
            background: t.surface,
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderBottom: `1px solid ${t.border}`,
            display: "flex",
            alignItems: "center",
            padding: "10px 20px",
            gap: 12,
            flexShrink: 0,
            flexWrap: "wrap",
          }}
        >
          <GhostButton
            theme={theme}
            onClick={goBack}
            style={{ padding: "8px 14px" }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back
          </GhostButton>

          <div
            style={{ display: "flex", flexDirection: "column", minWidth: 0 }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: 15.5,
                color: t.textPrimary,
                fontFamily: "'Space Grotesk', sans-serif",
                letterSpacing: -0.3,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 260,
              }}
            >
              {selectedExam?.name}
            </span>
            <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>
              {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}{" "}
              · Live monitor
            </span>
          </div>
          <StatusPill status={selectedExam?.status} theme={theme} />
          {actionMsg && (
            <span style={{ fontSize: 12, color: t.success, fontWeight: 700 }}>
              {actionMsg}
            </span>
          )}

          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <ThemeToggle theme={theme} onToggle={toggleTheme} />

            {canStartExam ? (
              <GradientButton theme={theme} onClick={startExam} disabled={startingExam} gradient={t.successGradient} glow={t.glowSuccess}>
                {startingExam ? "Starting..." : isMultiSessionExam && isExamCompleted ? "Start Next Session" : isMultiSessionExam ? "Start First Session" : "Start Exam"}
              </GradientButton>
            ) : isExamRunning ? (
              <GradientButton theme={theme} disabled gradient={t.successGradient}>Running</GradientButton>
            ) : null}
            {isExamRunning ? (
              <GradientButton theme={theme} onClick={() => setConfirmEndOpen(true)} disabled={endingExam} gradient={t.warningGradient} glow={t.glowWarning}>
                {endingExam ? "Ending..." : isMultiSessionExam ? "End Current Session" : "End Exam"}
              </GradientButton>
            ) : null}
            {isMultiSessionExam && !isExamStopped ? (
              <GradientButton theme={theme} onClick={() => setConfirmStopOpen(true)} disabled={stoppingExam} gradient={t.dangerGradient} glow={t.glowDanger}>
                {stoppingExam ? "Stopping..." : "Stop Exam"}
              </GradientButton>
            ) : null}
            <GhostButton
              theme={theme}
              onClick={() => {
                setSelectedExam(selectedExam);
                setView("assign");
              }}
            >
              Assign
            </GhostButton>
            <GhostButton
              theme={theme}
              onClick={() => {
                loadExamById(selectedExamId);
                loadCandidates(selectedExamId);
                loadReentryRequests(selectedExamId);
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Refresh
            </GhostButton>
            <LogoutButton theme={theme} />
          </div>
        </div>

        {/* Tabs + broadcast */}
        <div
          style={{
            minHeight: 52,
            background: t.surface,
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderBottom: `1px solid ${t.border}`,
            display: "flex",
            alignItems: "center",
            padding: "8px 20px",
            gap: 10,
            flexShrink: 0,
            flexWrap: "wrap",
          }}
        >
          <MonitorTabButton
            theme={theme}
            active={monitorTab === "grid"}
            label="Live Grid"
            onClick={() => setMonitorTab("grid")}
            icon={
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
            }
          />
          <MonitorTabButton
            theme={theme}
            active={monitorTab === "requests"}
            label="Requests"
            count={pendingRequestsCount}
            onClick={() => setMonitorTab("requests")}
            icon={
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            }
          />
        </div>

        {monitorTab === "requests" ? (
          <div
            style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 20 }}
          >
            {reentryRequests.length === 0 ? (
              <div
                style={{
                  color: t.textMuted,
                  textAlign: "center",
                  padding: "60px 0",
                  fontSize: 14,
                }}
              >
                No pending requests.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  width: "min(900px, 100%)",
                  margin: 0,
                }}
              >
                {reentryRequests.map((req) => {
                  const meta = requestStatusMeta(req.status, t);
                  return (
                    <div
                      key={req.requestid}
                      style={{
                        background: t.cardSurface,
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                        border: `1px solid ${t.border}`,
                        borderRadius: 16,
                        padding: 18,
                        boxShadow:
                          t.name === "light"
                            ? "0 6px 20px rgba(20,28,60,0.07)"
                            : "none",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          marginBottom: 8,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 15,
                            color: t.textPrimary,
                            fontFamily: "'Space Grotesk', sans-serif",
                          }}
                        >
                          {requestTypeLabel(req.type)} Request
                        </div>
                        <span
                          style={{
                            background: meta.gradient,
                            color: "#fff",
                            padding: "4px 11px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                            boxShadow: `0 4px 12px ${meta.color}44`,
                          }}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: t.textMuted,
                          marginBottom: 10,
                        }}
                      >
                        {req.candidatename ? `${req.candidatename} • ` : ""}
                        Candidate {req.candidateid} • Assessment{" "}
                        {req.assessmentid}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: t.textSecondary,
                          marginBottom: 12,
                          lineHeight: 1.6,
                        }}
                      >
                        {req.reason || "No reason provided"}
                      </div>
                      {req.createdat && (
                        <div
                          style={{
                            fontSize: 11,
                            color: t.textMuted,
                            marginBottom: 8,
                          }}
                        >
                          Requested at{" "}
                          {new Date(req.createdat).toLocaleString()}
                        </div>
                      )}
                      {req.reviewedat && req.status !== "PENDING" && (
                        <div
                          style={{
                            fontSize: 11,
                            color: t.textMuted,
                            marginBottom: 8,
                          }}
                        >
                          Reviewed at{" "}
                          {new Date(req.reviewedat).toLocaleString()}
                        </div>
                      )}
                      {req.reviewreason && req.status !== "PENDING" && (
                        <div
                          style={{
                            fontSize: 12,
                            color: t.textSecondary,
                            marginBottom: 12,
                          }}
                        >
                          Review reason: {req.reviewreason}
                        </div>
                      )}
                      {req.status === "PENDING" ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <GradientButton
                            theme={theme}
                            onClick={() => handleReentryReview(req, true)}
                            disabled={reviewingRequestId === req.requestid}
                            gradient={t.successGradient}
                            glow={t.glowSuccess}
                            style={{ padding: "8px 16px" }}
                          >
                            {reviewingRequestId === req.requestid
                              ? "Working..."
                              : "Approve"}
                          </GradientButton>
                          <GradientButton
                            theme={theme}
                            onClick={() => handleReentryReview(req, false)}
                            disabled={reviewingRequestId === req.requestid}
                            gradient={t.dangerGradient}
                            glow={t.glowDanger}
                            style={{ padding: "8px 16px" }}
                          >
                            {reviewingRequestId === req.requestid
                              ? "Working..."
                              : "Reject"}
                          </GradientButton>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              overflow: "hidden",
            }}
          >
            {/* LEFT: candidate grid + search */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ padding: "14px 20px 10px", flexShrink: 0 }}>
                <div style={{ position: "relative", maxWidth: 380 }}>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={t.textMuted}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      position: "absolute",
                      left: 13,
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                    }}
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    value={candidateSearch}
                    onChange={(e) => setCandidateSearch(e.target.value)}
                    placeholder="Search candidates by name, ID or status..."
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 12px 10px 38px",
                      fontSize: 13,
                      background: t.inputBg,
                      border: `1px solid ${t.border}`,
                      borderRadius: 11,
                      color: t.textPrimary,
                      outline: "none",
                      fontFamily: "'Inter', sans-serif",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = t.accent;
                      e.target.style.boxShadow = `0 0 0 3px ${t.accentSoft}`;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = t.border;
                      e.target.style.boxShadow = "none";
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  overflowX: "visible",
                  padding: "20px 34px 24px 20px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
                  gap: 18,
                  alignContent: "start",
                }}
              >
                {candidates.length === 0 ? (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      textAlign: "center",
                      color: t.textMuted,
                      padding: "60px 0",
                      fontSize: 13.5,
                    }}
                  >
                    No candidates assigned yet.{" "}
                    <span
                      onClick={() => setView("assign")}
                      style={{
                        color: t.accent,
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      Assign candidates
                    </span>
                  </div>
                ) : filteredCandidates.length === 0 ? (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      textAlign: "center",
                      color: t.textMuted,
                      padding: "50px 0",
                      fontSize: 13.5,
                    }}
                  >
                    No candidates match your search.
                  </div>
                ) : (
                  filteredCandidates.map((c) => (
                    <CandidateTile
                      key={c.candidateid}
                      c={c}
                      stream={candidateCameraStreams[String(c.candidateid)]}
                      connectionState={
                        candidateCameraStates[String(c.candidateid)]
                      }
                      isActive={
                        c.candidateid === selectedCandidate?.candidateid
                      }
                      unreadCount={
                        unreadPrivateMessages[String(c.candidateid)] || 0
                      }
                      onClick={() => {
                        setSelectedCandidate(c);
                        loadViolations(c.candidateid, selectedExamId);
                        requestCandidateCamera(c.candidateid, c.assessmentid);
                      }}
                      theme={theme}
                    />
                  ))
                )}
              </div>
            </div>

            {/* RIGHT: detail panel — proper size + scrolling */}
            <div
              style={{
                width: 420,
                maxWidth: "38vw",
                minWidth: 380,
                flexShrink: 0,
                borderLeft: `1px solid ${t.border}`,
                background: t.panelBg,
                display: "flex",
                flexDirection: "column",
                height: "100%",
                minHeight: 0,
                overflow: "hidden",
                boxSizing: "border-box",
                transition: "background 0.55s ease, border-color 0.5s ease",
              }}
            >
              {!selectedCandidate ? (
                <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                  <ChatWindow
                    examId={selectedExamId}
                    currentUser={user}
                    conversationType="GENERAL"
                    allowConversationSwitch={false}
                    title="Common chat"
                    embedded
                    theme={t}
                  />
                </div>
              ) : chatOpen ? (
                <>
                  <button
                    type="button"
                    onClick={() => setChatOpen(false)}
                    style={{
                      height: 52,
                      minHeight: 52,
                      width: "100%",
                      padding: "0 18px",
                      border: "none",
                      borderBottom: `1px solid ${t.border}`,
                      background: t.surfaceGlass,
                      color: t.textSecondary,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      flex: "0 0 52px",
                      boxSizing: "border-box",
                      position: "relative",
                      zIndex: 5,
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 11,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                      }}
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="19" y1="12" x2="5" y2="12" />
                        <polyline points="12 19 5 12 12 5" />
                      </svg>
                      Candidate details
                    </span>

                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  <div style={{ flex: "1 1 0", height: 0, minHeight: 0, overflow: "hidden", boxSizing: "border-box" }}>
                    <ChatWindow
                      examId={selectedExamId}
                      assessmentId={selectedCandidate.assessmentid}
                      candidateId={selectedCandidate.candidateid}
                      currentUser={user}
                      selectedUserName={selectedCandidate.candidatename}
                      conversationType="PRIVATE"
                      embedded
                      theme={t}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* FIXED HEADER */}
                  <div
                    style={{
                      padding: "18px 20px 16px",
                      borderBottom: `1px solid ${t.border}`,
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        marginBottom: 14,
                      }}
                    >
                      <div
                        className="avatar-gradient"
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 13,
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 17,
                          fontWeight: 800,
                          flexShrink: 0,
                          fontFamily: "'Space Grotesk', sans-serif",
                        }}
                      >
                        {String(selectedCandidate.candidatename || "C")
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: 17,
                            fontWeight: 700,
                            color: t.textPrimary,
                            fontFamily: "'Space Grotesk', sans-serif",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {selectedCandidate.candidatename}
                        </div>
                        <div
                          style={{
                            marginTop: 3,
                            fontSize: 11,
                            color: t.textMuted,
                            fontFamily: "'JetBrains Mono', monospace",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {selectedCandidate.candidateid}
                        </div>
                      </div>
                      <span
                        style={{
                          padding: "4px 12px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 800,
                          color: statusColor(selectedCandidate.status, t),
                          background: `${statusColor(selectedCandidate.status, t)}18`,
                          border: `1px solid ${statusColor(selectedCandidate.status, t)}55`,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatStatus(selectedCandidate.status)}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                        gap: 8,
                      }}
                    >
                      {[
                        ["Warnings", selectedCandidate.warningcount, t.warning],
                        [
                          "Violations",
                          selectedCandidate.violationcount,
                          t.danger,
                        ],
                        [
                          "Credibility",
                          `${selectedCandidate.credibilityscore}%`,
                          t.accent,
                        ],
                      ].map(([label, value, color]) => (
                        <div
                          key={label}
                          style={{
                            minWidth: 0,
                            padding: "11px 6px",
                            borderRadius: 11,
                            background: t.surfaceGlass,
                            border: `1px solid ${t.border}`,
                            textAlign: "center",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 8.5,
                              color: t.textMuted,
                              fontWeight: 800,
                              letterSpacing: 0.4,
                              textTransform: "uppercase",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {label}
                          </div>
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 19,
                              color,
                              fontWeight: 800,
                              fontFamily: "'Space Grotesk', sans-serif",
                            }}
                          >
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                        gap: 8,
                        marginTop: 12,
                      }}
                    >
                      <GhostButton
                        theme={theme}
                        disabled={!canPauseSelected}
                        onClick={() =>
                          requestAction(selectedCandidate.assessmentid, "pause")
                        }
                        style={{ padding: "9px 6px", justifyContent: "center" }}
                      >
                        Pause
                      </GhostButton>
                      <GradientButton
                        theme={theme}
                        disabled={!canResumeSelected}
                        onClick={() =>
                          requestAction(
                            selectedCandidate.assessmentid,
                            "resume",
                          )
                        }
                        gradient={t.successGradient}
                        glow={t.glowSuccess}
                        style={{ padding: "9px 6px", width: "100%" }}
                      >
                        Resume
                      </GradientButton>
                      <GradientButton
                        theme={theme}
                        disabled={!canTerminateSelected}
                        onClick={() =>
                          requestAction(
                            selectedCandidate.assessmentid,
                            "terminate",
                          )
                        }
                        gradient={t.dangerGradient}
                        glow={t.glowDanger}
                        style={{ padding: "9px 6px", width: "100%" }}
                      >
                        Terminate
                      </GradientButton>
                    </div>
                  </div>

                  {/* SCROLLABLE MIDDLE: live data + violations. */}
                  <div
                    style={{
                      flex: "1 1 auto",
                      height: 0,
                      minHeight: 0,
                      overflowY: "auto",
                      overflowX: "hidden",
                      padding: "16px 20px 20px",
                      boxSizing: "border-box",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: t.textPrimary,
                          textTransform: "uppercase",
                          letterSpacing: 0.7,
                        }}
                      >
                        Latest Live Data
                      </div>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 9,
                          fontWeight: 700,
                          color: liveData[selectedCandidate.candidateid]
                            ? t.success
                            : t.textMuted,
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: liveData[selectedCandidate.candidateid]
                              ? t.success
                              : t.textFaint,
                            boxShadow: liveData[selectedCandidate.candidateid]
                              ? `0 0 7px ${t.success}`
                              : "none",
                            animation: liveData[selectedCandidate.candidateid]
                              ? "pulseDot 1.5s ease-in-out infinite"
                              : "none",
                          }}
                        />
                        {liveData[selectedCandidate.candidateid]
                          ? "Streaming"
                          : "No signal"}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 10,
                        marginBottom: 22,
                      }}
                    >
                      {[
                        [
                          "Status",
                          liveData[selectedCandidate.candidateid]?.status
                            ? formatStatus(
                                liveData[selectedCandidate.candidateid].status,
                              )
                            : "—",
                        ],
                        [
                          "Focus",
                          liveData[selectedCandidate.candidateid]?.focus ?? "—",
                        ],
                        [
                          "Noise",
                          liveData[selectedCandidate.candidateid]
                            ?.noise_level ?? "—",
                        ],
                        [
                          "Face Count",
                          liveData[selectedCandidate.candidateid]?.face_count ??
                            "—",
                        ],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          style={{
                            minWidth: 0,
                            padding: "12px 13px",
                            background: t.surfaceGlass,
                            border: `1px solid ${t.border}`,
                            borderRadius: 12,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 9,
                              color: t.textMuted,
                              fontWeight: 800,
                              letterSpacing: 0.5,
                              textTransform: "uppercase",
                            }}
                          >
                            {label}
                          </div>
                          <div
                            title={String(value)}
                            style={{
                              marginTop: 6,
                              color: t.textPrimary,
                              fontSize: 15,
                              fontWeight: 700,
                              fontFamily: "'Space Grotesk', sans-serif",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: t.textPrimary,
                          textTransform: "uppercase",
                          letterSpacing: 0.7,
                        }}
                      >
                        Violations
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: t.danger,
                          background: t.dangerBg,
                          borderRadius: 999,
                          padding: "2px 9px",
                        }}
                      >
                        {violations.length}
                      </span>
                    </div>
                    {violations.length === 0 ? (
                      <div
                        style={{
                          color: t.textMuted,
                          fontSize: 12.5,
                          padding: "18px 0",
                          textAlign: "center",
                          background: t.surfaceGlass,
                          borderRadius: 12,
                          border: `1px dashed ${t.border}`,
                        }}
                      >
                        No violations recorded.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 10 }}>
                        {violations.map((v, idx) => (
                          <div
                            key={v.violation_id ?? v.id ?? idx}
                            style={{
                              background: t.surfaceGlass,
                              border: `1px solid ${t.border}`,
                              borderRadius: 12,
                              padding: 13,
                              position: "relative",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                bottom: 0,
                                width: 3,
                                background: t.warning,
                              }}
                            />
                            <div
                              style={{
                                fontSize: 12.5,
                                fontWeight: 700,
                                color: t.warning,
                                marginBottom: 6,
                              }}
                            >
                              {v.type ?? v.violation_type ?? "Violation"}
                            </div>
                            <div
                              style={{
                                fontSize: 12.5,
                                color: t.textSecondary,
                                marginBottom: 6,
                                lineHeight: 1.5,
                              }}
                            >
                              {v.message ?? v.description ?? "No description"}
                            </div>
                            <div style={{ fontSize: 11, color: t.textMuted }}>
                              {v.timestamp
                                ? new Date(v.timestamp).toLocaleString()
                                : "Time unavailable"}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Expand chat into the complete right-side panel. */}
                  <button
                    type="button"
                    onClick={() => setChatOpen(true)}
                    style={{
                      minHeight: 48,
                      width: "100%",
                      padding: "0 20px",
                      border: "none",
                      borderTop: `1px solid ${t.border}`,
                      background: t.surfaceGlass,
                      color: t.textSecondary,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      flexShrink: 0,
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 11,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                      </svg>
                      Chat
                    </span>

                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* End-exam confirmation */}
        <ConfirmModal
          open={confirmEndOpen}
          theme={theme}
          danger
          title={isMultiSessionExam ? "End current session?" : "End this exam?"}
          message={isMultiSessionExam ? "Candidates who entered this session will be finalized. Candidates who did not enter can attend a later session." : "This will close the exam for every candidate. Any active or paused sessions will be ended and cannot be resumed."}
          confirmLabel={isMultiSessionExam ? "Yes, end session" : "Yes, end exam"}
          cancelLabel="No, keep running"
          working={endingExam}
          onCancel={() => setConfirmEndOpen(false)}
          onConfirm={performEndExam}
        />

        <ConfirmModal
          open={confirmStopOpen}
          theme={theme}
          danger
          title="Stop this multi-session exam permanently?"
          message="This permanently closes the exam. Candidates who have not attended will lose access, and the exam cannot be started again."
          confirmLabel="Yes, stop permanently"
          cancelLabel="Cancel"
          working={stoppingExam}
          onCancel={() => setConfirmStopOpen(false)}
          onConfirm={performStopExam}
        />
        {/* Action reason modal */}
        <ReasonModal
          open={!!reasonModal}
          theme={theme}
          title={reasonMeta.title}
          actionLabel={reasonMeta.label}
          actionGradient={reasonMeta.gradient}
          actionGlow={reasonMeta.glow}
          reason={reasonText}
          onChange={setReasonText}
          onCancel={() => {
            if (!reasonWorking) {
              setReasonModal(null);
              setReasonText("");
            }
          }}
          onConfirm={performAction}
          working={reasonWorking}
        />

        {/* Themed request rejection modal */}
        <RequestRejectionModal
          open={!!requestRejectionModal}
          theme={theme}
          request={requestRejectionModal}
          reason={requestRejectionReason}
          onChange={setRequestRejectionReason}
          working={
            reviewingRequestId === requestRejectionModal?.requestid
          }
          onCancel={() => {
            if (!reviewingRequestId) {
              setRequestRejectionModal(null);
              setRequestRejectionReason("");
            }
          }}
          onConfirm={() =>
            handleReentryReview(
              requestRejectionModal,
              false,
              requestRejectionReason,
            )
          }
        />

        {/* Start / End transition overlay */}
        <TransitionOverlay
          open={!!transition}
          theme={theme}
          variant={transition?.variant}
          title={transition?.title}
          subtitle={transition?.subtitle}
        />
      </div>
    );
  }

  return null;
}
