import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import useAuthStore from "../../store/authStore";

const API = "http://localhost:3000";
const THEME_STORAGE_KEY = "3rdeyez360.theme";

/* ============= Theme system ============= */

const THEMES = {
  dark: {
    name: "dark",
    canvas: "#07080d",
    canvasTint:
      "radial-gradient(ellipse at top left, #10152a 0%, #07080d 50%), radial-gradient(ellipse at bottom right, #1a0f2e 0%, #07080d 60%)",
    surface: "rgba(22, 26, 40, 0.72)",
    surfaceElevated: "rgba(30, 34, 50, 0.85)",
    surfaceGlass: "rgba(255, 255, 255, 0.03)",
    surfaceGlassHover: "rgba(255, 255, 255, 0.055)",
    cardSurface: "rgba(28, 32, 48, 0.72)",
    cardSurfaceHover: "rgba(34, 38, 56, 0.82)",
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
    successBg: "rgba(62,207,142,0.12)",
    danger: "#ef6a6a",
    dangerGradient: "linear-gradient(135deg, #ff7a7a 0%, #d94a4a 100%)",
    dangerBg: "rgba(239,106,106,0.12)",
    glowAccent: "0 8px 32px rgba(91,140,255,0.28), 0 0 60px rgba(160,101,255,0.15)",
    glowSuccess: "0 6px 24px rgba(62,207,142,0.28)",
    inputBg: "rgba(255,255,255,0.04)",
    inputReadonly: "rgba(255,255,255,0.02)",
  },
  light: {
    name: "light",
    canvas: "#eef1fb",
    canvasTint:
      "radial-gradient(ellipse at top left, #dbe4ff 0%, #eef1fb 45%), radial-gradient(ellipse at bottom right, #ffd9ec 0%, #eef1fb 55%)",
    surface: "rgba(255, 255, 255, 0.85)",
    surfaceElevated: "rgba(255, 255, 255, 0.94)",
    surfaceGlass: "rgba(255, 255, 255, 0.6)",
    surfaceGlassHover: "rgba(255, 255, 255, 0.85)",
    cardSurface: "#ffffff",
    cardSurfaceHover: "#fbfcff",
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
    danger: "#dc2626",
    dangerGradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    dangerBg: "rgba(220,38,38,0.12)",
    glowAccent: "0 12px 40px rgba(75,96,232,0.25), 0 0 60px rgba(124,58,237,0.15)",
    glowSuccess: "0 8px 28px rgba(14,165,100,0.28)",
    inputBg: "#ffffff",
    inputReadonly: "#f2f4fa",
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

function BackButton({ theme, onClick }) {
  const t = THEMES[theme];
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px 8px 10px",
        borderRadius: 12,
        background: hover ? t.surfaceGlassHover : t.surfaceGlass,
        border: `1px solid ${hover ? t.borderStrong : t.border}`,
        color: t.textSecondary,
        cursor: "pointer",
        fontFamily: "'Inter', sans-serif",
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: 0.2,
        transition: "all 0.25s ease",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: hover ? "translateX(-2px)" : "translateX(0)", transition: "transform 0.25s ease" }}>
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
      Back
    </button>
  );
}

/* ============= Date/time helpers (unchanged logic) ============= */

const defaultForm = {
  name: "",
  description: "",
  date: "",
  start_time: "",
  end_time: "",
  duration_minutes: 0,
  violation_threshold: 10,
  instructions: "",
  allowed_websites: [],
  allowed_applications: [],
};

const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const nowTimeStr = () => {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
};

const calculateDuration = (start, end) => {
  if (!start || !end) return 0;
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  return endMinutes > startMinutes ? endMinutes - startMinutes : 0;
};

/* ============= Field + section helpers ============= */

function Field({ label, error, children, theme, hint }) {
  const t = THEMES[theme];
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ fontSize: 11, color: t.textMuted, display: "block", marginBottom: 7, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase" }}>
        {label}
      </label>
      {children}
      {hint && !error && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 5 }}>{hint}</div>}
      {error && <div style={{ fontSize: 11, color: t.danger, marginTop: 5, fontWeight: 500 }}>{error}</div>}
    </div>
  );
}

function SectionCard({ title, children, theme, danger }) {
  const t = THEMES[theme];
  return (
    <div
      style={{
        background: t.cardSurface,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: `1px solid ${danger ? t.danger + "55" : t.border}`,
        borderRadius: 18,
        padding: 24,
        marginBottom: 20,
        boxShadow: t.name === "light" ? "0 6px 20px rgba(20,28,60,0.07)" : "0 4px 20px rgba(0,0,0,0.12)",
        transition: "background 0.55s ease, border-color 0.4s ease, box-shadow 0.5s ease",
      }}
    >
      {title}
      {children}
    </div>
  );
}

function SectionHeading({ children, theme, desc }) {
  const t = THEMES[theme];
  return (
    <div style={{ marginBottom: desc ? 14 : 18 }}>
      <div
        style={{
          fontSize: 10.5,
          color: t.textMuted,
          fontWeight: 700,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ display: "inline-block", width: 20, height: 1, background: t.accentGradient }} />
        {children}
      </div>
      {desc && <p style={{ fontSize: 12, color: t.textMuted, margin: "10px 0 0", lineHeight: 1.55 }}>{desc}</p>}
    </div>
  );
}

export default function CreateExam({ onBack, onCreated }) {
  const { theme, toggleTheme } = useTheme();
  const t = THEMES[theme];

  const { user, accessToken } = useAuthStore();
  const [form, setForm] = useState(defaultForm);
  const [websiteInput, setWebsiteInput] = useState("");
  const [appInput, setAppInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);
  const [focusField, setFocusField] = useState("");

  const headers = { Authorization: `Bearer ${accessToken}` };

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const inputStyle = (name) => ({
    background: t.inputBg,
    border: `1px solid ${focusField === name ? t.accent : t.border}`,
    borderRadius: 10,
    padding: "10px 12px",
    color: t.textPrimary,
    fontSize: 14,
    width: "100%",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "'Inter', sans-serif",
    boxShadow: focusField === name ? `0 0 0 3px ${t.accentSoft}` : "none",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease, background 0.5s ease",
  });

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Exam name is required";

    if (!form.date) {
      e.date = "Date is required";
    } else if (form.date < todayStr()) {
      e.date = "Date cannot be in the past";
    }

    if (!form.start_time) e.start_time = "Start time is required";
    if (!form.end_time) e.end_time = "End time is required";

    if (form.start_time && form.end_time && form.end_time <= form.start_time) {
      e.end_time = "End time must be after start time";
    }

    if (form.date === todayStr() && form.start_time && form.start_time < nowTimeStr()) {
      e.start_time = "Start time cannot be in the past";
    }

    if (form.duration_minutes < 1) e.duration_minutes = "Duration must be at least 1 minute";
    if (form.violation_threshold < 1) e.violation_threshold = "Violation threshold must be at least 1";
    if (form.allowed_websites.length === 0) e.websites = "Add at least one allowed website";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const addWebsite = () => {
    if (!websiteInput.trim()) return;
    let url = websiteInput.trim();
    if (!url.startsWith("http")) url = `https://${url}`;
    if (!form.allowed_websites.includes(url)) {
      set("allowed_websites", [...form.allowed_websites, url]);
    }
    setWebsiteInput("");
  };

  const removeWebsite = (url) => {
    set("allowed_websites", form.allowed_websites.filter((w) => w !== url));
  };

  const addApp = () => {
    if (!appInput.trim()) return;
    const value = appInput.trim();
    if (!form.allowed_applications.includes(value)) {
      set("allowed_applications", [...form.allowed_applications, value]);
    }
    setAppInput("");
  };

  const removeApp = (app) => {
    set("allowed_applications", form.allowed_applications.filter((a) => a !== app));
  };

  const handleSave = async (status = "Published") => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await axios.post(
        `${API}/api/exams`,
        {
          ...form,
          duration_minutes: calculateDuration(form.start_time, form.end_time),
          examiner_id: user.user_id,
          status,
        },
        { headers }
      );
      setSaved(true);
      setTimeout(() => onCreated?.(res.data), 1200);
    } catch (e) {
      setErrors({ submit: e.response?.data?.detail || "Failed to create exam" });
    } finally {
      setLoading(false);
    }
  };

  const globalStyle = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes popIn { 0% { opacity: 0; transform: scale(0.5); } 70% { opacity: 1; transform: scale(1.12); } 100% { opacity: 1; transform: scale(1); } }
      @keyframes ringPulse { 0% { transform: scale(0.9); opacity: 0.7; } 100% { transform: scale(1.7); opacity: 0; } }
      @keyframes cardEnter { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes gradientShift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
      @keyframes floatBlob {
        0%, 100% { transform: translate(0, 0) scale(1); }
        33% { transform: translate(24px, -18px) scale(1.05); }
        66% { transform: translate(-18px, 20px) scale(0.96); }
      }
      ::-webkit-scrollbar { width: 9px; height: 9px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: ${t.borderStrong}; border-radius: 999px; }
      ::-webkit-scrollbar-thumb:hover { background: ${t.accent}; }
      .brand-gradient { background: ${t.accentGradient}; background-size: 200% 200%; animation: gradientShift 8s ease infinite; }
      button, a, input, textarea { transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, opacity 0.2s ease; }
      input[type="date"]::-webkit-calendar-picker-indicator,
      input[type="time"]::-webkit-calendar-picker-indicator {
        filter: ${t.name === "dark" ? "invert(0.7)" : "invert(0.3)"};
        cursor: pointer;
      }
    `}</style>
  );

  if (saved) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: t.canvas,
          backgroundImage: t.canvasTint,
          color: t.textPrimary,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          transition: "background 0.7s ease, color 0.6s ease",
        }}
      >
        {globalStyle}
        <div style={{ position: "relative", width: 100, height: 100, marginBottom: 24 }}>
          <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${t.success}`, opacity: 0.55, animation: "ringPulse 2s ease-out infinite" }} />
          <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${t.success}`, opacity: 0.35, animation: "ringPulse 2s ease-out 0.7s infinite" }} />
          <div style={{ position: "absolute", inset: 12, borderRadius: "50%", background: t.successGradient, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: t.glowSuccess, animation: "popIn 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55)" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.4, margin: 0 }}>Exam Created</h2>
        <p style={{ color: t.textMuted, marginTop: 8 }}>Redirecting to exam list...</p>
      </div>
    );
  }

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
      }}
    >
      {globalStyle}

      <div style={{ position: "absolute", top: "-10%", left: "-8%", width: 460, height: 460, borderRadius: "50%", background: `radial-gradient(circle, ${t.accent}22 0%, transparent 65%)`, filter: "blur(50px)", animation: "floatBlob 24s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-14%", right: "-10%", width: 540, height: 540, borderRadius: "50%", background: `radial-gradient(circle, ${t.accent3}18 0%, transparent 65%)`, filter: "blur(60px)", animation: "floatBlob 30s ease-in-out infinite", pointerEvents: "none" }} />

      {/* Header */}
      <header
        style={{
          minHeight: 64,
          background: t.surface,
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderBottom: `1px solid ${t.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          gap: 14,
          flexShrink: 0,
          position: "relative",
          zIndex: 10,
          transition: "background 0.55s ease, border-color 0.5s ease",
        }}
      >
        <BackButton theme={theme} onClick={onBack} />
        <div style={{ width: 1, height: 24, background: t.border }} />
        <span style={{ fontWeight: 700, fontSize: 15, color: t.textPrimary, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.2 }}>
          Create New Exam
        </span>
        <div style={{ marginLeft: "auto" }}>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "28px 24px 40px", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 700, margin: "0 auto", animation: "cardEnter 0.5s ease" }}>
          {errors.submit && (
            <div
              style={{
                background: t.dangerBg,
                border: `1px solid ${t.danger}55`,
                borderRadius: 12,
                padding: "12px 16px",
                color: t.danger,
                fontSize: 13,
                marginBottom: 20,
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
              <span>{errors.submit}</span>
            </div>
          )}

          {/* Basic Information */}
          <SectionCard theme={theme} title={<SectionHeading theme={theme}>Basic Information</SectionHeading>}>
            <Field label="Exam Name *" error={errors.name} theme={theme}>
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                onFocus={() => setFocusField("name")}
                onBlur={() => setFocusField("")}
                placeholder="e.g. Java Technical Assessment"
                style={inputStyle("name")}
              />
            </Field>

            <Field label="Description" theme={theme}>
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                onFocus={() => setFocusField("description")}
                onBlur={() => setFocusField("")}
                rows={3}
                placeholder="Brief description of this exam..."
                style={{ ...inputStyle("description"), resize: "vertical", lineHeight: 1.6 }}
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <Field label="Date *" error={errors.date} theme={theme}>
                <input
                  type="date"
                  value={form.date}
                  min={todayStr()}
                  onFocus={() => setFocusField("date")}
                  onBlur={() => setFocusField("")}
                  onChange={(e) => {
                    const val = e.target.value;
                    set("date", val);
                    setErrors((prev) => ({
                      ...prev,
                      date: val && val < todayStr() ? "Date cannot be in the past" : undefined,
                      start_time:
                        val === todayStr() && form.start_time && form.start_time < nowTimeStr()
                          ? "Start time cannot be in the past"
                          : undefined,
                    }));
                  }}
                  style={inputStyle("date")}
                />
              </Field>

              <Field label="Start Time *" error={errors.start_time} theme={theme}>
                <input
                  type="time"
                  value={form.start_time}
                  min={form.date === todayStr() ? nowTimeStr() : undefined}
                  onFocus={() => setFocusField("start_time")}
                  onBlur={() => setFocusField("")}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      start_time: val,
                      duration_minutes: calculateDuration(val, prev.end_time),
                    }));
                    setErrors((prev) => ({
                      ...prev,
                      start_time:
                        form.date === todayStr() && val && val < nowTimeStr()
                          ? "Start time cannot be in the past"
                          : undefined,
                      end_time:
                        form.end_time && val && form.end_time <= val
                          ? "End time must be after start time"
                          : undefined,
                    }));
                  }}
                  style={inputStyle("start_time")}
                />
              </Field>

              <Field label="End Time *" error={errors.end_time} theme={theme}>
                <input
                  type="time"
                  value={form.end_time}
                  min={form.start_time || undefined}
                  onFocus={() => setFocusField("end_time")}
                  onBlur={() => setFocusField("")}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      end_time: val,
                      duration_minutes: calculateDuration(prev.start_time, val),
                    }));
                    setErrors((prev) => ({
                      ...prev,
                      end_time:
                        form.start_time && val && val <= form.start_time
                          ? "End time must be after start time"
                          : undefined,
                    }));
                  }}
                  style={inputStyle("end_time")}
                />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label="Duration (minutes)" error={errors.duration_minutes} theme={theme} hint="Auto-calculated from Start Time and End Time">
                <input
                  type="number"
                  value={form.duration_minutes}
                  readOnly
                  tabIndex={-1}
                  style={{
                    ...inputStyle("duration"),
                    background: t.inputReadonly,
                    cursor: "not-allowed",
                    opacity: 0.85,
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                  }}
                />
              </Field>

              <Field label="Violation Threshold" error={errors.violation_threshold} theme={theme} hint="Assessment locks when total risk score reaches this number">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.violation_threshold}
                  onFocus={() => setFocusField("vt")}
                  onBlur={() => setFocusField("")}
                  onChange={(e) => set("violation_threshold", parseInt(e.target.value, 10) || 10)}
                  style={inputStyle("vt")}
                />
              </Field>
            </div>
          </SectionCard>

          {/* Allowed Websites */}
          <SectionCard
            theme={theme}
            danger={!!errors.websites}
            title={
              <SectionHeading theme={theme} desc="Candidates can only visit these websites during the exam. Add the exam platform + login page.">
                Allowed Websites *
              </SectionHeading>
            }
          >
            {errors.websites && (
              <div style={{ fontSize: 11, color: t.danger, marginBottom: 12, fontWeight: 500 }}>{errors.websites}</div>
            )}

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input
                value={websiteInput}
                onChange={(e) => setWebsiteInput(e.target.value)}
                onFocus={() => setFocusField("web")}
                onBlur={() => setFocusField("")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addWebsite();
                  }
                }}
                placeholder="exam.company.com"
                style={{ ...inputStyle("web"), flex: 1 }}
              />
              <button
                onClick={addWebsite}
                style={{
                  padding: "10px 18px",
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 10,
                  background: t.accentGradient,
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                  boxShadow: t.glowAccent,
                }}
              >
                Add
              </button>
            </div>

            {form.allowed_websites.length === 0 ? (
              <div style={{ fontSize: 12, color: t.textMuted, padding: "6px 0" }}>No websites added yet.</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {form.allowed_websites.map((url) => (
                  <div
                    key={url}
                    style={{
                      background: t.successBg,
                      border: `1px solid ${t.success}55`,
                      borderRadius: 999,
                      padding: "5px 8px 5px 12px",
                      fontSize: 12,
                      color: t.success,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 600,
                    }}
                  >
                    {url}
                    <button
                      onClick={() => removeWebsite(url)}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "transparent",
                        border: "none",
                        color: t.success,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Allowed Applications */}
          <SectionCard
            theme={theme}
            title={
              <SectionHeading theme={theme} desc="Optional. Applications that are permitted to run (e.g. Calculator, Notepad). All others will be flagged.">
                Allowed Applications
              </SectionHeading>
            }
          >
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input
                value={appInput}
                onChange={(e) => setAppInput(e.target.value)}
                onFocus={() => setFocusField("app")}
                onBlur={() => setFocusField("")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addApp();
                  }
                }}
                placeholder="Calculator"
                style={{ ...inputStyle("app"), flex: 1 }}
              />
              <button
                onClick={addApp}
                style={{
                  padding: "10px 18px",
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 10,
                  background: t.surfaceGlass,
                  color: t.textSecondary,
                  border: `1px solid ${t.borderStrong}`,
                  cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Add
              </button>
            </div>

            {form.allowed_applications.length === 0 ? (
              <div style={{ fontSize: 12, color: t.textMuted, padding: "6px 0" }}>No applications added yet.</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {form.allowed_applications.map((app) => (
                  <div
                    key={app}
                    style={{
                      background: t.surfaceGlass,
                      border: `1px solid ${t.border}`,
                      borderRadius: 999,
                      padding: "5px 8px 5px 12px",
                      fontSize: 12,
                      color: t.textSecondary,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: 600,
                    }}
                  >
                    {app}
                    <button
                      onClick={() => removeApp(app)}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "transparent",
                        border: "none",
                        color: t.textMuted,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Candidate Instructions */}
          <SectionCard
            theme={theme}
            title={
              <SectionHeading theme={theme} desc="These will be shown to candidates on the Instructions screen before the exam starts.">
                Candidate Instructions
              </SectionHeading>
            }
          >
            <textarea
              value={form.instructions}
              onChange={(e) => set("instructions", e.target.value)}
              onFocus={() => setFocusField("instr")}
              onBlur={() => setFocusField("")}
              rows={5}
              placeholder="e.g. This is a 2-hour Java assessment. Keep your camera on at all times. Read all questions carefully..."
              style={{ ...inputStyle("instr"), resize: "vertical", lineHeight: 1.7 }}
            />
          </SectionCard>

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
            <button
              onClick={() => handleSave("Draft")}
              disabled={loading}
              style={{
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: 700,
                borderRadius: 12,
                background: t.surfaceGlass,
                color: t.textPrimary,
                border: `1px solid ${t.borderStrong}`,
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "'Inter', sans-serif",
                opacity: loading ? 0.6 : 1,
              }}
            >
              Save as Draft
            </button>

            <button
              onClick={() => handleSave("Published")}
              disabled={loading}
              style={{
                padding: "12px 28px",
                fontSize: 14,
                fontWeight: 700,
                borderRadius: 12,
                background: t.accentGradient,
                color: "#fff",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "'Inter', sans-serif",
                letterSpacing: 0.3,
                boxShadow: loading ? "none" : t.glowAccent,
                opacity: loading ? 0.7 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {loading ? (
                <>
                  <span style={{ width: 15, height: 15, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  Creating...
                </>
              ) : (
                "Publish Exam"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
