import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import useAuthStore from "../../store/authStore";

const API = "http://localhost:3000";
const THEME_STORAGE_KEY = "3rdeyez360.theme";
const TABS = ["Dashboard", "Candidates", "Examiners", "Exams", "Audit Logs"];

/* ============= Theme system ============= */

const THEMES = {
  dark: {
    name: "dark",
    canvas: "#07080d",
    canvasTint:
      "radial-gradient(ellipse at top left, #10152a 0%, #07080d 50%), radial-gradient(ellipse at bottom right, #1a0f2e 0%, #07080d 60%)",
    surface: "rgba(22, 26, 40, 0.72)",
    surfaceElevated: "rgba(30, 34, 50, 0.96)",
    surfaceGlass: "rgba(255, 255, 255, 0.05)",
    surfaceGlassHover: "rgba(255, 255, 255, 0.08)",
    cardSurface: "rgba(28, 32, 48, 0.72)",
    cardSurfaceHover: "rgba(34, 38, 56, 0.82)",
    tableHead: "rgba(255,255,255,0.04)",
    rowHover: "rgba(255,255,255,0.03)",
    border: "rgba(255, 255, 255, 0.08)",
    borderStrong: "rgba(255, 255, 255, 0.14)",
    borderAccent: "rgba(91, 140, 255, 0.4)",
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
    inputBg: "rgba(255,255,255,0.06)",
  },
  light: {
    name: "light",
    canvas: "#eef1fb",
    canvasTint:
      "radial-gradient(ellipse at top left, #dbe4ff 0%, #eef1fb 45%), radial-gradient(ellipse at bottom right, #ffd9ec 0%, #eef1fb 55%)",
    surface: "rgba(255, 255, 255, 0.85)",
    surfaceElevated: "rgba(255, 255, 255, 0.98)",
    surfaceGlass: "rgba(255, 255, 255, 0.65)",
    surfaceGlassHover: "rgba(255, 255, 255, 0.9)",
    cardSurface: "#ffffff",
    cardSurfaceHover: "#fbfcff",
    tableHead: "rgba(20,28,60,0.04)",
    rowHover: "rgba(20,28,60,0.03)",
    border: "rgba(20, 28, 60, 0.10)",
    borderStrong: "rgba(20, 28, 60, 0.18)",
    borderAccent: "rgba(75, 96, 232, 0.4)",
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
    accentSoft: "rgba(75,96,232,0.10)",
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

/* ============= Helpers ============= */

function extractErrorMessage(err, fallback = "Something went wrong") {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.message || fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : "";
        const msg = d.msg || "Invalid value";
        return field ? `${field}: ${msg}` : msg;
      })
      .join(", ");
  }
  if (typeof detail === "object") {
    return detail.msg || JSON.stringify(detail);
  }
  return String(detail);
}

function safeText(val) {
  if (val == null) return "";
  if (typeof val === "string" || typeof val === "number") return val;
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
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

function examStatusMeta(status, t) {
  const s = String(status || "").toUpperCase();
  if (s === "RUNNING") return { label: "Running", color: t.success, gradient: t.successGradient };
  if (s === "DRAFT") return { label: "Draft", color: t.textMuted, gradient: `linear-gradient(135deg, ${t.textMuted}, ${t.textFaint})` };
  if (s === "PUBLISHED") return { label: "Published", color: t.accent, gradient: t.accentGradient };
  if (s === "COMPLETED") return { label: "Completed", color: t.textSecondary, gradient: `linear-gradient(135deg, ${t.textSecondary}, ${t.textMuted})` };
  if (s === "TERMINATED") return { label: "Terminated", color: t.danger, gradient: t.dangerGradient };
  return { label: status || "Unknown", color: t.textSecondary, gradient: `linear-gradient(135deg, ${t.textSecondary}, ${t.textMuted})` };
}

/* ============= Stable top-level UI components (no flicker) ============= */

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
          await axios.post(`${API}/api/auth/logout`, { refresh_token: refreshToken });
        } catch (e) {
          console.log("Logout API failed, clearing local session anyway", e);
        }
      }
    } finally {
      localStorage.removeItem("app-screen");
      localStorage.removeItem("auth-storage");
      localStorage.removeItem("exam-storage");
      useAuthStore.getState().clearAuth();
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
        width: 38,
        height: 38,
        borderRadius: 10,
        background: hover ? t.dangerBg : t.surfaceGlass,
        border: `1px solid ${hover ? t.danger + "55" : t.border}`,
        cursor: loading ? "wait" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: hover ? t.danger : t.textSecondary,
        transition: "all 0.25s ease",
        flexShrink: 0,
      }}
    >
      {loading ? (
        <span style={{ width: 14, height: 14, border: `2px solid ${t.textMuted}44`, borderTopColor: t.textPrimary, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: hover ? "translateX(2px)" : "translateX(0)", transition: "transform 0.3s ease" }}>
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
        gap: 8,
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

function RingProgress({ value, total, color, size = 76, stroke = 6, theme, showPct }) {
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
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
        <div style={{ fontSize: showPct ? 22 : 20, fontWeight: 800, color: t.textPrimary, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.5 }}>
          {showPct ? `${Math.round(pct * 100)}%` : value}
        </div>
      </div>
    </div>
  );
}

function StatOrb({ label, value, color, gradient, theme, icon }) {
  const t = THEMES[theme];
  const [hover, setHover] = useState(false);
  const numeric = Number(value) || 0;
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
        flex: 1,
        minWidth: 220,
        transition: "background 0.55s ease, border-color 0.35s ease, transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.35s ease",
        transform: hover ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hover ? `0 20px 40px ${color}22, 0 0 0 1px ${color}22 inset` : t.name === "light" ? "0 4px 14px rgba(20,28,60,0.06)" : "none",
        position: "relative",
        overflow: "hidden",
        cursor: "default",
      }}
    >
      <div style={{ position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: "50%", background: gradient, opacity: hover ? 0.22 : 0.1, filter: "blur(30px)", transition: "opacity 0.4s ease" }} />
      <RingProgress value={numeric} total={Math.max(numeric, 1)} color={color} theme={theme} />
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>
          <span style={{ display: "inline-flex", opacity: 0.9 }}>{icon}</span>
          {label}
        </div>
        <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.4 }}>{value ?? "—"} total</div>
      </div>
    </div>
  );
}

function StatusBadge({ status, theme }) {
  const t = THEMES[theme];
  const active = status === "Active";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: active ? t.successBg : t.dangerBg,
        color: active ? t.success : t.danger,
        border: `1px solid ${(active ? t.success : t.danger)}44`,
        padding: "3px 10px 3px 8px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 700,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? t.success : t.danger, boxShadow: `0 0 6px ${active ? t.success : t.danger}` }} />
      {status}
    </span>
  );
}

const UserCard = React.memo(function UserCard({ u, theme, onToggleStatus, onResendEmail, sendingEmailFor }) {
  const t = THEMES[theme];
  const active = u.status === "Active";
  const id = u.user_id || u.userid;
  const saving = sendingEmailFor === id;
  const cardStyle = {
    background: t.cardSurface,
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: `1px solid ${t.border}`,
    borderRadius: 18,
    boxShadow: t.name === "light" ? "0 6px 20px rgba(20,28,60,0.07)" : "none",
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  };
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="brand-gradient" style={{ width: 44, height: 44, borderRadius: "50%", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
          {(u.name || "?").charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Space Grotesk', sans-serif" }}>
            {u.name || "Unnamed"}
          </div>
          <div style={{ fontSize: 12, color: t.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'JetBrains Mono', monospace" }}>
            {u.email || "No email"}
          </div>
        </div>
        <StatusBadge status={u.status} theme={theme} />
      </div>

      <div style={{ fontSize: 11.5, color: t.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
        Joined {(u.created_at || u.createdat)?.toString().split("T")[0] || "—"}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <GhostButton theme={theme} onClick={() => onToggleStatus(id, u.status)} style={{ flex: 1, justifyContent: "center", padding: "8px 0", fontSize: 12 }}>
          {active ? "Disable" : "Enable"}
        </GhostButton>
        <button
          onClick={() => onResendEmail(id)}
          disabled={saving}
          style={{ flex: 1, padding: "8px 0", fontSize: 12, fontWeight: 700, borderRadius: 10, border: `1px solid ${t.borderAccent}`, background: t.accentSoft, color: t.accent, cursor: saving ? "wait" : "pointer", fontFamily: "'Inter', sans-serif", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
          {saving ? "Sending..." : "Email"}
        </button>
      </div>
    </div>
  );
});

const ExamCard = React.memo(function ExamCard({ exam, theme }) {
  const t = THEMES[theme];
  const meta = examStatusMeta(exam.status, t);
  const running = String(exam.status).toUpperCase() === "RUNNING";
  const cardStyle = {
    background: t.cardSurface,
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: `1px solid ${t.border}`,
    borderRadius: 18,
    boxShadow: t.name === "light" ? "0 6px 20px rgba(20,28,60,0.07)" : "none",
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    position: "relative",
    overflow: "hidden",
  };
  return (
    <div style={cardStyle}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: meta.gradient, opacity: 0.7 }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: t.textPrimary, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.3, lineHeight: 1.25 }}>{exam.name}</div>
        <span style={{ background: meta.gradient, color: "#fff", padding: "4px 11px", borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6, boxShadow: `0 4px 12px ${meta.color}44` }}>
          {running && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff", animation: "pulseDot 1.4s ease-in-out infinite" }} />}
          {meta.label}
        </span>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: t.textMuted }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          {exam.date}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          {exam.starttime} — {exam.endtime}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, background: t.surfaceGlass, border: `1px solid ${t.border}`, borderRadius: 10, padding: "8px 12px" }}>
          <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>Duration</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.textPrimary, fontFamily: "'Space Grotesk', sans-serif" }}>{exam.durationminutes}<span style={{ fontSize: 10, color: t.textMuted, marginLeft: 3 }}>min</span></div>
        </div>
        <div style={{ flex: 1, background: t.surfaceGlass, border: `1px solid ${t.border}`, borderRadius: 10, padding: "8px 12px" }}>
          <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>Status</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: meta.color, fontFamily: "'Space Grotesk', sans-serif" }}>{meta.label}</div>
        </div>
      </div>
    </div>
  );
});

/* Live clock hero owns its own 1s interval so the parent never re-renders per second */
function HeroSection({ theme, user }) {
  const t = THEMES[theme];
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hour = clock.getHours();
  const greeting = hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : hour < 21 ? "Good evening" : "Good night";
  const timeText = clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateText = clock.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  const cardStyle = {
    background: t.cardSurface,
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: `1px solid ${t.border}`,
    borderRadius: 18,
    boxShadow: t.name === "light" ? "0 6px 20px rgba(20,28,60,0.07)" : "none",
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)", gap: 20 }}>
      <div style={{ ...cardStyle, padding: "28px 30px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -70, right: -70, width: 220, height: 220, borderRadius: "50%", background: t.accentGradient, opacity: t.name === "light" ? 0.16 : 0.12, filter: "blur(60px)", animation: "floatBlob 18s ease-in-out infinite" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 11, color: t.textMuted, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-block", width: 22, height: 1, background: t.accentGradient }} />
            {dateText}
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0, marginBottom: 8, color: t.textPrimary, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.8, lineHeight: 1.15 }}>
            {greeting}
            {user?.name ? <span className="gradient-text">, {user.name.split(" ")[0]}</span> : null}
          </h1>
          <p style={{ fontSize: 14, color: t.textSecondary, margin: 0, lineHeight: 1.6, maxWidth: 540 }}>
            As an administrator, you create and manage candidate and examiner accounts, and oversee everything happening across the platform — from live assessments to the full audit trail.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            {/* <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 13px", borderRadius: 999, background: t.surfaceGlass, border: `1px solid ${t.border}` }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.success, boxShadow: `0 0 6px ${t.success}`, animation: "pulseDot 1.5s ease-in-out infinite" }} />
              <span style={{ fontSize: 12, color: t.textSecondary, fontWeight: 600 }}>All systems operational</span>
            </div> */}
            {/* <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 13px", borderRadius: 999, background: t.surfaceGlass, border: `1px solid ${t.border}` }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              <span style={{ fontSize: 12, color: t.textSecondary, fontWeight: 600 }}>Live sync every 4s</span>
            </div> */}
          </div>
        </div>
      </div>

      <div style={{ ...cardStyle, padding: 26, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: t.accentGradientSoft, opacity: 0.6 }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 10.5, color: t.textMuted, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Local Time</div>
          <div className="clock-gradient" style={{ fontSize: 48, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -2 }}>{timeText}</div>
          <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 8, fontWeight: 500 }}>
            {clock.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============= Main ============= */

export default function AdminPanel() {
  const { theme, toggleTheme } = useTheme();
  const t = THEMES[theme];

  const { user, accessToken } = useAuthStore();

  const [tab, setTab] = useState("Dashboard");
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [exams, setExams] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [examFilter, setExamFilter] = useState("all");
  const [examSearch, setExamSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ first_name: "", last_name: "", email: "", role: "Candidate" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [rowMessage, setRowMessage] = useState("");
  const [sendingEmailFor, setSendingEmailFor] = useState("");

  const headers = useMemo(() => (accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), [accessToken]);

  const loadStats = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await axios.get(`${API}/api/admin/stats`, { headers });
      setStats(res.data || {});
    } catch (e) {
      console.error("Failed to load stats", e?.response?.data || e.message);
      setStats({ total_candidates: 0, total_examiners: 0, active_assessments: 0, total_exams: 0 });
    }
  }, [accessToken, headers]);

  const loadUsers = useCallback(
    async (role) => {
      if (!accessToken) return;
      try {
        const res = await axios.get(`${API}/api/users?role=${role}`, { headers });
        setUsers(res.data || []);
        await loadStats();
      } catch (e) {
        console.error("Failed to load users", e?.response?.data || e.message);
        setUsers([]);
      }
    },
    [accessToken, headers, loadStats]
  );

  const loadExams = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await axios.get(`${API}/api/exams`, { headers });
      const rows = Array.isArray(res.data) ? res.data.map(normalizeExam).filter(Boolean) : [];
      setExams(rows);
    } catch (e) {
      console.error("Failed to load exams", e?.response?.data || e.message);
      setExams([]);
    }
  }, [accessToken, headers]);

  const loadAuditLogs = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await axios.get(`${API}/api/admin/audit-logs`, { headers });
      setAuditLogs(res.data || []);
    } catch (e) {
      console.error("Failed to load audit logs", e?.response?.data || e.message);
      setAuditLogs([]);
    }
  }, [accessToken, headers]);

  const refreshCurrentTab = useCallback(async () => {
    if (!accessToken) return;
    if (tab === "Dashboard") {
      await loadStats();
      await loadExams();
      await loadAuditLogs();
      return;
    }
    if (tab === "Candidates") {
      await loadUsers("Candidate");
      return;
    }
    if (tab === "Examiners") {
      await loadUsers("Examiner");
      return;
    }
    if (tab === "Exams") {
      await loadExams();
      await loadStats();
      return;
    }
    if (tab === "Audit Logs") {
      await loadAuditLogs();
      await loadStats();
    }
  }, [accessToken, tab, loadStats, loadUsers, loadExams, loadAuditLogs]);

  useEffect(() => {
    if (!accessToken) return;
    loadStats();
  }, [accessToken, loadStats]);

  useEffect(() => {
    if (!accessToken) return;
    setStatusFilter("all");
    setSearch("");
    setExamFilter("all");
    setExamSearch("");
    refreshCurrentTab();
  }, [tab, accessToken, refreshCurrentTab]);

  useEffect(() => {
    if (!accessToken) return;
    const interval = setInterval(() => {
      refreshCurrentTab();
    }, 4000);
    return () => clearInterval(interval);
  }, [accessToken, refreshCurrentTab]);

  const toggleUserStatus = useCallback(async (userId, currentStatus) => {
    const action = currentStatus === "Active" ? "disable" : "enable";
    try {
      await axios.post(`${API}/api/users/${userId}/${action}`, {}, { headers });
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === userId || u.userid === userId
            ? { ...u, status: action === "disable" ? "Disabled" : "Active" }
            : u
        )
      );
      await loadStats();
    } catch (e) {
      console.error("Failed to change user status", e?.response?.data || e.message);
      setRowMessage(extractErrorMessage(e, "Failed to change user status"));
      setTimeout(() => setRowMessage(""), 3000);
    }
  }, [headers, loadStats]);

  const resendPasswordEmail = useCallback(async (userId) => {
    if (!userId) return;
    setRowMessage("");
    setSendingEmailFor(userId);
    try {
      const res = await axios.post(`${API}/api/users/${userId}/send-password-email`, {}, { headers });
      setRowMessage(res.data?.message || "Password setup email sent successfully.");
    } catch (e) {
      console.error("Failed to resend password email", e?.response?.data || e.message);
      setRowMessage(extractErrorMessage(e, "Failed to send password setup email."));
    } finally {
      setSendingEmailFor("");
      setTimeout(() => setRowMessage(""), 3000);
    }
  }, [headers]);

  const createUser = async () => {
    setCreating(true);
    setCreateError("");
    setCreateSuccess("");

    if (!accessToken) {
      setCreateError("Authentication token is missing. Please sign in again.");
      setCreating(false);
      return;
    }
    if (!newUser.first_name.trim()) {
      setCreateError("First name is required");
      setCreating(false);
      return;
    }
    if (!newUser.last_name.trim()) {
      setCreateError("Last name is required");
      setCreating(false);
      return;
    }
    if (!newUser.email.trim()) {
      setCreateError("Email is required");
      setCreating(false);
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUser.email.trim())) {
      setCreateError("Please enter a valid email address");
      setCreating(false);
      return;
    }

    try {
      const fullName = `${newUser.first_name.trim()} ${newUser.last_name.trim()}`.trim();
      const res = await axios.post(
        `${API}/api/users`,
        { name: fullName, email: newUser.email.trim().toLowerCase(), role: newUser.role },
        { headers }
      );

      setCreateSuccess(res.data?.message || "User created successfully.");
      setNewUser({ first_name: "", last_name: "", email: "", role: tab === "Examiners" ? "Examiner" : "Candidate" });

      await loadStats();
      await loadUsers(tab === "Examiners" ? "Examiner" : "Candidate");

      setTimeout(() => {
        setShowCreate(false);
        setCreateSuccess("");
      }, 1200);
    } catch (e) {
      console.error("Create user failed", e?.response?.data || e.message);
      setCreateError(extractErrorMessage(e, "Failed to create user"));
    } finally {
      setCreating(false);
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (statusFilter === "active") return u.status === "Active";
    if (statusFilter === "disabled") return u.status !== "Active";
    return true;
  });

  const activeUsersCount = users.filter((u) => u.status === "Active").length;
  const disabledUsersCount = users.length - activeUsersCount;

  const totalUsers = (Number(stats.total_candidates) || 0) + (Number(stats.total_examiners) || 0);
  const candPct = totalUsers > 0 ? Math.round(((Number(stats.total_candidates) || 0) / totalUsers) * 100) : 0;
  const examPct = 100 - candPct;

  const examTotal = exams.length || Number(stats.total_exams) || 0;
  const completedExams = exams.filter((e) => String(e.status).toUpperCase() === "COMPLETED").length;
  const runningExams = exams.filter((e) => String(e.status).toUpperCase() === "RUNNING").length;
  const upcomingExams = exams.filter((e) => {
    const s = String(e.status).toUpperCase();
    return s === "PUBLISHED" || s === "DRAFT";
  }).length;

  const filteredExams = exams.filter((e) => {
    const q = examSearch.toLowerCase();
    const matchesSearch = !q || e.name?.toLowerCase().includes(q) || String(e.date).toLowerCase().includes(q);
    if (!matchesSearch) return false;
    const s = String(e.status).toUpperCase();
    if (examFilter === "running") return s === "RUNNING";
    if (examFilter === "published") return s === "PUBLISHED" || s === "DRAFT";
    if (examFilter === "completed") return s === "COMPLETED" || s === "TERMINATED";
    return true;
  });

  const TAB_ICONS = {
    Dashboard: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
    ),
    Candidates: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
    ),
    Examiners: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
    ),
    Exams: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 10h6M9 14h4" /></svg>
    ),
    "Audit Logs": (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
    ),
  };

  const inputStyle = (focused) => ({
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    fontSize: 14,
    color: t.textPrimary,
    background: t.inputBg,
    border: `1px solid ${focused ? t.accent : t.border}`,
    borderRadius: 10,
    outline: "none",
    fontFamily: "'Inter', sans-serif",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
  });

  const card = {
    background: t.cardSurface,
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: `1px solid ${t.border}`,
    borderRadius: 18,
    overflow: "hidden",
    boxShadow: t.name === "light" ? "0 6px 20px rgba(20,28,60,0.07)" : "none",
  };

  const th = {
    padding: "13px 16px",
    textAlign: "left",
    fontSize: 11,
    color: t.textMuted,
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  };

  const sectionHeading = (title) => (
    <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textPrimary, textTransform: "uppercase", letterSpacing: 0.6, display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
      <span style={{ display: "inline-block", width: 20, height: 2, borderRadius: 2, background: t.accentGradient }} />
      {title}
    </div>
  );

  const recentLogs = auditLogs.slice(0, 6);

  const statusChips = [
    { key: "all", label: "All", count: users.length, color: t.accent },
    { key: "active", label: "Active", count: activeUsersCount, color: t.success },
    { key: "disabled", label: "Disabled", count: disabledUsersCount, color: t.danger },
  ];

  const examChips = [
    { key: "all", label: "All", count: exams.length, color: t.accent },
    { key: "running", label: "Running", count: runningExams, color: t.success },
    { key: "published", label: "Upcoming", count: upcomingExams, color: t.info },
    { key: "completed", label: "Completed", count: exams.filter((e) => ["COMPLETED", "TERMINATED"].includes(String(e.status).toUpperCase())).length, color: t.textSecondary },
  ];

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
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cardEnter { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes modalEnter { from { opacity: 0; transform: translateY(12px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes gradientShift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes pulseDot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.4); } }
        @keyframes floatBlob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(28px, -20px) scale(1.06); }
          66% { transform: translate(-20px, 26px) scale(0.95); }
        }
        @keyframes shine { 0% { transform: translateX(-120%) skewX(-20deg); } 100% { transform: translateX(220%) skewX(-20deg); } }
        .cta-shine::before { content: ""; position: absolute; top: 0; left: 0; bottom: 0; width: 40%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent); transform: translateX(-120%) skewX(-20deg); pointer-events: none; }
        .cta-shine:hover::before { animation: shine 0.9s ease; }
        ::-webkit-scrollbar { width: 9px; height: 9px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${t.borderStrong}; border-radius: 999px; }
        ::-webkit-scrollbar-thumb:hover { background: ${t.accent}; }
        .brand-gradient { background: ${t.accentGradient}; background-size: 200% 200%; animation: gradientShift 8s ease infinite; }
        .gradient-text { background: ${t.accentGradient}; background-size: 200% 200%; animation: gradientShift 6s ease infinite; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; display: inline-block; }
        .clock-gradient { background: ${t.accentGradient}; background-size: 200% 200%; animation: gradientShift 6s ease infinite; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; display: inline-block; line-height: 1; }
        .row-hover:hover { background: ${t.rowHover}; }
        input::placeholder { color: ${t.textMuted}; opacity: 0.85; }
        button, a, input { transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, opacity 0.2s ease; }
      `}</style>

      <div style={{ position: "absolute", top: "-10%", left: "-8%", width: 480, height: 480, borderRadius: "50%", background: `radial-gradient(circle, ${t.accent}22 0%, transparent 65%)`, filter: "blur(50px)", animation: "floatBlob 24s ease-in-out infinite", pointerEvents: "none", willChange: "transform", transform: "translateZ(0)" }} />
      <div style={{ position: "absolute", bottom: "-14%", right: "-10%", width: 560, height: 560, borderRadius: "50%", background: `radial-gradient(circle, ${t.accent3}18 0%, transparent 65%)`, filter: "blur(60px)", animation: "floatBlob 30s ease-in-out infinite", pointerEvents: "none", willChange: "transform", transform: "translateZ(0)" }} />

      {/* Top bar */}
      <header
        style={{
          height: 64,
          padding: "0 26px",
          display: "flex",
          alignItems: "center",
          gap: 14,
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
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: t.textPrimary, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.3 }}>3rdEyeZ360</span>
          <span style={{ fontSize: 10.5, color: t.textMuted, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 600 }}>Admin Panel</span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {user?.name && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 14px 5px 5px", borderRadius: 999, background: t.surfaceGlass, border: `1px solid ${t.border}` }}>
              <div className="brand-gradient" style={{ width: 30, height: 30, borderRadius: "50%", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                {String(user.name).charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 13, color: t.textPrimary, fontWeight: 600 }}>{user.name}</span>
            </div>
          )}
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <LogoutButton theme={theme} />
        </div>
      </header>

      {/* Tabs */}
      <div
        style={{
          minHeight: 50,
          padding: "8px 26px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
          borderBottom: `1px solid ${t.border}`,
          background: t.surface,
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          position: "relative",
          zIndex: 9,
          flexWrap: "wrap",
        }}
      >
        {TABS.map((tabName) => {
          const active = tab === tabName;
          return (
            <button
              key={tabName}
              onClick={() => setTab(tabName)}
              style={{
                height: 34,
                padding: "0 15px",
                borderRadius: 10,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: active ? t.accentSoft : "transparent",
                color: active ? t.accent : t.textSecondary,
                border: active ? `1px solid ${t.borderAccent}` : "1px solid transparent",
                fontFamily: "'Inter', sans-serif",
                transition: "all 0.2s ease",
              }}
            >
              {TAB_ICONS[tabName]}
              {tabName}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "26px", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          {/* ---------------- Dashboard ---------------- */}
          {tab === "Dashboard" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <HeroSection theme={theme} user={user} />

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <StatOrb theme={theme} label="Total Candidates" value={stats.total_candidates} color={t.accent} gradient={t.accentGradient}
                  icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>} />
                <StatOrb theme={theme} label="Total Examiners" value={stats.total_examiners} color={t.success} gradient={t.successGradient}
                  icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>} />
                <StatOrb theme={theme} label="Total Exams" value={examTotal} color={t.warning} gradient={t.warningGradient}
                  icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 10h6M9 14h4" /></svg>} />
                <StatOrb theme={theme} label="Active Assessments" value={stats.active_assessments} color={t.danger} gradient={t.dangerGradient}
                  icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" fill="currentColor" /></svg>} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.2fr)", gap: 20 }}>
                {/* Exam completion visual */}
                <div style={{ ...card, padding: 22, display: "flex", flexDirection: "column" }}>
                  {sectionHeading("Exam Completion")}
                  <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                    <RingProgress value={completedExams} total={Math.max(examTotal, 1)} color={t.success} size={104} stroke={9} theme={theme} showPct />
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: t.textPrimary, fontFamily: "'Space Grotesk', sans-serif" }}>{completedExams}<span style={{ fontSize: 13, color: t.textMuted, fontWeight: 500 }}> / {examTotal}</span></div>
                        <div style={{ fontSize: 11.5, color: t.textMuted }}>exams completed</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 7, color: t.textSecondary, fontWeight: 600 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: t.success }} /> Completed · {completedExams}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 7, color: t.textSecondary, fontWeight: 600 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: t.info }} /> Upcoming · {upcomingExams}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 7, color: t.textSecondary, fontWeight: 600 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: t.warning }} /> Running · {runningExams}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden", border: `1px solid ${t.border}`, marginTop: 18 }}>
                    <div style={{ width: `${examTotal ? (completedExams / examTotal) * 100 : 0}%`, background: t.successGradient, transition: "width 0.6s ease" }} />
                    <div style={{ width: `${examTotal ? (upcomingExams / examTotal) * 100 : 0}%`, background: `linear-gradient(135deg, ${t.info}, ${t.accent2})`, transition: "width 0.6s ease" }} />
                    <div style={{ width: `${examTotal ? (runningExams / examTotal) * 100 : 0}%`, background: t.warningGradient, transition: "width 0.6s ease" }} />
                  </div>
                  <div style={{ marginTop: "auto", paddingTop: 14 }}>
                    <GhostButton theme={theme} onClick={() => setTab("Exams")} style={{ width: "100%", justifyContent: "center" }}>View all exams</GhostButton>
                  </div>
                </div>

                {/* User distribution */}
                <div style={{ ...card, padding: 22 }}>
                  {sectionHeading("User Distribution")}
                  <div style={{ fontSize: 32, fontWeight: 800, color: t.textPrimary, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -1, marginBottom: 4 }}>{totalUsers}</div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 18 }}>total users on the platform</div>
                  <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", border: `1px solid ${t.border}`, marginBottom: 16 }}>
                    <div style={{ width: `${candPct}%`, background: t.accentGradient, transition: "width 0.6s ease" }} />
                    <div style={{ width: `${examPct}%`, background: t.successGradient, transition: "width 0.6s ease" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: t.textSecondary, fontWeight: 600 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: t.accent }} /> Candidates</span>
                      <span style={{ fontSize: 13, color: t.textPrimary, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>{stats.total_candidates ?? 0} · {candPct}%</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: t.textSecondary, fontWeight: 600 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: t.success }} /> Examiners</span>
                      <span style={{ fontSize: 13, color: t.textPrimary, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>{stats.total_examiners ?? 0} · {examPct}%</span>
                    </div>
                  </div>
                </div>

                {/* Recent activity */}
                <div style={{ ...card, padding: 22 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    {sectionHeading("Recent Activity")}
                    <GhostButton theme={theme} onClick={() => setTab("Audit Logs")} style={{ padding: "6px 12px", fontSize: 12, marginBottom: 14 }}>View all</GhostButton>
                  </div>
                  {recentLogs.length === 0 ? (
                    <div style={{ color: t.textMuted, fontSize: 13, padding: "20px 0", textAlign: "center" }}>No recent activity.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {recentLogs.map((log, i) => (
                        <div key={log.log_id || log.audit_id || i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "9px 4px", borderBottom: i < recentLogs.length - 1 ? `1px solid ${t.border}` : "none" }}>
                          <div style={{ width: 28, height: 28, borderRadius: 9, background: t.accentSoft, border: `1px solid ${t.borderAccent}`, color: t.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, color: t.textPrimary, fontWeight: 600 }}>{safeText(log.action) || "Action"}</div>
                            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {safeText(log.user_id || log.userid || "System")}{log.reason ? ` — ${safeText(log.reason)}` : ""}
                            </div>
                          </div>
                          <div style={{ fontSize: 10.5, color: t.textMuted, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0, marginTop: 2 }}>
                            {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ---------------- Candidates / Examiners (CARDS) ---------------- */}
          {(tab === "Candidates" || tab === "Examiners") && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 700, color: t.textPrimary, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.5, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                    {tab}
                    <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: t.surfaceGlass, border: `1px solid ${t.border}` }}>
                      {filtered.length}{filtered.length !== users.length ? ` of ${users.length}` : ""}
                    </span>
                  </h2>
                  <p style={{ fontSize: 12.5, color: t.textMuted, margin: "4px 0 0" }}>Create, search and manage {tab.toLowerCase()}.</p>
                </div>
                <GradientButton
                  theme={theme}
                  onClick={() => {
                    setShowCreate(true);
                    setCreateError("");
                    setCreateSuccess("");
                    setNewUser({ first_name: "", last_name: "", email: "", role: tab === "Examiners" ? "Examiner" : "Candidate" });
                  }}
                  style={{ padding: "10px 18px" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  Create {tab === "Examiners" ? "Examiner" : "Candidate"}
                </GradientButton>
              </div>

              {rowMessage && (
                <div style={{ background: t.successBg, color: t.success, border: `1px solid ${t.success}44`, borderRadius: 12, padding: "10px 14px", fontSize: 13, marginBottom: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  {safeText(rowMessage)}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
                <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 420 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={searchFocused ? t.accent : t.textMuted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", transition: "stroke 0.25s ease", pointerEvents: "none" }}>
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    placeholder={`Search ${tab.toLowerCase()} by name or email...`}
                    style={{ ...inputStyle(searchFocused), paddingLeft: 40, borderRadius: 12, boxShadow: searchFocused ? `0 0 0 3px ${t.accentSoft}` : "none" }}
                  />
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {statusChips.map((c) => {
                    const active = statusFilter === c.key;
                    return (
                      <button
                        key={c.key}
                        onClick={() => setStatusFilter(c.key)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 13px", fontSize: 12, fontWeight: 700, borderRadius: 999, border: `1px solid ${active ? "transparent" : t.border}`, background: active ? `linear-gradient(135deg, ${c.color} 0%, ${c.color}cc 100%)` : t.surfaceGlass, color: active ? "#ffffff" : t.textSecondary, cursor: "pointer", fontFamily: "'Inter', sans-serif", boxShadow: active ? `0 4px 12px ${c.color}55` : "none", transition: "all 0.25s ease" }}
                        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = t.surfaceGlassHover; }}
                        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = t.surfaceGlass; }}
                      >
                        {c.label}
                        <span style={{ fontSize: 10.5, padding: "1px 7px", borderRadius: 999, background: active ? "rgba(255,255,255,0.28)" : t.surfaceGlassHover, color: active ? "#ffffff" : t.textMuted, fontWeight: 800, minWidth: 18, textAlign: "center" }}>{c.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {filtered.length === 0 ? (
                <div style={{ ...card, padding: "48px 24px", textAlign: "center", color: t.textMuted, fontSize: 14, border: `1px dashed ${t.borderStrong}` }}>
                  {users.length === 0 ? `No ${tab.toLowerCase()} yet.` : "No results match your search or filter."}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                  {filtered.map((u) => (
                    <UserCard
                      key={u.user_id || u.userid}
                      u={u}
                      theme={theme}
                      onToggleStatus={toggleUserStatus}
                      onResendEmail={resendPasswordEmail}
                      sendingEmailFor={sendingEmailFor}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ---------------- Exams ---------------- */}
          {tab === "Exams" && (
            <div>
              <div style={{ marginBottom: 18 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: t.textPrimary, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.5, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                  Exams
                  <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: t.surfaceGlass, border: `1px solid ${t.border}` }}>
                    {filteredExams.length}{filteredExams.length !== exams.length ? ` of ${exams.length}` : ""}
                  </span>
                </h2>
                <p style={{ fontSize: 12.5, color: t.textMuted, margin: "4px 0 0" }}>Overview of every exam on the platform and its current status.</p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
                <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 420 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    value={examSearch}
                    onChange={(e) => setExamSearch(e.target.value)}
                    placeholder="Search exams by name or date..."
                    style={{ ...inputStyle(false), paddingLeft: 40, borderRadius: 12 }}
                    onFocus={(e) => { e.target.style.borderColor = t.accent; e.target.style.boxShadow = `0 0 0 3px ${t.accentSoft}`; }}
                    onBlur={(e) => { e.target.style.borderColor = t.border; e.target.style.boxShadow = "none"; }}
                  />
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {examChips.map((c) => {
                    const active = examFilter === c.key;
                    return (
                      <button
                        key={c.key}
                        onClick={() => setExamFilter(c.key)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 13px", fontSize: 12, fontWeight: 700, borderRadius: 999, border: `1px solid ${active ? "transparent" : t.border}`, background: active ? `linear-gradient(135deg, ${c.color} 0%, ${c.color}cc 100%)` : t.surfaceGlass, color: active ? "#ffffff" : t.textSecondary, cursor: "pointer", fontFamily: "'Inter', sans-serif", boxShadow: active ? `0 4px 12px ${c.color}55` : "none", transition: "all 0.25s ease" }}
                        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = t.surfaceGlassHover; }}
                        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = t.surfaceGlass; }}
                      >
                        {c.label}
                        <span style={{ fontSize: 10.5, padding: "1px 7px", borderRadius: 999, background: active ? "rgba(255,255,255,0.28)" : t.surfaceGlassHover, color: active ? "#ffffff" : t.textMuted, fontWeight: 800, minWidth: 18, textAlign: "center" }}>{c.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {filteredExams.length === 0 ? (
                <div style={{ ...card, padding: "48px 24px", textAlign: "center", color: t.textMuted, fontSize: 14, border: `1px dashed ${t.borderStrong}` }}>
                  {exams.length === 0 ? "No exams created yet." : "No exams match your search or filter."}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
                  {filteredExams.map((exam, i) => (
                    <ExamCard key={exam.examid || i} exam={exam} theme={theme} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ---------------- Audit Logs ---------------- */}
          {tab === "Audit Logs" && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, color: t.textPrimary, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.5 }}>Audit Logs</h2>
              <div style={card}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                    <thead>
                      <tr style={{ background: t.tableHead, borderBottom: `1px solid ${t.border}` }}>
                        {["Timestamp", "User", "Action", "Reason"].map((h) => (
                          <th key={h} style={th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log, i) => (
                        <tr key={log.log_id || log.audit_id || i} className="row-hover" style={{ borderBottom: i < auditLogs.length - 1 ? `1px solid ${t.border}` : "none" }}>
                          <td style={{ padding: "12px 16px", fontSize: 12, color: t.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
                            {log.timestamp ? new Date(log.timestamp).toLocaleString() : "—"}
                          </td>
                          <td style={{ padding: "12px 16px", fontSize: 13, color: t.textPrimary, fontFamily: "'JetBrains Mono', monospace" }}>
                            {safeText(log.user_id || log.userid || "—")}
                          </td>
                          <td style={{ padding: "12px 16px", fontSize: 13 }}>
                            <span style={{ color: t.accent, fontWeight: 600 }}>{safeText(log.action)}</span>
                          </td>
                          <td style={{ padding: "12px 16px", fontSize: 12.5, color: t.textSecondary }}>
                            {safeText(log.reason || "—")}
                          </td>
                        </tr>
                      ))}
                      {auditLogs.length === 0 && (
                        <tr>
                          <td colSpan={4} style={{ padding: 44, textAlign: "center", color: t.textMuted, fontSize: 13.5 }}>
                            No audit logs yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---------------- Create User Modal ---------------- */}
      {showCreate && (
        <div
          onMouseDown={(e) => { if (e.target === e.currentTarget && !creating) setShowCreate(false); }}
          style={{ position: "fixed", inset: 0, background: t.overlay, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20, animation: "fadeIn 0.2s ease" }}
        >
          <div style={{ width: "100%", maxWidth: 440, background: t.surfaceElevated, backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: `1px solid ${t.borderStrong}`, borderRadius: 20, padding: 28, boxShadow: "0 30px 80px rgba(0,0,0,0.45)", animation: "modalEnter 0.24s cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
            <h3 style={{ fontSize: 19, fontWeight: 700, marginBottom: 6, color: t.textPrimary, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.3 }}>Create {newUser.role}</h3>
            <div style={{ fontSize: 12.5, color: t.textMuted, marginBottom: 20, lineHeight: 1.5 }}>The user will receive an email to set their password.</div>

            {createError && (
              <div style={{ background: t.dangerBg, color: t.danger, border: `1px solid ${t.danger}55`, borderRadius: 10, padding: "10px 12px", fontSize: 12.5, marginBottom: 14, display: "flex", gap: 8, alignItems: "flex-start", fontWeight: 600 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                {safeText(createError)}
              </div>
            )}

            {createSuccess && (
              <div style={{ background: t.successBg, color: t.success, border: `1px solid ${t.success}55`, borderRadius: 10, padding: "10px 12px", fontSize: 12.5, marginBottom: 14, display: "flex", gap: 8, alignItems: "center", fontWeight: 600 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                {safeText(createSuccess)}
              </div>
            )}

            {[
              ["First Name", "first_name", "text", ""],
              ["Last Name", "last_name", "text", ""],
              ["Email", "email", "email", ""],
            ].map(([label, key, type, ph]) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: t.textMuted, display: "block", marginBottom: 6, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</label>
                <input
                  type={type}
                  value={newUser[key]}
                  onChange={(e) => setNewUser((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={ph}
                  style={inputStyle(false)}
                  onFocus={(e) => { e.target.style.borderColor = t.accent; e.target.style.boxShadow = `0 0 0 3px ${t.accentSoft}`; }}
                  onBlur={(e) => { e.target.style.borderColor = t.border; e.target.style.boxShadow = "none"; }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 4 }}>
              <label style={{ fontSize: 11, color: t.textMuted, display: "block", marginBottom: 6, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>Role</label>
              <input type="text" value={newUser.role} disabled style={{ ...inputStyle(false), background: t.surfaceGlass, color: t.textMuted, cursor: "not-allowed" }} />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button
                onClick={() => setShowCreate(false)}
                disabled={creating}
                style={{ flex: 1, padding: "11px 0", fontSize: 13.5, fontWeight: 700, borderRadius: 11, background: t.surfaceGlass, color: t.textSecondary, border: `1px solid ${t.borderStrong}`, cursor: creating ? "not-allowed" : "pointer", fontFamily: "'Inter', sans-serif" }}
              >
                Cancel
              </button>
              <GradientButton theme={theme} onClick={createUser} disabled={creating} style={{ flex: 1, padding: "11px 0" }}>
                {creating ? (
                  <>
                    <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                    Creating...
                  </>
                ) : (
                  "Create User"
                )}
              </GradientButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}