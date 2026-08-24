import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import axios from "axios";
import useAuthStore from "../../store/authStore";
import useExamStore from "../../store/examStore";
import useSocket from "../../hooks/useSocket";
import ChatWindow from "../../components/common/ChatWindow";
import { startCandidateWebRTC } from "../../services/candidateWebRTC";

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
    surfaceElevated: "rgba(30, 34, 50, 0.72)",
    surfaceGlass: "rgba(255, 255, 255, 0.03)",
    surfaceGlassHover: "rgba(255, 255, 255, 0.055)",
    cardSurface: "rgba(22, 26, 40, 0.5)",
    cardSurfaceHover: "rgba(28, 32, 48, 0.65)",
    border: "rgba(255, 255, 255, 0.06)",
    borderStrong: "rgba(255, 255, 255, 0.12)",
    borderAccent: "rgba(91, 140, 255, 0.4)",
    textPrimary: "#f1f3fb",
    textSecondary: "#a8afc7",
    textMuted: "#6b7286",
    textFaint: "#464b60",
    accent: "#5b8cff",
    accent2: "#a065ff",
    accent3: "#ff6ec7",
    accentGradient: "linear-gradient(135deg, #5b8cff 0%, #a065ff 50%, #ff6ec7 100%)",
    accentGradientSoft:
      "linear-gradient(135deg, rgba(91,140,255,0.15) 0%, rgba(160,101,255,0.15) 50%, rgba(255,110,199,0.15) 100%)",
    accentSoft: "rgba(91,140,255,0.12)",
    success: "#3ecf8e",
    successGradient: "linear-gradient(135deg, #3ecf8e 0%, #22a37a 100%)",
    successBg: "rgba(62,207,142,0.1)",
    warning: "#e8b04b",
    warningGradient: "linear-gradient(135deg, #ffc94b 0%, #e8850b 100%)",
    warningBg: "rgba(232,176,75,0.1)",
    danger: "#ef6a6a",
    dangerGradient: "linear-gradient(135deg, #ff7a7a 0%, #d94a4a 100%)",
    dangerBg: "rgba(239,106,106,0.1)",
    info: "#6da5ff",
    infoBg: "rgba(109,165,255,0.1)",
    glowAccent: "0 8px 32px rgba(91,140,255,0.28), 0 0 60px rgba(160,101,255,0.15)",
    // Bubbles
    bubbleFill: "rgba(255, 255, 255, 0.06)",
    bubbleBorder: "rgba(255, 255, 255, 0.20)",
    bubbleHighlight: "rgba(255, 255, 255, 0.35)",
  },
  light: {
    name: "light",
    canvas: "#eef1fb",
    canvasTint:
      "radial-gradient(ellipse at top left, #dbe4ff 0%, #eef1fb 45%), radial-gradient(ellipse at bottom right, #ffd9ec 0%, #eef1fb 55%)",
    surface: "rgba(255, 255, 255, 0.78)",
    surfaceElevated: "rgba(255, 255, 255, 0.92)",
    surfaceGlass: "rgba(255, 255, 255, 0.55)",
    surfaceGlassHover: "rgba(255, 255, 255, 0.8)",
    cardSurface: "rgba(255, 255, 255, 0.82)",
    cardSurfaceHover: "rgba(255, 255, 255, 0.95)",
    border: "rgba(20, 28, 60, 0.08)",
    borderStrong: "rgba(20, 28, 60, 0.15)",
    borderAccent: "rgba(75, 96, 232, 0.4)",
    textPrimary: "#0b1024",
    textSecondary: "#3a4160",
    textMuted: "#6a7290",
    textFaint: "#a4abc0",
    accent: "#4b60e8",
    accent2: "#7c3aed",
    accent3: "#e94aa8",
    accentGradient: "linear-gradient(135deg, #4b60e8 0%, #7c3aed 50%, #e94aa8 100%)",
    accentGradientSoft:
      "linear-gradient(135deg, rgba(75,96,232,0.12) 0%, rgba(124,58,237,0.12) 50%, rgba(233,74,168,0.12) 100%)",
    accentSoft: "rgba(75,96,232,0.10)",
    success: "#0ea564",
    successGradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    successBg: "rgba(14,165,100,0.14)",
    warning: "#d97706",
    warningGradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    warningBg: "rgba(217,119,6,0.14)",
    danger: "#dc2626",
    dangerGradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    dangerBg: "rgba(220,38,38,0.12)",
    info: "#2563eb",
    infoBg: "rgba(37,99,235,0.12)",
    glowAccent: "0 12px 40px rgba(75,96,232,0.25), 0 0 60px rgba(124,58,237,0.15)",
    // Bubbles
    bubbleFill: "rgba(75, 96, 232, 0.08)",
    bubbleBorder: "rgba(75, 96, 232, 0.24)",
    bubbleHighlight: "rgba(255, 255, 255, 0.9)",
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

/* ============= Header controls ============= */

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";
  const t = THEMES[theme];
  return (
    <button
      onClick={onToggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      style={{
        position: "relative",
        width: 62,
        height: 32,
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
        { top: 20, left: 16, size: 1.5, o: isDark ? 0.6 : 0 },
        { top: 10, left: 22, size: 1.5, o: isDark ? 0.7 : 0 },
      ].map((s, i) => (
        <span key={i} style={{ position: "absolute", top: s.top, left: s.left, width: s.size, height: s.size, borderRadius: "50%", background: "#ffffff", opacity: s.o, transition: "opacity 0.6s ease" }} />
      ))}
      <span
        style={{
          position: "absolute",
          top: 3,
          left: isDark ? 33 : 3,
          width: 24,
          height: 24,
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
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isDark ? "#3d4460" : "#7a4a00"} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: isDark ? 1 : 0, transform: isDark ? "rotate(0)" : "rotate(-140deg) scale(0.4)", transition: "opacity 0.4s ease, transform 0.5s ease", position: "absolute" }}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7a4a00" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: isDark ? 0 : 1, transform: isDark ? "rotate(140deg) scale(0.4)" : "rotate(0)", transition: "opacity 0.4s ease, transform 0.5s ease", position: "absolute" }}>
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

function BackButton({ theme, onClick, disabled, loading }) {
  const t = THEMES[theme];
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px 8px 10px",
        borderRadius: 12,
        background: hover && !disabled ? t.surfaceGlassHover : t.surfaceGlass,
        border: `1px solid ${hover && !disabled ? t.borderStrong : t.border}`,
        color: t.textSecondary,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "'Inter', sans-serif",
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: 0.2,
        opacity: disabled ? 0.55 : 1,
        transition: "all 0.25s ease",
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
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.4"
          strokeLinecap="round" strokeLinejoin="round"
          style={{
            transform: hover && !disabled ? "translateX(-2px)" : "translateX(0)",
            transition: "transform 0.25s ease",
          }}
        >
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      )}
      {loading ? "Returning" : "Dashboard"}
    </button>
  );
}

function LogoutButton({ onLogout, theme }) {
  const t = THEMES[theme];
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState(false);

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onLogout?.();
    } finally {
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

/* ============= Animated Background ============= */

function AnimatedBackground({ theme }) {
  const t = THEMES[theme];

  const bubbles = [
    { top: "12%", left: "8%",  size: 22, dur: 14, delay: 0 },
    { top: "18%", left: "72%", size: 14, dur: 12, delay: 2 },
    { top: "30%", left: "4%",  size: 30, dur: 16, delay: 4 },
    { top: "36%", left: "88%", size: 24, dur: 15, delay: 3 },
    { top: "50%", left: "6%",  size: 16, dur: 12, delay: 5 },
    { top: "54%", left: "92%", size: 26, dur: 18, delay: 2 },
    { top: "68%", left: "8%",  size: 20, dur: 14, delay: 6 },
    { top: "74%", left: "82%", size: 28, dur: 17, delay: 3 },
    { top: "80%", left: "4%",  size: 18, dur: 13, delay: 5 },
    { top: "86%", left: "90%", size: 14, dur: 12, delay: 4 },
    { top: "42%", left: "50%", size: 12, dur: 11, delay: 1 },
    { top: "90%", left: "48%", size: 16, dur: 13, delay: 3 },
  ];

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "-12%",
          left: "-8%",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${t.accent}22 0%, transparent 65%)`,
          filter: "blur(50px)",
          animation: "driftFloat 26s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-14%",
          right: "-10%",
          width: 620,
          height: 620,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${t.accent3}22 0%, transparent 65%)`,
          filter: "blur(60px)",
          animation: "driftFloat 32s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "40%",
          left: "48%",
          width: 380,
          height: 380,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${t.accent2}1c 0%, transparent 65%)`,
          filter: "blur(60px)",
          animation: "driftFloat 28s ease-in-out infinite",
        }}
      />

      {bubbles.map((b, i) => (
        <div
          key={`b-${i}`}
          style={{
            position: "absolute",
            top: b.top,
            left: b.left,
            width: b.size,
            height: b.size,
            borderRadius: "50%",
            background: t.bubbleFill,
            border: `1px solid ${t.bubbleBorder}`,
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            animation: `bubbleRise ${b.dur}s ease-in-out infinite`,
            animationDelay: `${b.delay}s`,
            boxShadow:
              t.name === "dark"
                ? `inset 0 1px 1px ${t.bubbleHighlight}, 0 0 12px rgba(255,255,255,0.06)`
                : `inset 0 1px 1px ${t.bubbleHighlight}, 0 4px 10px rgba(75,96,232,0.10)`,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "18%",
              left: "22%",
              width: b.size * 0.28,
              height: b.size * 0.28,
              borderRadius: "50%",
              background: t.bubbleHighlight,
              opacity: 0.6,
              filter: "blur(1px)",
            }}
          />
        </div>
      ))}
    </div>
  );
}

/* ============= Data helpers ============= */

const TERMINAL_ASSESSMENT_STATUSES = new Set(["TERMINATED", "LOCKED", "COMPLETED"]);
const TERMINAL_EXAM_STATUSES = new Set(["COMPLETED", "TERMINATED"]);

const APPROVED_ENTRY_STATUSES = new Set([
  "ASSIGNED",
  "READY",
  "ACTIVE",
  "PAUSED",
  "REENTRYAPPROVED",
  "REENTRY_APPROVED",
  "LATEENTRYAPPROVED",
  "LATEENTRY_APPROVED",
]);

const PENDING_ENTRY_STATUSES = new Set([
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

function pick(...values) {
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

function normalizeSites(...sources) {
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
    pick(raw.examstatus, raw.exam_status, raw.examStatus, raw.runtime_status, raw.runtimestatus, raw.status)
  );
  return {
    ...raw,
    examid: pick(raw.examid, raw.exam_id),
    assessmentid: pick(raw.assessmentid, raw.assessment_id),
    candidateid: pick(raw.candidateid, raw.candidate_id),
    name: pick(raw.name, raw.examname, raw.exam_name, "Exam"),
    date: pick(raw.date, raw.examdate, raw.exam_date, "—"),
    starttime: pick(raw.starttime, raw.start_time, raw.examstarttime, raw.exam_start_time, "—"),
    endtime: pick(raw.endtime, raw.end_time, raw.examendtime, raw.exam_end_time, "—"),
    durationminutes: Number(pick(raw.durationminutes, raw.duration_minutes, 0)) || 0,
    allowedwebsites: normalizeSites(raw.allowedwebsites, raw.allowed_websites),
    allowedapplications: normalizeSites(raw.allowedapplications, raw.allowed_applications),
    status: examStatus,
    examstatus: examStatus,
  };
}

function normalizeAssessment(raw) {
  if (!raw) return null;
  const assessmentStatus = toUpper(
    pick(raw.assessmentstatus, raw.assessment_status, raw.assessmentStatus, raw.status, raw.finalstatus, raw.final_status)
  );
  const finalStatus = toUpper(pick(raw.finalstatus, raw.final_status));
  const examStatus = toUpper(
    pick(raw.examstatus, raw.exam_status, raw.examStatus, raw.status_exam, raw.runtime_status, raw.runtimestatus)
  );
  return {
    ...raw,
    assessmentid: pick(raw.assessmentid, raw.assessment_id),
    examid: pick(raw.examid, raw.exam_id),
    candidateid: pick(raw.candidateid, raw.candidate_id),
    name: pick(raw.name, raw.examname, raw.exam_name, "Upcoming Exam"),
    date: pick(raw.date, raw.examdate, raw.exam_date, "—"),
    starttime: pick(raw.starttime, raw.start_time, raw.examstarttime, raw.exam_start_time, "—"),
    endtime: pick(raw.endtime, raw.end_time, raw.examendtime, raw.exam_end_time, "—"),
    durationminutes: Number(pick(raw.durationminutes, raw.duration_minutes, 0)) || 0,
    allowedwebsites: normalizeSites(raw.allowedwebsites, raw.allowed_websites),
    allowedapplications: normalizeSites(raw.allowedapplications, raw.allowed_applications),
    status: assessmentStatus,
    assessmentstatus: assessmentStatus,
    finalstatus: finalStatus,
    examstatus: examStatus,
  };
}

function getExamStatus(exam) {
  return toUpper(pick(exam?.examstatus, exam?.status));
}
function getAssessmentStatus(assessment) {
  return toUpper(pick(assessment?.assessmentstatus, assessment?.status));
}
function getFinalStatus(assessment) {
  return toUpper(pick(assessment?.finalstatus));
}
function formatDateTime(date, time) {
  if (!date && !time) return "—";
  try {
    return new Date(`${date}T${time}:00`).toLocaleString();
  } catch {
    return `${date || "—"} ${time || "—"}`;
  }
}
function safeHost(url) {
  try {
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function statusMeta(status, t) {
  const value = toUpper(status);
  if (APPROVED_ENTRY_STATUSES.has(value)) return { label: value, color: t.success, gradient: t.successGradient };
  if (PENDING_ENTRY_STATUSES.has(value)) return { label: value, color: t.warning, gradient: t.warningGradient };
  if (REJECTED_ENTRY_STATUSES.has(value)) return { label: value, color: t.danger, gradient: t.dangerGradient };
  if (value === "RUNNING") return { label: value, color: t.info, gradient: `linear-gradient(135deg, ${t.info}, ${t.accent2})` };
  if (TERMINAL_ASSESSMENT_STATUSES.has(value) || TERMINAL_EXAM_STATUSES.has(value))
    return { label: value, color: t.danger, gradient: t.dangerGradient };
  return { label: value || "—", color: t.textMuted, gradient: `linear-gradient(135deg, ${t.textMuted}, ${t.textFaint})` };
}

/* ============= Small components ============= */

function StatusPill({ status, theme }) {
  const t = THEMES[theme];
  const meta = statusMeta(status, t);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 12px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.5,
        color: "#ffffff",
        background: meta.gradient,
        whiteSpace: "nowrap",
        boxShadow: `0 4px 12px ${meta.color}44`,
      }}
    >
      {toUpper(status) === "RUNNING" && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#ffffff",
            animation: "pulseDot 1.4s ease-in-out infinite",
          }}
        />
      )}
      {meta.label}
    </span>
  );
}

function InfoCard({ label, value, theme, mono, wide }) {
  const t = THEMES[theme];
  return (
    <div
      style={{
        background: t.cardSurface,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${t.border}`,
        borderRadius: 14,
        padding: "12px 14px",
        gridColumn: wide ? "span 2" : "auto",
        transition: "background 0.55s ease, border-color 0.5s ease",
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          color: t.textMuted,
          fontWeight: 700,
          letterSpacing: 0.7,
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          color: t.textPrimary,
          fontWeight: 600,
          fontFamily: mono ? "'JetBrains Mono', monospace" : "'Inter', sans-serif",
          wordBreak: "break-word",
        }}
      >
        {value ?? "—"}
      </div>
    </div>
  );
}

function StatusCard({ label, status, theme }) {
  const t = THEMES[theme];
  return (
    <div
      style={{
        background: t.cardSurface,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${t.border}`,
        borderRadius: 14,
        padding: "12px 14px",
        transition: "background 0.55s ease, border-color 0.5s ease",
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          color: t.textMuted,
          fontWeight: 700,
          letterSpacing: 0.7,
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <StatusPill status={status || "—"} theme={theme} />
    </div>
  );
}

/* ============= Main component ============= */

export default function WaitScreen({
  exam,
  assessment,
  onExamStart,
  onLogout,
  onComplete,
  onReturnToDashboard,
}) {
  const { theme, toggleTheme } = useTheme();
  const t = THEMES[theme];

  const { accessToken, user } = useAuthStore();
  const socket = useSocket(accessToken);
  const waitingSessionId = useExamStore((state) => state.waitingSessionId);

  const [now, setNow] = useState(new Date());
  const [checking, setChecking] = useState(true);
  const [liveExam, setLiveExam] = useState(normalizeExam(exam));
  const [liveAssessment, setLiveAssessment] = useState(normalizeAssessment(assessment));
  const [returning, setReturning] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [browserError, setBrowserError] = useState("");

  const launchingRef = useRef(false);
  const launchedRef = useRef(false);
  const finishedRef = useRef(false);
  const returningRef = useRef(false);

  useEffect(() => {
    const candidateId = user?.userid || user?.user_id;
    const examId = exam?.examid || exam?.exam_id || assessment?.examid || assessment?.exam_id;
    const assessmentId = assessment?.assessmentid || assessment?.assessment_id;
    if (!socket || !candidateId || !examId) return;

    let cancelled = false;
    startCandidateWebRTC({
      socket,
      examid: examId,
      assessmentid: assessmentId,
      candidateid: candidateId,
    }).catch((error) => {
      if (!cancelled) {
        console.error("Unable to start live examiner camera stream", error);
        setActionMsg(error?.message || "Camera live stream could not be started.");
      }
    });

    return () => {
      cancelled = true;
      // The WebRTC service is intentionally kept alive while WaitScreen
      // transitions to ActiveExam. It stops on socket disconnect/logout.
    };
  }, [socket, user, exam, assessment]);

  useEffect(() => {
    setLiveExam(normalizeExam(exam));
  }, [exam]);

  useEffect(() => {
    setLiveAssessment(normalizeAssessment(assessment));
  }, [assessment]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const examId = pick(liveAssessment?.examid, assessment?.examid, liveExam?.examid, exam?.examid);
  const assessmentId = pick(
    liveAssessment?.assessmentid,
    assessment?.assessmentid,
    liveExam?.assessmentid,
    exam?.assessmentid
  );
  const candidateId = pick(
    liveAssessment?.candidateid,
    assessment?.candidateid,
    liveExam?.candidateid,
    exam?.candidateid,
    user?.userid,
    user?.user_id
  );

  const allowedSites = useMemo(
    () =>
      normalizeSites(
        liveAssessment?.allowedwebsites,
        liveExam?.allowedwebsites,
        assessment?.allowedwebsites,
        exam?.allowedwebsites
      ),
    [assessment, exam, liveAssessment, liveExam]
  );

  const mergedExamName = pick(liveAssessment?.name, liveExam?.name, assessment?.name, exam?.name, "Exam");
  const mergedDate = pick(liveAssessment?.date, liveExam?.date, assessment?.date, exam?.date, "—");
  const mergedStart = pick(liveAssessment?.starttime, liveExam?.starttime, assessment?.starttime, exam?.starttime, "—");
  const mergedEnd = pick(liveAssessment?.endtime, liveExam?.endtime, assessment?.endtime, exam?.endtime, "—");
  const mergedDuration =
    Number(pick(liveAssessment?.durationminutes, liveExam?.durationminutes, assessment?.durationminutes, exam?.durationminutes, 0)) || 0;

  const currentExamStatus = getExamStatus(liveExam || exam);
  const currentAssessmentStatus = getAssessmentStatus(liveAssessment || assessment);
  const currentFinalStatus = getFinalStatus(liveAssessment || assessment);

  const finishWaitingFlow = useCallback(async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    try { await window.electronAPI?.closeBrowser?.(); } catch (error) { console.log("closeBrowser failed", error); }
    try { await window.electronAPI?.disableLockdown?.(); } catch (error) { console.log("disableLockdown failed", error); }
    try { await window.electronAPI?.setClosable?.(true); } catch (error) { console.log("setClosable failed", error); }

    onComplete?.();
  }, [onComplete]);

  const returnToDashboardSafe = useCallback(async () => {
    if (returningRef.current) return;
    returningRef.current = true;
    setReturning(true);

    try {
      try { await window.electronAPI?.closeBrowser?.(); } catch (error) { console.log("closeBrowser failed", error); }
      try { await window.electronAPI?.disableLockdown?.(); } catch (error) { console.log("disableLockdown failed", error); }
      try { await window.electronAPI?.setClosable?.(true); } catch (error) { console.log("setClosable failed", error); }

      await onReturnToDashboard?.();
    } finally {
      setReturning(false);
    }
  }, [onReturnToDashboard]);

  const ensureBrowserVisible = useCallback(async () => {
    if (!window.electronAPI) {
      setBrowserError("Electron API is not available.");
      return false;
    }
    if (!allowedSites.length) {
      setBrowserError("No allowed websites were found for this exam.");
      console.log("ensureBrowserVisible aborted: no allowed websites found");
      return false;
    }
    setBrowserError("");
    try {
      await window.electronAPI?.enableLockdown?.();
      await window.electronAPI?.setClosable?.(false);
      await window.electronAPI?.openBrowser?.({ allowedWebsites: allowedSites });
      await window.electronAPI?.navigateBrowser?.(allowedSites[0]);
      await window.electronAPI?.showBrowser?.();
      await window.electronAPI?.restoreBrowser?.();
      await window.electronAPI?.focusBrowser?.();
      return true;
    } catch (error) {
      console.log("ensureBrowserVisible failed", error);
      setBrowserError(error?.message || "Failed to launch the exam browser.");
      try { await window.electronAPI?.closeBrowser?.(); } catch {}
      try { await window.electronAPI?.disableLockdown?.(); } catch {}
      try { await window.electronAPI?.setClosable?.(true); } catch {}
      return false;
    }
  }, [allowedSites]);

  const checkExamStatus = useCallback(async () => {
    if (finishedRef.current || returningRef.current) {
      setChecking(false);
      return;
    }
    if (!examId || !accessToken) {
      setChecking(false);
      return;
    }

    try {
      const [examRes, assessmentRes] = await Promise.all([
        axios.get(`${API}/api/exams/${examId}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        assessmentId
          ? axios.get(`${API}/api/assessments/${assessmentId}`, { headers: { Authorization: `Bearer ${accessToken}` } })
          : Promise.resolve({ data: null }),
      ]);

      const latestExam = normalizeExam(examRes?.data);
      const latestAssessment = normalizeAssessment(assessmentRes?.data);

      if (latestExam) setLiveExam(latestExam);
      if (latestAssessment) setLiveAssessment(latestAssessment);

      const examStatus = getExamStatus(latestExam);
      const assessmentStatus = getAssessmentStatus(latestAssessment);
      const finalStatus = getFinalStatus(latestAssessment);

      const assessmentTerminal =
        TERMINAL_ASSESSMENT_STATUSES.has(assessmentStatus) || TERMINAL_ASSESSMENT_STATUSES.has(finalStatus);
      const examTerminal = TERMINAL_EXAM_STATUSES.has(examStatus);
      const examRunning = examStatus === "RUNNING";
      const approvedToEnter = APPROVED_ENTRY_STATUSES.has(assessmentStatus);
      const pendingApproval = PENDING_ENTRY_STATUSES.has(assessmentStatus);
      const rejectedRequest = REJECTED_ENTRY_STATUSES.has(assessmentStatus);

      if (assessmentTerminal || examTerminal) {
        await finishWaitingFlow();
        return;
      }
      if (rejectedRequest) {
        setActionMsg("Your permission request was declined by the examiner.");
        await returnToDashboardSafe();
        return;
      }
      if (
        examRunning &&
        approvedToEnter &&
        waitingSessionId &&
        !launchedRef.current &&
        !launchingRef.current
      ) {
        launchingRef.current = true;
        setActionMsg("Exam started. Verifying your waiting session.");
        launchedRef.current = true;
        launchingRef.current = false;
        onExamStart?.();
        return;
      }
      if (examRunning && approvedToEnter && !waitingSessionId) {
        setActionMsg(
          "The waiting session is unavailable. Return to the dashboard and request late-entry permission."
        );
        return;
      }
      if (examRunning && pendingApproval) {
        setActionMsg("Your request is pending examiner approval.");
        return;
      }
      if (examRunning && !approvedToEnter && !pendingApproval) {
        setActionMsg("The exam is running, but your entry is not approved yet.");
        return;
      }
      if (!examRunning && approvedToEnter) {
        setActionMsg("Permission approved. The assessment has not started yet.");
        return;
      }
      setActionMsg("Stay visible on camera and wait for the exam to go live.");
    } catch (error) {
      console.log("Wait screen status check failed", error);
      setActionMsg(error?.response?.data?.detail || error?.message || "Failed to check exam status.");
    } finally {
      setChecking(false);
    }
  }, [
    examId,
    assessmentId,
    accessToken,
    finishWaitingFlow,
    returnToDashboardSafe,
    ensureBrowserVisible,
    onExamStart,
    waitingSessionId,
  ]);

  useEffect(() => {
    // Initial recovery snapshot only. Subsequent changes are pushed by Socket.IO.
    checkExamStatus();
  }, [checkExamStatus]);

  useEffect(() => {
    if (!socket || !examId) return;

    const joinExamRoom = () => {
      if (!socket.connected) return;
      socket.emit("join_exam", {
        examid: examId,
        assessmentid: assessmentId,
        candidateid: user?.userid || user?.user_id,
        role: "Candidate",
      });
    };

    const handleReconnect = () => {
      joinExamRoom();
      void checkExamStatus();
    };

    joinExamRoom();

    const applyExam = (payload) => {
      const next = normalizeExam(payload?.exam || payload);
      if (!next?.examid || String(next.examid) !== String(examId)) return;
      setLiveExam((previous) => ({ ...(previous || {}), ...next }));
      if (TERMINAL_EXAM_STATUSES.has(getExamStatus(next))) finishWaitingFlow();
    };

    const applyAssessment = async (payload) => {
      const next = normalizeAssessment(payload?.assessment || payload);
      if (!next?.assessmentid || String(next.assessmentid) !== String(assessmentId)) return;
      setLiveAssessment((previous) => ({ ...(previous || {}), ...next }));
      const status = getAssessmentStatus(next);
      const finalStatus = getFinalStatus(next);
      if (TERMINAL_ASSESSMENT_STATUSES.has(status) || TERMINAL_ASSESSMENT_STATUSES.has(finalStatus)) {
        await finishWaitingFlow();
      } else if (REJECTED_ENTRY_STATUSES.has(status)) {
        setActionMsg("Your permission request was declined by the examiner.");
        await returnToDashboardSafe();
      } else if (getExamStatus(liveExam) === "RUNNING" && APPROVED_ENTRY_STATUSES.has(status) && waitingSessionId && !launchedRef.current) {
        launchedRef.current = true;
        onExamStart?.();
      }
    };

    socket.on("connect", handleReconnect);
    socket.on("exam_updated", applyExam);
    socket.on("exam_started", applyExam);
    socket.on("assessment_updated", applyAssessment);
    socket.on("request_reviewed", applyAssessment);
    return () => {
      socket.off("connect", handleReconnect);
      socket.off("exam_updated", applyExam);
      socket.off("exam_started", applyExam);
      socket.off("assessment_updated", applyAssessment);
      socket.off("request_reviewed", applyAssessment);
    };
  }, [socket, examId, assessmentId, user, finishWaitingFlow, returnToDashboardSafe, onExamStart, waitingSessionId, liveExam, checkExamStatus]);

  useEffect(() => {
    return () => {
      if (!launchedRef.current) window.electronAPI?.closeBrowser?.();
    };
  }, []);

  const examRunning = currentExamStatus === "RUNNING";
  const approvedToEnter = APPROVED_ENTRY_STATUSES.has(currentAssessmentStatus);
  const pendingApproval = PENDING_ENTRY_STATUSES.has(currentAssessmentStatus);
  const rejectedRequest = REJECTED_ENTRY_STATUSES.has(currentAssessmentStatus);

  // Determine the primary "hero" state
  const heroState = (() => {
    if (approvedToEnter && examRunning)
      return {
        label: "Launching workspace",
        headline: "You're in — preparing your exam.",
        sub: "Permission granted. The secured browser is opening now.",
        color: t.success,
        gradient: t.successGradient,
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ),
      };
    if (rejectedRequest)
      return {
        label: "Request declined",
        headline: "Your permission request was declined.",
        sub: "Returning you to the dashboard shortly.",
        color: t.danger,
        gradient: t.dangerGradient,
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ),
      };
    if (pendingApproval)
      return {
        label: "Awaiting review",
        headline: "Your request is awaiting examiner review.",
        sub: "Please stay visible on camera while we wait for approval.",
        color: t.warning,
        gradient: t.warningGradient,
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        ),
      };
    if (examRunning && !approvedToEnter)
      return {
        label: "Waiting for entry",
        headline: "The exam is live, but your entry isn't approved yet.",
        sub: "Please contact your examiner if this state persists.",
        color: t.danger,
        gradient: t.dangerGradient,
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
      };
    if (!examRunning && approvedToEnter)
      return {
        label: "",
        headline: "You're approved — waiting for the assessment to start.",
        sub: "You'll be moved into the assessment workspace automatically when it begins.",
        color: t.success,
        gradient: t.successGradient,
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ),
      };
    return {
      label: "Assessment Waiting Window",
      headline: "Sit tight — you're in the waiting window.",
      sub: "Stay visible on camera. We're checking your status every few seconds.",
      color: t.accent,
      gradient: t.accentGradient,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    };
  })();

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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cardEnter { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseDot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.4); } }
        @keyframes gradientShift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes driftFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(22px, -18px) scale(1.04); }
          66%      { transform: translate(-16px, 20px) scale(0.97); }
        }
        @keyframes bubbleRise {
          0%   { transform: translate(0, 0) scale(1); opacity: 0.55; }
          50%  { transform: translate(8px, -30px) scale(1.08); opacity: 0.9; }
          100% { transform: translate(-4px, -60px) scale(0.94); opacity: 0.4; }
        }
        @keyframes radarPing {
          0%   { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        @keyframes chipBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }

        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${t.borderStrong}; border-radius: 999px; border: 2px solid transparent; background-clip: padding-box; }
        ::-webkit-scrollbar-thumb:hover { background: ${t.accent}; background-clip: padding-box; }

        .brand-gradient {
          background: ${t.accentGradient};
          background-size: 200% 200%;
          animation: gradientShift 8s ease infinite;
        }

        button, a, input, textarea { transition: background-color 0.25s ease, border-color 0.25s ease, color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease, opacity 0.25s ease; }
      `}</style>

      <AnimatedBackground theme={theme} />

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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: t.textPrimary, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.2 }}>
              Assessment Waiting Window
            </span>
            <span style={{ fontSize: 10.5, color: t.textMuted, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 600 }}>
              Live proctoring session
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {typeof onReturnToDashboard === "function" ? (
            <BackButton theme={theme} onClick={returnToDashboardSafe} disabled={returning} loading={returning} />
          ) : null}
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          {onLogout ? <LogoutButton onLogout={onLogout} theme={theme} /> : null}
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "28px 24px 40px", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20, animation: "cardEnter 0.5s ease" }}>

          {/* HERO STATUS CARD */}
          <div
            style={{
              background: t.cardSurface,
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: `1px solid ${t.border}`,
              borderRadius: 22,
              padding: 26,
              position: "relative",
              overflow: "hidden",
              boxShadow: t.name === "light" ? "0 12px 40px rgba(20,28,60,0.10)" : "0 4px 20px rgba(0,0,0,0.15)",
              transition: "background 0.55s ease, border-color 0.5s ease, box-shadow 0.5s ease",
            }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: heroState.gradient, opacity: 0.85 }} />
            <div
              style={{
                position: "absolute",
                top: -60,
                right: -60,
                width: 220,
                height: 220,
                borderRadius: "50%",
                background: heroState.gradient,
                opacity: t.name === "light" ? 0.18 : 0.14,
                filter: "blur(60px)",
                pointerEvents: "none",
              }}
            />
            <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 18, alignItems: "center" }}>
              {/* Radar pulse orb */}
              <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    border: `2px solid ${heroState.color}`,
                    opacity: 0.55,
                    animation: "radarPing 2.2s ease-out infinite",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    border: `2px solid ${heroState.color}`,
                    opacity: 0.35,
                    animation: "radarPing 2.2s ease-out 0.7s infinite",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 8,
                    borderRadius: "50%",
                    background: heroState.gradient,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: `0 8px 24px ${heroState.color}55`,
                    animation: "chipBreathe 2.4s ease-in-out infinite",
                  }}
                >
                  {heroState.icon}
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
             <h1
             style={{fontSize: 22,}}>
              {heroState.headline}
            </h1>

                <p style={{ margin: 0, fontSize: 13.5, color: t.textSecondary, lineHeight: 1.55 }}>{heroState.sub}</p>
                {checking ? (
                  <div style={{ marginTop: 10, fontSize: 12, color: t.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        border: `2px solid ${t.border}`,
                        borderTopColor: t.accent,
                        borderRadius: "50%",
                        animation: "spin 0.9s linear infinite",
                      }}
                    />
                    Checking live status
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* EXAM META CARD */}
          <div
            style={{
              background: t.cardSurface,
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: `1px solid ${t.border}`,
              borderRadius: 22,
              padding: 24,
              boxShadow: t.name === "light" ? "0 8px 30px rgba(20,28,60,0.08)" : "0 4px 20px rgba(0,0,0,0.12)",
              transition: "background 0.55s ease, border-color 0.5s ease, box-shadow 0.5s ease",
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                color: t.textMuted,
                fontWeight: 700,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ display: "inline-block", width: 20, height: 1, background: t.accentGradient }} />
              Session details
            </div>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                margin: 0,
                marginBottom: 16,
                color: t.textPrimary,
                fontFamily: "'Space Grotesk', sans-serif",
                letterSpacing: -0.4,
                lineHeight: 1.25,
              }}
            >
              {mergedExamName}
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              <InfoCard theme={theme} label="Exam ID" value={examId ?? "—"} mono />
              <InfoCard theme={theme} label="Assessment ID" value={assessmentId ?? "—"} mono />
              <InfoCard theme={theme} label="Scheduled start" value={formatDateTime(mergedDate, mergedStart)} />
              <InfoCard theme={theme} label="Exam end time" value={mergedEnd} />
              <InfoCard
                theme={theme}
                label="Duration"
                value={
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {mergedDuration}
                    <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 500, marginLeft: 4 }}>min</span>
                  </span>
                }
              />
              
              <InfoCard
                theme={theme}
                label="Browser readiness"
                value={
                  <span style={{ color: allowedSites.length ? t.success : t.warning, fontWeight: 700 }}>
                    {allowedSites.length ? "Ready" : "Missing website config"}
                  </span>
                }
              />
              <InfoCard theme={theme} label="Local time" value={now.toLocaleTimeString()} mono wide />
            </div>
          </div>

          {/* STATUS PILL ROW */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <StatusCard theme={theme} label="Assessment status" status={currentAssessmentStatus} />
            <StatusCard theme={theme} label="Exam status" status={currentExamStatus} />
            <StatusCard theme={theme} label="Final status" status={currentFinalStatus} />
          </div>

          {/* ALLOWED WEBSITES */}
          <div
            style={{
              background: t.cardSurface,
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: `1px solid ${t.border}`,
              borderRadius: 22,
              padding: 22,
              boxShadow: t.name === "light" ? "0 8px 30px rgba(20,28,60,0.08)" : "0 4px 20px rgba(0,0,0,0.12)",
              transition: "background 0.55s ease, border-color 0.5s ease, box-shadow 0.5s ease",
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                color: t.textMuted,
                fontWeight: 700,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ display: "inline-block", width: 20, height: 1, background: t.accentGradient }} />
              Allowed websites ({allowedSites.length})
            </div>

            {allowedSites.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {allowedSites.map((site, index) => (
                  <span
                    key={`${site}-${index}`}
                    title={site}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      padding: "5px 12px",
                      borderRadius: 999,
                      background: t.accentSoft,
                      border: `1px solid ${t.borderAccent}`,
                      color: t.accent,
                      fontWeight: 600,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    {safeHost(site)}
                  </span>
                ))}
              </div>
            ) : (
              <div
                style={{
                  background: t.dangerBg,
                  border: `1px solid ${t.danger}55`,
                  color: t.danger,
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontSize: 13,
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  lineHeight: 1.5,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>No allowed websites are currently available in the payload.</span>
              </div>
            )}
          </div>

          {/* ACTION MESSAGE / BROWSER ERROR */}
          {actionMsg || browserError ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {actionMsg ? (
                <div
                  style={{
                    background: t.accentSoft,
                    border: `1px solid ${t.borderAccent}`,
                    borderRadius: 14,
                    padding: "12px 14px",
                    fontSize: 13,
                    color: t.textPrimary,
                    lineHeight: 1.55,
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2.2" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span>{actionMsg}</span>
                </div>
              ) : null}

              {browserError ? (
                <div
                  style={{
                    background: t.dangerBg,
                    border: `1px solid ${t.danger}55`,
                    borderRadius: 14,
                    padding: "12px 14px",
                    fontSize: 13,
                    color: t.danger,
                    lineHeight: 1.55,
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{browserError}</span>
                </div>
              ) : null}

              {typeof onReturnToDashboard === "function" && rejectedRequest ? (
                <button
                  onClick={returnToDashboardSafe}
                  disabled={returning}
                  style={{
                    alignSelf: "flex-start",
                    padding: "10px 18px",
                    fontSize: 13,
                    fontWeight: 700,
                    background: t.accentGradient,
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 10,
                    cursor: returning ? "wait" : "pointer",
                    fontFamily: "'Inter', sans-serif",
                    letterSpacing: 0.3,
                    boxShadow: t.glowAccent,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                  {returning ? "Returning..." : "Back to Dashboard"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {examId && candidateId ? (
        <ChatWindow
          examId={examId}
          assessmentId={assessmentId}
          candidateId={candidateId}
          currentUser={user}
          conversationType="PRIVATE"
          embedded={false}
          theme={t}
        />
      ) : null}
    </div>
  );
}
