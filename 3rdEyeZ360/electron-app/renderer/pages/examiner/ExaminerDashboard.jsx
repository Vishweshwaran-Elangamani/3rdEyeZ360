import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import axios from "axios";
import useAuthStore from "../../store/authStore";
import { useSocket } from "../../hooks/useSocket";
import ChatWindow from "../../components/common/ChatWindow";
import CreateExam from "./CreateExam";
import AssignCandidates from "./AssignCandidates";

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
    // brighter, whiter text
    textPrimary: "#ffffff",
    textSecondary: "#d5daea",
    textMuted: "#98a0ba",
    textFaint: "#6b7286",
    accent: "#5b8cff",
    accent2: "#a065ff",
    accent3: "#ff6ec7",
    accentGradient: "linear-gradient(135deg, #5b8cff 0%, #a065ff 50%, #ff6ec7 100%)",
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
    glowAccent: "0 8px 32px rgba(91,140,255,0.28), 0 0 60px rgba(160,101,255,0.15)",
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
    accentGradient: "linear-gradient(135deg, #4b60e8 0%, #7c3aed 50%, #e94aa8 100%)",
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
    glowAccent: "0 12px 40px rgba(75,96,232,0.25), 0 0 60px rgba(124,58,237,0.15)",
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
      if (e.key === THEME_STORAGE_KEY && (e.newValue === "light" || e.newValue === "dark")) {
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
  return String(status ?? "").trim().toUpperCase().replace(/[\s_-]+/g, "");
}

function formatStatus(status) {
  if (status === undefined || status === null || String(status).trim() === "") return "Unknown";
  const labels = {
    DRAFT: "Draft", PUBLISHED: "Published", SCHEDULED: "Scheduled",
    AVAILABLE: "Available", ASSIGNED: "Assigned", READY: "Ready", PENDING: "Pending",
    RUNNING: "Running", ACTIVE: "Active", PAUSED: "Paused", RESUMED: "Resumed",
    INTERRUPTED: "Interrupted", COMPLETED: "Completed", TERMINATED: "Terminated",
    LOCKED: "Locked", CANCELLED: "Cancelled", CANCELED: "Canceled",
    APPROVED: "Approved", REJECTED: "Rejected",
    LATEENTRYREQUESTED: "Late Entry Requested", LATEENTRYAPPROVED: "Late Entry Approved",
    LATEENTRYREJECTED: "Late Entry Rejected", REENTRYREQUESTED: "Re-entry Requested",
    REENTRYAPPROVED: "Re-entry Approved", REENTRYREJECTED: "Re-entry Rejected",
    NOTSTARTED: "Not Started", INPROGRESS: "In Progress", UNDERREVIEW: "Under Review",
    NOTATTENDED: "Not Attended",
  };
  const key = normalizeStatusKey(status);
  if (labels[key]) return labels[key];
  return String(status).trim().replace(/_/g, " ").replace(/-/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").toLowerCase()
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
  };
}

function normalizeCandidate(c) {
  if (!c) return null;
  return {
    ...c,
    assessmentid: c.assessmentid ?? c.assessment_id ?? null,
    candidateid: c.candidateid ?? c.candidate_id ?? null,
    candidatename: c.candidatename ?? c.candidate_name ?? c.name ?? "Candidate",
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
  if (s === "RUNNING") return { label: "Running", color: t.success, gradient: t.successGradient };
  if (s === "DRAFT") return { label: "Draft", color: t.textMuted, gradient: `linear-gradient(135deg, ${t.textMuted}, ${t.textFaint})` };
  if (s === "PUBLISHED") return { label: "Published", color: t.accent, gradient: t.accentGradient };
  if (s === "COMPLETED") return { label: "Completed", color: t.textSecondary, gradient: `linear-gradient(135deg, ${t.textSecondary}, ${t.textMuted})` };
  if (s === "TERMINATED") return { label: "Terminated", color: t.danger, gradient: t.dangerGradient };
  return { label: status || "Unknown", color: t.textSecondary, gradient: `linear-gradient(135deg, ${t.textSecondary}, ${t.textMuted})` };
}

function requestTypeLabel(type) {
  const t = String(type || "").toUpperCase();
  if (t === "REENTRY" || t === "RE-ENTRY") return "Re-entry";
  if (t === "LATEENTRY" || t === "LATE_ENTRY") return "Late entry";
  return t || "Request";
}

function requestStatusMeta(status, t) {
  const s = String(status || "").toUpperCase();
  if (s === "PENDING") return { color: t.warning, gradient: t.warningGradient, label: "Pending" };
  if (s === "APPROVED") return { color: t.success, gradient: t.successGradient, label: "Approved" };
  if (s === "REJECTED") return { color: t.danger, gradient: t.dangerGradient, label: "Rejected" };
  return { color: t.textSecondary, gradient: `linear-gradient(135deg, ${t.textSecondary}, ${t.textMuted})`, label: status || "Unknown" };
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
        <span key={i} style={{ position: "absolute", top: s.top, left: s.left, width: s.size, height: s.size, borderRadius: "50%", background: "#ffffff", opacity: s.o, transition: "opacity 0.6s ease" }} />
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
          transition: "left 0.5s cubic-bezier(0.68, -0.4, 0.27, 1.4), background 0.5s ease, box-shadow 0.5s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isDark ? "#3d4460" : "#7a4a00"} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: isDark ? 1 : 0, transform: isDark ? "rotate(0)" : "rotate(-140deg) scale(0.4)", transition: "opacity 0.4s ease, transform 0.5s ease", position: "absolute" }}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7a4a00" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: isDark ? 0 : 1, transform: isDark ? "rotate(140deg) scale(0.4)" : "rotate(0)", transition: "opacity 0.4s ease, transform 0.5s ease", position: "absolute" }}>
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
        background: active ? t.accentGradient : hover ? t.surfaceGlassHover : t.surfaceGlass,
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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: active ? "spinFluid 0.9s cubic-bezier(0.4, 0, 0.2, 1) infinite" : "none" }}>
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
          await axios.post(`${API}/api/auth/logout`, { refreshtoken: refreshToken });
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
        <span style={{ width: 14, height: 14, border: `2px solid ${t.textMuted}44`, borderTopColor: t.textPrimary, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: hover ? "translateX(2px)" : "translateX(0)", transition: "transform 0.3s ease" }}>
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
        gap: 7,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function GradientButton({ children, onClick, disabled, theme, gradient, glow, style }) {
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
      <span style={{ position: "relative", zIndex: 2, display: "inline-flex", alignItems: "center", gap: 8 }}>{children}</span>
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
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={t.border} strokeWidth={stroke} fill="none" />
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
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.2, 0.8, 0.2, 1)", filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: t.textPrimary, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.5 }}>{value}</div>
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
        transition: "background 0.55s ease, border-color 0.35s ease, transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.35s ease",
        transform: hover ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hover ? `0 20px 40px ${color}22, 0 0 0 1px ${color}22 inset` : t.name === "light" ? "0 4px 14px rgba(20,28,60,0.06)" : "none",
        position: "relative",
        overflow: "hidden",
        cursor: "default",
      }}
    >
      <div style={{ position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: "50%", background: gradient, opacity: hover ? 0.22 : 0.1, filter: "blur(30px)", transition: "opacity 0.4s ease" }} />
      <RingProgress value={value} total={total} color={color} theme={theme} />
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>
          <span style={{ display: "inline-flex", opacity: 0.9 }}>{icon}</span>
          {label}
        </div>
        <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.4 }}>{total > 0 ? `${value} of ${total}` : "No data"}</div>
      </div>
    </div>
  );
}

function StatusPill({ status, theme }) {
  const t = THEMES[theme];
  const meta = examStatusMeta(status, t);
  const running = String(status).toUpperCase() === "RUNNING";
  return (
    <span style={{ background: meta.gradient, color: "#ffffff", padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: 0.3, whiteSpace: "nowrap", boxShadow: `0 4px 12px ${meta.color}44`, display: "inline-flex", alignItems: "center", gap: 6 }}>
      {running && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff", animation: "pulseDot 1.4s ease-in-out infinite" }} />}
      {meta.label}
    </span>
  );
}

/* ============= Confirm modal ============= */

function ConfirmModal({ open, theme, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, danger, working }) {
  const t = THEMES[theme];
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: t.overlay, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: 20, animation: "fadeIn 0.2s ease" }}>
      <div style={{ width: "100%", maxWidth: 440, background: t.surfaceElevated, backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: `1px solid ${t.borderStrong}`, borderRadius: 20, padding: 28, boxShadow: "0 30px 80px rgba(0,0,0,0.45)", animation: "slideUp 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 18px", display: "flex", alignItems: "center", justifyContent: "center", background: danger ? t.dangerBg : t.warningBg, border: `1px solid ${(danger ? t.danger : t.warning)}55` }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={danger ? t.danger : t.warning} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h3 style={{ fontSize: 19, fontWeight: 700, color: t.textPrimary, margin: 0, marginBottom: 8, fontFamily: "'Space Grotesk', sans-serif" }}>{title}</h3>
        <p style={{ fontSize: 13.5, color: t.textSecondary, lineHeight: 1.6, margin: 0, marginBottom: 24 }}>{message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={onCancel}
            disabled={working}
            style={{ padding: "11px 22px", fontSize: 13.5, fontWeight: 700, borderRadius: 11, background: t.surfaceGlass, color: t.textPrimary, border: `1px solid ${t.borderStrong}`, cursor: working ? "not-allowed" : "pointer", fontFamily: "'Inter', sans-serif" }}
          >
            {cancelLabel || "Cancel"}
          </button>
          <button
            onClick={onConfirm}
            disabled={working}
            style={{ padding: "11px 24px", fontSize: 13.5, fontWeight: 700, borderRadius: 11, background: danger ? t.dangerGradient : t.warningGradient, color: "#fff", border: "none", cursor: working ? "wait" : "pointer", fontFamily: "'Inter', sans-serif", boxShadow: danger ? t.glowDanger : t.glowWarning, display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            {working ? (
              <>
                <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
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

/* ============= Transition overlay (start / end) ============= */

function TransitionOverlay({ open, theme, variant, title, subtitle }) {
  const t = THEMES[theme];
  if (!open) return null;
  const color = variant === "end" ? t.danger : t.success;
  const gradient = variant === "end" ? t.dangerGradient : t.successGradient;
  return (
    <div style={{ position: "fixed", inset: 0, background: t.overlay, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001, animation: "fadeIn 0.3s ease" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", animation: "slideUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
        <div style={{ position: "relative", width: 108, height: 108, marginBottom: 24 }}>
          <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${color}`, opacity: 0.5, animation: "ringPulse 2s ease-out infinite" }} />
          <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${color}`, opacity: 0.3, animation: "ringPulse 2s ease-out 0.7s infinite" }} />
          <div style={{ position: "absolute", inset: 14, borderRadius: "50%", background: gradient, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 8px 30px ${color}66`, animation: "gentleFloat 2.4s ease-in-out infinite" }}>
            {variant === "end" ? (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="#ffffff"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            ) : (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="#ffffff"><polygon points="6 4 20 12 6 20 6 4" /></svg>
            )}
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#ffffff", fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.4, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.75)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          {subtitle}
        </div>
      </div>
    </div>
  );
}

/* ============= Exam card (list view) ============= */

function ExamCard({ exam, theme, index, onMonitor, onAssign }) {
  const t = THEMES[theme];
  const [hover, setHover] = useState(false);
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });
  const cardRef = useRef(null);
  const meta = examStatusMeta(exam.status, t);
  const running = String(exam.status).toUpperCase() === "RUNNING";

  const handleMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMouse({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
  };

  return (
    <div
      ref={cardRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setMouse({ x: 0.5, y: 0.5 }); }}
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
          : t.name === "light" ? "0 6px 20px rgba(20,28,60,0.08)" : "0 4px 20px rgba(0,0,0,0.12)",
        transition: "background 0.5s ease, border-color 0.3s ease, box-shadow 0.4s ease, transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)",
        transform: hover ? "translateY(-6px)" : "translateY(0)",
        position: "relative",
        overflow: "hidden",
        animation: `cardEnter 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) ${index * 0.05}s both`,
      }}
    >
      <div style={{ position: "absolute", top: `${mouse.y * 100}%`, left: `${mouse.x * 100}%`, width: 300, height: 300, borderRadius: "50%", background: `radial-gradient(circle, ${meta.color}22 0%, transparent 70%)`, transform: "translate(-50%, -50%)", pointerEvents: "none", opacity: hover ? 1 : 0, transition: "opacity 0.4s ease" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: meta.gradient, opacity: hover ? 1 : 0.6, transition: "opacity 0.35s ease" }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, position: "relative", zIndex: 1 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.textPrimary, marginBottom: 8, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.4, lineHeight: 1.25 }}>
            {exam.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: t.textMuted, fontWeight: 500 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              {exam.date || "—"}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: t.textMuted, fontWeight: 500 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              {exam.starttime} — {exam.endtime}
            </span>
          </div>
        </div>
        <StatusPill status={exam.status} theme={theme} />
      </div>

      <div style={{ display: "flex", gap: 8, position: "relative", zIndex: 1 }}>
        <div style={{ flex: 1, background: t.surfaceGlass, border: `1px solid ${t.border}`, borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 4, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            Duration
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.textPrimary, fontFamily: "'Space Grotesk', sans-serif", display: "flex", alignItems: "baseline", gap: 4 }}>
            {exam.durationminutes}
            <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 500 }}>min</span>
          </div>
        </div>
        <div style={{ flex: 1, background: t.surfaceGlass, border: `1px solid ${t.border}`, borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 4, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
            Session
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: running ? t.success : t.textPrimary, fontFamily: "'Space Grotesk', sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
            {running && <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.success, boxShadow: `0 0 6px ${t.success}`, animation: "pulseDot 1.4s ease-in-out infinite" }} />}
            {meta.label}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, position: "relative", zIndex: 1 }}>
        <GradientButton theme={theme} onClick={() => onMonitor(exam)} style={{ flex: 1, padding: "11px 0" }}>
          Monitor
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </GradientButton>
        <GhostButton theme={theme} onClick={() => onAssign(exam)} style={{ flex: 1, justifyContent: "center", padding: "11px 0" }}>
          Assign
        </GhostButton>
      </div>
    </div>
  );
}

/* ============= Small pieces ============= */

function StatBox({ label, value, color, t }) {
  return (
    <div style={{ background: t.surfaceGlass, border: `1px solid ${t.border}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 4, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "'Space Grotesk', sans-serif" }}>{value}</div>
    </div>
  );
}

function MonitorTabButton({ active, label, count, onClick, theme }) {
  const t = THEMES[theme];
  return (
    <button
      onClick={onClick}
      style={{
        height: 36,
        padding: "0 16px",
        borderRadius: 10,
        fontSize: 12.5,
        fontWeight: 700,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: active ? t.accentSoft : "transparent",
        color: active ? t.accent : t.textSecondary,
        border: active ? `1px solid ${t.borderAccent}` : `1px solid transparent`,
        fontFamily: "'Inter', sans-serif",
        transition: "all 0.2s ease",
      }}
    >
      <span>{label}</span>
      {typeof count === "number" ? (
        <span style={{ minWidth: 18, height: 18, padding: "0 6px", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", background: count > 0 ? t.warningGradient : t.surfaceGlass, color: count > 0 ? "#ffffff" : t.textMuted, fontSize: 11, fontWeight: 800, lineHeight: 1 }}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

/* ============= Global CSS ============= */

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
  // "active" hides completed by default; other keys map to a specific status bucket
  const [statusFilter, setStatusFilter] = useState("active");

  // NEW: confirm + transition overlay state
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [transition, setTransition] = useState(null); // { variant, title, subtitle }

  const headers = useMemo(() => ({ Authorization: `Bearer ${accessToken}` }), [accessToken]);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const selectedExamId = selectedExam?.examid ?? selectedExam?.exam_id ?? null;
  const normalizedExamStatus = String(selectedExam?.status || "").toUpperCase();
  const isExamRunning = normalizedExamStatus === "RUNNING";
  const isExamCompleted = normalizedExamStatus === "COMPLETED";

  const pendingRequestsCount = useMemo(
    () => reentryRequests.filter((r) => String(r.status).toUpperCase() === "PENDING").length,
    [reentryRequests]
  );

  const loadExams = useCallback(async () => {
    setLoadingExams(true);
    try {
      const res = await axios.get(`${API}/api/exams`, { headers });
      const rows = Array.isArray(res.data) ? res.data.map(normalizeExam) : [];
      setExams(rows);
      if (selectedExamId) {
        const latest = rows.find((x) => x.examid === selectedExamId);
        if (latest) setSelectedExam(latest);
      }
    } catch (e) {
      console.error("loadExams:", e.message);
    } finally {
      setLoadingExams(false);
    }
  }, [headers, selectedExamId]);

  const loadExamById = useCallback(
    async (examId) => {
      if (!examId) return null;
      try {
        const res = await axios.get(`${API}/api/exams/${examId}`, { headers });
        const normalized = normalizeExam(res.data);
        setSelectedExam(normalized);
        setExams((prev) => prev.map((e) => (e.examid === examId ? normalized : e)));
        return normalized;
      } catch (e) {
        console.error("loadExamById:", e.message);
        return null;
      }
    },
    [headers]
  );

  const loadCandidates = useCallback(
    async (examId) => {
      if (!examId) return;
      try {
        const res = await axios.get(`${API}/api/exams/${examId}/assessments`, { headers });
        setCandidates(Array.isArray(res.data) ? res.data.map(normalizeCandidate) : []);
      } catch (e) {
        console.error("loadCandidates:", e.message);
      }
    },
    [headers]
  );

  const loadViolations = useCallback(
    async (candidateId, examId) => {
      if (!candidateId || !examId) return;
      try {
        const res = await axios.get(`${API}/api/violations/${examId}/${candidateId}`, { headers });
        setViolations(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error("loadViolations:", e.message);
        setViolations([]);
      }
    },
    [headers]
  );

  const loadReentryRequests = useCallback(
    async (examIdArg) => {
      const examId = examIdArg ?? selectedExamId;
      if (!examId) {
        setReentryRequests([]);
        return [];
      }
      try {
        const res = await axios.get(`${API}/api/requests/exam/${examId}/pending`, { headers });
        const rows = Array.isArray(res.data) ? res.data.map(normalizeRequest) : [];
        setReentryRequests(rows);
        return rows;
      } catch (e) {
        console.error("loadReentryRequests:", e.message);
        setReentryRequests([]);
        return [];
      }
    },
    [selectedExamId, headers]
  );

  useEffect(() => {
    loadExams();
  }, [loadExams, refreshTick]);

  useEffect(() => {
    if (view !== "monitor" || !selectedExamId) return;
    loadExamById(selectedExamId);
    loadCandidates(selectedExamId);
    loadReentryRequests(selectedExamId);
    const poll = setInterval(() => {
      loadExamById(selectedExamId);
      loadCandidates(selectedExamId);
      loadReentryRequests(selectedExamId);
    }, 5000);
    return () => clearInterval(poll);
  }, [view, selectedExamId, loadExamById, loadCandidates, loadReentryRequests]);

  useEffect(() => {
    if (!socket || view !== "monitor" || !selectedExamId) return;
    socket.emit("join_exam", { exam_id: selectedExamId, role: "Examiner" });

    const onCandidateUpdate = (data) => {
      const candidateId = data?.candidate_id ?? data?.candidateid;
      if (!candidateId) return;
      setLiveData((prev) => ({ ...prev, [candidateId]: data }));
      loadCandidates(selectedExamId);
    };
    const onViolationAlert = ({ candidate_id, candidateid, violation }) => {
      const candidateId = candidate_id ?? candidateid;
      if (!candidateId) return;
      setLiveData((prev) => ({ ...prev, [candidateId]: { ...(prev[candidateId] || {}), latestViolation: violation } }));
    };
    const onAssessmentUpdate = () => {
      loadCandidates(selectedExamId);
      loadReentryRequests(selectedExamId);
    };
    const onExamStarted = (payload) => {
      const startedId = payload?.exam_id ?? payload?.examid;
      if (startedId && startedId !== selectedExamId) return;
      setActionMsg("Exam is now running");
      setTimeout(() => setActionMsg(""), 4000);
      loadExamById(selectedExamId);
      loadCandidates(selectedExamId);
      loadReentryRequests(selectedExamId);
      setRefreshTick((v) => v + 1);
    };

    socket.on("candidate_update", onCandidateUpdate);
    socket.on("violation_alert", onViolationAlert);
    socket.on("assessment_updated", onAssessmentUpdate);
    socket.on("exam_started", onExamStarted);

    return () => {
      socket.off("candidate_update", onCandidateUpdate);
      socket.off("violation_alert", onViolationAlert);
      socket.off("assessment_updated", onAssessmentUpdate);
      socket.off("exam_started", onExamStarted);
    };
  }, [socket, view, selectedExamId, loadCandidates, loadExamById, loadReentryRequests]);

  const openMonitor = async (exam) => {
    const normalized = normalizeExam(exam);
    setSelectedExam(normalized);
    setSelectedCandidate(null);
    setViolations([]);
    setLiveData({});
    setReentryRequests([]);
    setView("monitor");
    setMonitorTab("grid");
    const [requests] = await Promise.all([
      loadReentryRequests(normalized?.examid),
      loadExamById(normalized?.examid),
      loadCandidates(normalized?.examid),
    ]);
    const hasPending = Array.isArray(requests) && requests.some((r) => String(r.status).toUpperCase() === "PENDING");
    setMonitorTab(hasPending ? "requests" : "grid");
  };

  const startExam = async () => {
    if (!selectedExamId || startingExam || isExamRunning || isExamCompleted) return;
    setStartingExam(true);
    setTransition({ variant: "start", title: "Starting the exam", subtitle: "Going live for all candidates..." });
    try {
      await axios.patch(`${API}/api/exams/${selectedExamId}/start`, {}, { headers });
      if (socket) socket.emit("start_exam", { exam_id: selectedExamId });
      await Promise.all([loadExamById(selectedExamId), loadCandidates(selectedExamId), loadReentryRequests(selectedExamId)]);
      setRefreshTick((v) => v + 1);
      // brief success dwell for a smooth transition
      await new Promise((r) => setTimeout(r, 900));
      setActionMsg("Exam is now running");
      setTimeout(() => setActionMsg(""), 5000);
    } catch (e) {
      setActionMsg(`Could not start the exam: ${e.response?.data?.detail || e.message}`);
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
    setTransition({ variant: "end", title: "Ending the exam", subtitle: "Closing all active sessions..." });
    try {
      await axios.patch(`${API}/api/exams/${selectedExamId}/end`, {}, { headers });
      await Promise.all([loadExamById(selectedExamId), loadCandidates(selectedExamId), loadReentryRequests(selectedExamId)]);
      setRefreshTick((v) => v + 1);
      await new Promise((r) => setTimeout(r, 900));
      setActionMsg("Exam ended successfully");
      setTimeout(() => setActionMsg(""), 5000);
    } catch (e) {
      setActionMsg(`Could not end the exam: ${e.response?.data?.detail || e.message}`);
      setTimeout(() => setActionMsg(""), 5000);
    } finally {
      setTransition(null);
      setEndingExam(false);
    }
  };

  const doAction = async (assessmentId, action) => {
    if (!assessmentId) return;
    const reason = window.prompt(`Reason for "${action}" (required):`);
    if (!reason || !reason.trim()) return;
    try {
      await axios.post(`${API}/api/assessments/${assessmentId}/action`, { action, reason: reason.trim() }, { headers });
      if (socket) {
        socket.emit("examiner_control", {
          exam_id: selectedExamId,
          examid: selectedExamId,
          assessment_id: assessmentId,
          assessmentid: assessmentId,
          candidate_id: selectedCandidate?.candidateid,
          candidateid: selectedCandidate?.candidateid,
          action,
          status: action === "terminate" ? "TERMINATED" : undefined,
        });
      }
      setActionMsg(`${action.charAt(0).toUpperCase() + action.slice(1)} applied`);
      setTimeout(() => setActionMsg(""), 3000);
      await loadCandidates(selectedExamId);
      if (selectedCandidate?.candidateid) await loadViolations(selectedCandidate.candidateid, selectedExamId);
      await loadExamById(selectedExamId);
      await loadReentryRequests(selectedExamId);
    } catch (e) {
      setActionMsg(`Action failed: ${e.response?.data?.detail || e.message}`);
      setTimeout(() => setActionMsg(""), 4000);
    }
  };

  const sendBroadcast = () => {
    if (!broadcastMsg.trim() || !socket || !selectedExamId) return;
    socket.emit("broadcast_message", { exam_id: selectedExamId, examiner_id: user?.user_id ?? user?.userid, message: broadcastMsg.trim() });
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
    loadExams();
  };

  const handleReentryReview = async (request, approve) => {
    const requestId = request?.requestid;
    if (!requestId) return;
    const decision = approve ? "APPROVED" : "REJECTED";
    const rejectionReason = !approve ? window.prompt("Rejection reason:", "Not approved") : "";
    if (!approve && rejectionReason === null) return;
    setReviewingRequestId(requestId);
    try {
      await axios.patch(`${API}/api/requests/${requestId}/review`, { decision, reason: approve ? undefined : (rejectionReason || "Not approved").trim() }, { headers });
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
            ? request?.type === "LATEENTRY" || request?.type === "LATE_ENTRY" ? "LATEENTRY_APPROVED" : "REENTRY_APPROVED"
            : request?.type === "LATEENTRY" || request?.type === "LATE_ENTRY" ? "LATEENTRY_REJECTED" : "REENTRY_REJECTED",
        });
      }
      await Promise.all([loadReentryRequests(selectedExamId), loadCandidates(selectedExamId), loadExamById(selectedExamId)]);
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
          setSelectedExam(normalized);
          loadExams();
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
          loadExams();
          if (selectedExamId) loadExamById(selectedExamId);
          setView("list");
        }}
      />
    );
  }

  /* ============= LIST VIEW ============= */

  if (view === "list") {
    const hour = clock.getHours();
    const greeting = hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : hour < 21 ? "Good evening" : "Good night";
    const timeText = clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dateText = clock.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

    const total = exams.length;
    const running = exams.filter((e) => String(e.status).toUpperCase() === "RUNNING").length;
    const published = exams.filter((e) => String(e.status).toUpperCase() === "PUBLISHED").length;
    const draft = exams.filter((e) => String(e.status).toUpperCase() === "DRAFT").length;
    const completed = exams.filter((e) => {
      const s = String(e.status).toUpperCase();
      return s === "COMPLETED" || s === "TERMINATED";
    }).length;
    const activeCountExams = total - completed;

    // Status filter chips. "active" = everything except completed/terminated (default).
    const statusChips = [
      { key: "active", label: "Active", count: activeCountExams, color: t.accent },
      { key: "running", label: "Running", count: running, color: t.success },
      { key: "published", label: "Published", count: published, color: t.info },
      { key: "draft", label: "Draft", count: draft, color: t.textMuted },
      { key: "completed", label: "Completed", count: completed, color: t.textSecondary },
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
      return [e.name, e.status, e.date, e.starttime, e.endtime].filter(Boolean).map((v) => String(v).toLowerCase()).join(" ").includes(q);
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
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          transition: "background 0.7s ease, color 0.6s ease",
          position: "relative",
        }}
      >
        <GlobalStyles theme={theme} />

        <div style={{ position: "absolute", top: "-10%", left: "-10%", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, ${t.accent}22 0%, transparent 65%)`, filter: "blur(40px)", animation: "floatBlob 22s ease-in-out infinite", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-15%", right: "-10%", width: 620, height: 620, borderRadius: "50%", background: `radial-gradient(circle, ${t.accent3}18 0%, transparent 65%)`, filter: "blur(50px)", animation: "floatBlob 28s ease-in-out infinite", pointerEvents: "none" }} />

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
            transition: "background 0.55s ease, border-color 0.5s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: t.textPrimary, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.3 }}>3rdEyeZ360</span>
              <span style={{ fontSize: 10.5, color: t.textMuted, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 600 }}>
                {user?.role || "Examiner"} Workspace
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {user?.name && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 14px 5px 5px", borderRadius: 999, background: t.surfaceGlass, border: `1px solid ${t.border}` }}>
                <div className="avatar-gradient" style={{ width: 30, height: 30, borderRadius: "50%", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                  {String(user.name).charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: 13, color: t.textPrimary, fontWeight: 600 }}>{user.name}</span>
              </div>
            )}
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <IconMorphButton theme={theme} refreshing={false} loading={loadingExams} onClick={() => setRefreshTick((v) => v + 1)} />
            <LogoutButton theme={theme} />
            <GradientButton theme={theme} onClick={() => setView("create")} style={{ padding: "10px 18px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create Exam
            </GradientButton>
          </div>
        </header>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "32px 32px 40px", position: "relative", zIndex: 1 }}>
          <div style={{ maxWidth: 1440, margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 24, marginBottom: 32, animation: "cardEnter 0.5s ease" }}>
              <div style={{ background: t.cardSurface, backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: `1px solid ${t.border}`, borderRadius: 24, padding: "32px 34px", position: "relative", overflow: "hidden", boxShadow: t.name === "light" ? "0 8px 30px rgba(20,28,60,0.08)" : "none" }}>
                <div style={{ position: "absolute", top: -80, right: -80, width: 260, height: 260, borderRadius: "50%", background: t.accentGradient, opacity: t.name === "light" ? 0.18 : 0.14, filter: "blur(60px)", animation: "floatBlob 18s ease-in-out infinite" }} />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ fontSize: 11, color: t.textMuted, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ display: "inline-block", width: 24, height: 1, background: t.accentGradient }} />
                    {dateText}
                  </div>
                  <h1 style={{ fontSize: 34, fontWeight: 700, margin: 0, marginBottom: 10, color: t.textPrimary, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -1, lineHeight: 1.15 }}>
                    {greeting}
                    {user?.name ? <span className="gradient-text">, {user.name.split(" ")[0]}</span> : null}
                  </h1>
                  <p style={{ fontSize: 14.5, color: t.textSecondary, margin: 0, lineHeight: 1.65, maxWidth: 560 }}>
                    Create and monitor your exams, review candidate live-status, and handle re-entry requests — all from one place.
                  </p>
                  <div style={{ display: "flex", gap: 12, marginTop: 22, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, background: t.surfaceGlass, border: `1px solid ${t.border}` }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.success, boxShadow: `0 0 6px ${t.success}`, animation: "pulseDot 1.5s ease-in-out infinite" }} />
                      <span style={{ fontSize: 12, color: t.textSecondary, fontWeight: 600 }}>Live monitoring active</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, background: t.surfaceGlass, border: `1px solid ${t.border}` }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                      <span style={{ fontSize: 12, color: t.textSecondary, fontWeight: 600 }}>Secured proctoring</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: t.cardSurface, backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: `1px solid ${t.border}`, borderRadius: 24, padding: 28, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", position: "relative", overflow: "hidden", boxShadow: t.name === "light" ? "0 8px 30px rgba(20,28,60,0.08)" : "none" }}>
                <div style={{ position: "absolute", inset: 0, background: t.accentGradientSoft, opacity: 0.7 }} />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ fontSize: 10.5, color: t.textMuted, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Local Time</div>
                  <div className="clock-gradient" style={{ fontSize: 52, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -2 }}>{timeText}</div>
                  <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 8, fontWeight: 500, letterSpacing: 0.3 }}>
                    {clock.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24, animation: "cardEnter 0.55s ease" }}>
              <StatOrb theme={theme} label="Total Exams" value={total} total={Math.max(total, 1)} color={t.accent} gradient={t.accentGradient}
                icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 10h6M9 14h4" /></svg>} />
              <StatOrb theme={theme} label="Running" value={running} total={Math.max(total, 1)} color={t.success} gradient={t.successGradient}
                icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="5 3 19 12 5 21 5 3" /></svg>} />
              <StatOrb theme={theme} label="Published" value={published} total={Math.max(total, 1)} color={t.info} gradient={`linear-gradient(135deg, ${t.info}, ${t.accent2})`}
                icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>} />
              <StatOrb theme={theme} label="Completed" value={completed} total={Math.max(total, 1)} color={t.textSecondary} gradient={`linear-gradient(135deg, ${t.textSecondary}, ${t.textMuted})`}
                icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20 6 9 17l-5-5" /></svg>} />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: t.textPrimary, margin: 0, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.4, display: "flex", alignItems: "center", gap: 10 }}>
                  Your Exams
                  <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: t.surfaceGlass, border: `1px solid ${t.border}` }}>
                    {filteredExams.length}{filteredExams.length !== total ? ` of ${total}` : ""}
                  </span>
                </h3>
                <p style={{ fontSize: 12.5, color: t.textMuted, margin: "4px 0 0", letterSpacing: 0.2 }}>Create, monitor, and manage your assessments.</p>
              </div>
            </div>

            <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              {/* Search */}
              <div style={{ position: "relative", flex: "1 1 300px", maxWidth: 420 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={searchFocused ? t.accent : t.textMuted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", transition: "stroke 0.25s ease", pointerEvents: "none" }}>
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Search exams by name, status or date..."
                  style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px 11px 40px", fontSize: 13.5, color: t.textPrimary, background: t.inputBg, border: `1px solid ${searchFocused ? t.accent : t.border}`, borderRadius: 12, outline: "none", fontFamily: "'Inter', sans-serif", boxShadow: searchFocused ? `0 0 0 3px ${t.accentSoft}` : "none", transition: "border-color 0.2s ease, box-shadow 0.2s ease, background 0.5s ease" }}
                />
              </div>

              {/* Status filter chips */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
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
                        background: active ? `linear-gradient(135deg, ${c.color} 0%, ${c.color}cc 100%)` : t.surfaceGlass,
                        color: active ? "#ffffff" : t.textSecondary,
                        cursor: "pointer",
                        fontFamily: "'Inter', sans-serif",
                        boxShadow: active ? `0 4px 12px ${c.color}55` : "none",
                        transition: "all 0.25s ease",
                      }}
                      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = t.surfaceGlassHover; }}
                      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = t.surfaceGlass; }}
                    >
                      {c.label}
                      <span
                        style={{
                          fontSize: 10.5,
                          padding: "1px 7px",
                          borderRadius: 999,
                          background: active ? "rgba(255,255,255,0.28)" : t.surfaceGlassHover,
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
              <div style={{ textAlign: "center", color: t.textMuted, padding: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                <span style={{ width: 28, height: 28, border: `3px solid ${t.border}`, borderTopColor: t.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                Loading exams...
              </div>
            ) : filteredExams.length === 0 ? (
              <div style={{ background: t.cardSurface, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: `1px dashed ${t.borderStrong}`, borderRadius: 20, padding: "56px 24px", color: t.textMuted, fontSize: 14, textAlign: "center", animation: "fadeIn 0.3s ease" }}>
                <div style={{ width: 60, height: 60, borderRadius: "50%", background: t.accentGradientSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: `1px solid ${t.border}` }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                </div>
                <div style={{ color: t.textPrimary, fontWeight: 700, marginBottom: 4, fontSize: 16, fontFamily: "'Space Grotesk', sans-serif" }}>
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
                    : statusFilter !== "active" && statusFilter !== "all" && total > 0
                    ? "Switch to another filter to see your other exams."
                    : "Create your first exam to get started."}
                </div>
                {!search && total === 0 && (
                  <div style={{ marginTop: 16 }}>
                    <GradientButton theme={theme} onClick={() => setView("create")} style={{ padding: "10px 24px", fontSize: 14 }}>Create your first exam</GradientButton>
                  </div>
                )}
                {!search && total > 0 && statusFilter !== "active" && (
                  <div style={{ marginTop: 16 }}>
                    <GhostButton theme={theme} onClick={() => setStatusFilter("active")} style={{ padding: "9px 18px", justifyContent: "center" }}>Back to active exams</GhostButton>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 20, alignItems: "start" }}>
                {filteredExams.map((exam, i) => (
                  <ExamCard key={exam.examid} exam={exam} index={i} theme={theme} onMonitor={openMonitor} onAssign={(ex) => { setSelectedExam(ex); setView("assign"); }} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ============= MONITOR VIEW ============= */

  if (view === "monitor") {
    const activeCount = candidates.filter((c) => String(c.status).toUpperCase() === "ACTIVE").length;
    const interruptedCount = candidates.filter((c) => String(c.status).toUpperCase() === "INTERRUPTED").length;
    const lockedCount = candidates.filter((c) => String(c.status).toUpperCase() === "LOCKED").length;
    const avgCredibility = candidates.length > 0 ? Math.round(candidates.reduce((sum, c) => sum + Number(c.credibilityscore || 0), 0) / candidates.length) : 0;

    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          background: t.canvas,
          backgroundImage: t.canvasTint,
          color: t.textPrimary,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          transition: "background 0.7s ease, color 0.6s ease",
          overflow: "hidden",
        }}
      >
        <GlobalStyles theme={theme} />

        {/* Control bar */}
        <div style={{ minHeight: 60, background: t.surface, backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", padding: "0 20px", gap: 12, flexShrink: 0, flexWrap: "wrap" }}>
          <GhostButton theme={theme} onClick={goBack} style={{ padding: "7px 14px" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
            Back
          </GhostButton>

          <span style={{ fontWeight: 700, fontSize: 15, color: t.textPrimary, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.3 }}>{selectedExam?.name}</span>
          <StatusPill status={selectedExam?.status} theme={theme} />
          <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 600 }}>{candidates.length} candidate{candidates.length !== 1 ? "s" : ""}</span>
          {actionMsg && <span style={{ fontSize: 12, color: t.success, marginLeft: 4, fontWeight: 700 }}>{actionMsg}</span>}

          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <LogoutButton theme={theme} />
            <input
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendBroadcast()}
              placeholder="Broadcast to all candidates..."
              style={{ width: 220, padding: "8px 12px", fontSize: 12, background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 10, color: t.textPrimary, outline: "none", fontFamily: "'Inter', sans-serif" }}
            />
            <GhostButton theme={theme} onClick={sendBroadcast}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              Send
            </GhostButton>

            {/* Start button with play icon */}
            <GradientButton theme={theme} onClick={startExam} disabled={startingExam || isExamRunning || isExamCompleted} gradient={t.successGradient} glow={t.glowSuccess}>
              {startingExam ? (
                <>
                  <span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  Starting
                </>
              ) : isExamCompleted ? (
                "Exam Completed"
              ) : isExamRunning ? (
                <>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", animation: "pulseDot 1.4s ease-in-out infinite" }} />
                  Running
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="#ffffff"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  Start Exam
                </>
              )}
            </GradientButton>

            {/* End button with stop icon */}
            <GradientButton theme={theme} onClick={() => setConfirmEndOpen(true)} disabled={endingExam || isExamCompleted} gradient={t.dangerGradient} glow={t.glowDanger}>
              {endingExam ? (
                <>
                  <span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  Ending
                </>
              ) : isExamCompleted ? (
                "Exam Ended"
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#ffffff"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
                  End Exam
                </>
              )}
            </GradientButton>

            <GhostButton theme={theme} onClick={() => { setSelectedExam(selectedExam); setView("assign"); }}>Assign</GhostButton>
            <GhostButton theme={theme} onClick={() => { loadExamById(selectedExamId); loadCandidates(selectedExamId); loadReentryRequests(selectedExamId); }}>Refresh</GhostButton>
          </div>
        </div>

        {/* Stat row */}
        <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, borderBottom: `1px solid ${t.border}`, background: t.surfaceGlass, flexShrink: 0 }}>
          <StatBox label="Active" value={activeCount} color={t.success} t={t} />
          <StatBox label="Interrupted" value={interruptedCount} color={t.warning} t={t} />
          <StatBox label="Locked" value={lockedCount} color={t.danger} t={t} />
          <StatBox label="Avg credibility" value={`${avgCredibility}%`} color={t.accent} t={t} />
        </div>

        {/* Tabs */}
        <div style={{ minHeight: 48, background: t.surface, backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", padding: "6px 16px", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          <MonitorTabButton theme={theme} active={monitorTab === "grid"} label="Live Grid" onClick={() => setMonitorTab("grid")} />
          <MonitorTabButton theme={theme} active={monitorTab === "requests"} label="Requests" count={pendingRequestsCount} onClick={() => setMonitorTab("requests")} />
        </div>

        {monitorTab === "requests" ? (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 16 }}>
            {reentryRequests.length === 0 ? (
              <div style={{ color: t.textMuted, textAlign: "center", padding: "60px 0", fontSize: 14 }}>No pending requests.</div>
            ) : (
              <div style={{ display: "grid", gap: 12, maxWidth: 900, margin: "0 auto" }}>
                {reentryRequests.map((req) => {
                  const meta = requestStatusMeta(req.status, t);
                  return (
                    <div key={req.requestid} style={{ background: t.cardSurface, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: `1px solid ${t.border}`, borderRadius: 16, padding: 18, boxShadow: t.name === "light" ? "0 6px 20px rgba(20,28,60,0.07)" : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: t.textPrimary, fontFamily: "'Space Grotesk', sans-serif" }}>{requestTypeLabel(req.type)} Request</div>
                        <span style={{ background: meta.gradient, color: "#fff", padding: "4px 11px", borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", boxShadow: `0 4px 12px ${meta.color}44` }}>{meta.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 10 }}>
                        {req.candidatename ? `${req.candidatename} • ` : ""}Candidate {req.candidateid} • Assessment {req.assessmentid}
                      </div>
                      <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 12, lineHeight: 1.6 }}>{req.reason || "No reason provided"}</div>
                      {req.createdat && <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8 }}>Requested at {new Date(req.createdat).toLocaleString()}</div>}
                      {req.reviewedat && req.status !== "PENDING" && <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8 }}>Reviewed at {new Date(req.reviewedat).toLocaleString()}</div>}
                      {req.reviewreason && req.status !== "PENDING" && <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 12 }}>Review reason: {req.reviewreason}</div>}
                      {req.status === "PENDING" ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <GradientButton theme={theme} onClick={() => handleReentryReview(req, true)} disabled={reviewingRequestId === req.requestid} gradient={t.successGradient} glow={t.glowSuccess} style={{ padding: "8px 16px" }}>
                            {reviewingRequestId === req.requestid ? "Working..." : "Approve"}
                          </GradientButton>
                          <GradientButton theme={theme} onClick={() => handleReentryReview(req, false)} disabled={reviewingRequestId === req.requestid} gradient={t.dangerGradient} glow={t.glowDanger} style={{ padding: "8px 16px" }}>
                            {reviewingRequestId === req.requestid ? "Working..." : "Reject"}
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
          <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
            {/* Candidate grid */}
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12, alignContent: "start" }}>
              {candidates.length === 0 ? (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", color: t.textMuted, padding: "60px 0", fontSize: 13 }}>
                  No candidates assigned yet.{" "}
                  <span onClick={() => setView("assign")} style={{ color: t.accent, cursor: "pointer", fontWeight: 600 }}>Assign candidates</span>
                </div>
              ) : (
                candidates.map((c) => {
                  const candidateId = c.candidateid;
                  const live = liveData[candidateId] || {};
                  const color = statusColor(c.status, t);
                  const isAlert = !!live.latestViolation;
                  const isActive = candidateId === selectedCandidate?.candidateid;
                  return (
                    <div
                      key={candidateId}
                      onClick={() => { setSelectedCandidate(c); loadViolations(candidateId, selectedExamId); }}
                      style={{
                        background: isActive ? t.cardSurfaceHover : t.cardSurface,
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                        border: `2px solid ${isAlert ? t.danger : isActive ? t.accent : t.border}`,
                        borderRadius: 14,
                        padding: 14,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 10, color: t.textMuted, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "'JetBrains Mono', monospace" }}>{candidateId}</span>
                        <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0, boxShadow: `0 0 6px ${color}` }} />
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: t.textPrimary }}>{c.candidatename}</div>
                      <div style={{ fontSize: 11, color, marginBottom: 8, fontWeight: 600 }}>{formatStatus(c.status)}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: t.textSecondary, fontWeight: 600 }}>
                        <span title="Violations">V {c.violationcount}</span>
                        <span title="Risk score">R {c.riskscore}</span>
                        <span title="Credibility">C {c.credibilityscore}</span>
                      </div>
                      {isAlert && (
                        <div style={{ marginTop: 8, fontSize: 10, background: t.dangerBg, borderRadius: 6, padding: "4px 8px", color: t.danger, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 600 }}>
                          {live.latestViolation?.type || "Violation alert"}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Detail panel — fixed structure so Violations + Chat are always visible */}
            <div style={{ width: 410, maxWidth: "34vw", minWidth: 360, flexShrink: 0, borderLeft: `1px solid ${t.border}`, background: t.panelBg, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", transition: "background 0.55s ease, border-color 0.5s ease" }}>
              {!selectedCandidate ? (
                <div style={{ padding: 20, color: t.textMuted, fontSize: 13 }}>Select a candidate to view details.</div>
              ) : (
                <>
                  {/* Candidate summary */}
                  <div style={{ padding: "18px 18px 16px", borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
                      <div className="avatar-gradient" style={{ width: 38, height: 38, borderRadius: 12, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
                        {String(selectedCandidate.candidatename || "C").charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: t.textPrimary, fontFamily: "'Space Grotesk', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selectedCandidate.candidatename}</div>
                        <div style={{ marginTop: 3, fontSize: 10.5, color: t.textMuted, fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selectedCandidate.candidateid}</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", marginBottom: 10, borderRadius: 11, background: `${statusColor(selectedCandidate.status, t)}12`, border: `1px solid ${statusColor(selectedCandidate.status, t)}55` }}>
                      <div style={{ fontSize: 9.5, color: t.textMuted, fontWeight: 800, letterSpacing: 0.7, textTransform: "uppercase" }}>Current Status</div>
                      <div style={{ color: statusColor(selectedCandidate.status, t), fontSize: 12, fontWeight: 800, textAlign: "right" }}>{formatStatus(selectedCandidate.status)}</div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                      {[
                        ["Warnings", selectedCandidate.warningcount, t.warning],
                        ["Violations", selectedCandidate.violationcount, t.danger],
                        ["Credibility", `${selectedCandidate.credibilityscore}%`, t.accent],
                      ].map(([label, value, color]) => (
                        <div key={label} style={{ minWidth: 0, padding: "10px 6px", borderRadius: 10, background: t.surfaceGlass, border: `1px solid ${t.border}`, textAlign: "center" }}>
                          <div style={{ fontSize: 8.5, color: t.textMuted, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
                          <div style={{ marginTop: 4, fontSize: 18, color, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 12 }}>
                      <GhostButton theme={theme} onClick={() => doAction(selectedCandidate.assessmentid, "pause")} style={{ padding: "8px 6px", justifyContent: "center" }}>Pause</GhostButton>
                      <GradientButton theme={theme} onClick={() => doAction(selectedCandidate.assessmentid, "resume")} gradient={t.successGradient} glow={t.glowSuccess} style={{ padding: "8px 6px", width: "100%" }}>Resume</GradientButton>
                      <GradientButton theme={theme} onClick={() => doAction(selectedCandidate.assessmentid, "terminate")} gradient={t.dangerGradient} glow={t.glowDanger} style={{ padding: "8px 6px", width: "100%" }}>Terminate</GradientButton>
                    </div>
                  </div>

                  {/* Scrollable middle: live data + violations */}
                  <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 800, color: t.textPrimary, textTransform: "uppercase", letterSpacing: 0.7 }}>Latest Live Data</div>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: liveData[selectedCandidate.candidateid] ? t.success : t.textFaint, boxShadow: liveData[selectedCandidate.candidateid] ? `0 0 7px ${t.success}` : "none" }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
                      {[
                        ["Status", liveData[selectedCandidate.candidateid]?.status ? formatStatus(liveData[selectedCandidate.candidateid].status) : "—"],
                        ["Focus", liveData[selectedCandidate.candidateid]?.focus ?? "—"],
                        ["Noise", liveData[selectedCandidate.candidateid]?.noise_level ?? "—"],
                        ["Face Count", liveData[selectedCandidate.candidateid]?.face_count ?? "—"],
                      ].map(([label, value]) => (
                        <div key={label} style={{ minWidth: 0, padding: "9px 10px", background: t.surfaceGlass, border: `1px solid ${t.border}`, borderRadius: 9 }}>
                          <div style={{ fontSize: 8.5, color: t.textMuted, fontWeight: 800, letterSpacing: 0.45, textTransform: "uppercase" }}>{label}</div>
                          <div title={String(value)} style={{ marginTop: 4, color: t.textPrimary, fontSize: 11.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10, color: t.textPrimary, textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 8 }}>
                      Violations
                      <span style={{ fontSize: 11, fontWeight: 700, color: t.danger, background: t.dangerBg, borderRadius: 999, padding: "1px 8px" }}>{violations.length}</span>
                    </div>
                    {violations.length === 0 ? (
                      <div style={{ color: t.textMuted, fontSize: 12, padding: "8px 0" }}>No violations recorded.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 10 }}>
                        {violations.map((v, idx) => (
                          <div key={v.violation_id ?? v.id ?? idx} style={{ background: t.surfaceGlass, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: t.warning, marginBottom: 6 }}>{v.type ?? v.violation_type ?? "Violation"}</div>
                            <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 6 }}>{v.message ?? v.description ?? "No description"}</div>
                            <div style={{ fontSize: 11, color: t.textMuted }}>{v.timestamp ? new Date(v.timestamp).toLocaleString() : "Time unavailable"}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Chat (fixed height at bottom) */}
                  <div style={{ borderTop: `1px solid ${t.border}`, height: 240, flexShrink: 0, overflow: "hidden" }}>
                    <ChatWindow examId={selectedExamId} currentUser={user} selectedUserId={selectedCandidate.candidateid} selectedUserName={selectedCandidate.candidatename} />
                  </div>
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
          title="End this exam?"
          message="This will close the exam for every candidate. Any active or paused sessions will be ended and cannot be resumed."
          confirmLabel="Yes, end exam"
          cancelLabel="No, keep running"
          working={endingExam}
          onCancel={() => setConfirmEndOpen(false)}
          onConfirm={performEndExam}
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
