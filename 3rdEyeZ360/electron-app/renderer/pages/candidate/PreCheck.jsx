import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

const THEME_STORAGE_KEY = "3rdeyez360.theme";

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
    inputBg: "rgba(255,255,255,0.04)",
  },
  light: {
    name: "light",
    canvas: "#eef1fb",
    canvasTint:
      "radial-gradient(ellipse at top left, #dbe4ff 0%, #eef1fb 45%), radial-gradient(ellipse at bottom right, #ffd9ec 0%, #eef1fb 55%)",
    surface: "rgba(255, 255, 255, 0.78)",
    surfaceElevated: "rgba(255, 255, 255, 0.92)",
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
    accentSoft: "rgba(75,96,232,0.12)",
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
          transition:
            "left 0.5s cubic-bezier(0.68, -0.4, 0.27, 1.4), background 0.5s ease, box-shadow 0.5s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="13"
          height="13"
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
          width="14"
          height="14"
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

function BackButton({ theme, onClick }) {
  const t = THEMES[theme];
  const [hover, setHover] = useState(false);
  return (
    <button
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
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transform: hover ? "translateX(-2px)" : "translateX(0)",
          transition: "transform 0.25s ease",
        }}
      >
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
      Dashboard
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

const CHECK_ICONS = {
  camera: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  face: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <circle cx="9" cy="10" r="1" />
      <circle cx="15" cy="10" r="1" />
      <path d="M9 15c1 1 2 1 3 1s2 0 3-1" />
    </svg>
  ),
  internet: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
};

function StatusBadge({ status, t }) {
  if (status === null) {
    return (
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: t.warningBg,
          border: `1px solid ${t.warning}44`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 12,
            height: 12,
            border: `2px solid ${t.warning}66`,
            borderTopColor: t.warning,
            borderRadius: "50%",
            animation: "spin 0.9s linear infinite",
          }}
        />
      </div>
    );
  }
  if (status === true) {
    return (
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: t.successGradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: `0 4px 12px ${t.success}55`,
          animation: "popIn 0.35s cubic-bezier(0.68, -0.55, 0.27, 1.55)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );
  }
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: t.dangerGradient,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: `0 4px 12px ${t.danger}55`,
        animation: "popIn 0.35s cubic-bezier(0.68, -0.55, 0.27, 1.55)",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </div>
  );
}

function CheckItem({ label, status, iconKey, theme, index }) {
  const t = THEMES[theme];
  const hint =
    status === false
      ? label === "Camera & Microphone"
        ? "Allow camera and microphone access in your browser"
        : label === "Internet Connection"
        ? "Check your network or backend service"
        : "Keep your face centered and visible in the frame"
      : status === true
      ? "Ready"
      : "Checking...";

  const stateColor = status === true ? t.success : status === false ? t.danger : t.warning;
  const borderColor =
    status === true ? `${t.success}44` : status === false ? `${t.danger}55` : t.border;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        background: t.surfaceGlass,
        borderRadius: 14,
        border: `1px solid ${borderColor}`,
        transition: "all 0.35s ease",
        position: "relative",
        overflow: "hidden",
        animation: `slideInRow 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) ${index * 0.08}s both`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: status === null ? "transparent" : stateColor,
          opacity: 0.7,
          transition: "background 0.35s ease",
        }}
      />

      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: status === true ? t.successBg : status === false ? t.dangerBg : t.surfaceGlassHover,
          border: `1px solid ${status === true ? t.success + "33" : status === false ? t.danger + "33" : t.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: stateColor,
          flexShrink: 0,
          transition: "all 0.35s ease",
        }}
      >
        {CHECK_ICONS[iconKey]}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            color: t.textPrimary,
            fontWeight: 600,
            fontFamily: "'Inter', sans-serif",
            marginBottom: 2,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 12, color: stateColor, fontWeight: 500, letterSpacing: 0.2 }}>{hint}</div>
      </div>

      <StatusBadge status={status} t={t} />
    </div>
  );
}

function InfoRow({ label, value, mono, t }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
      <span
        style={{
          fontSize: 11.5,
          color: t.textMuted,
          fontWeight: 600,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          color: t.textPrimary,
          fontWeight: 600,
          textAlign: "right",
          fontFamily: mono ? "'JetBrains Mono', monospace" : "'Inter', sans-serif",
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function PreCheck({ exam, onPass, onLogout, onBack }) {
  const { theme, toggleTheme } = useTheme();
  const t = THEMES[theme];

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const hasAutoStartedRef = useRef(false);

  const [checks, setChecks] = useState({ camera: null, face: null, internet: null });
  const [running, setRunning] = useState(false);

  const examView = useMemo(
    () => ({
      name: exam?.name || "Upcoming Exam",
      assessmentid: exam?.assessmentid || "—",
      examid: exam?.examid || "—",
      durationminutes: exam?.durationminutes || "—",
      date: exam?.date || "—",
      starttime: exam?.starttime || "—",
      endtime: exam?.endtime || "—",
      status: exam?.status || "—",
      examstatus: exam?.examstatus || "—",
      allowedwebsites: Array.isArray(exam?.allowedwebsites) ? exam.allowedwebsites : [],
      allowedapplications: Array.isArray(exam?.allowedapplications) ? exam.allowedapplications : [],
    }),
    [exam]
  );

  const stopMedia = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
  }, []);

  const startChecks = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setChecks({ camera: null, face: null, internet: null });

    const next = { camera: false, face: false, internet: false };

    try {
      const res = await fetch("http://localhost:3000/health");
      next.internet = !!res.ok;
    } catch {
      next.internet = false;
    }
    setChecks((prev) => ({ ...prev, internet: next.internet }));

    try {
      stopMedia();
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      next.camera = true;
      setChecks((prev) => ({ ...prev, camera: true }));

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const video = videoRef.current;
      const canSeeVideo =
        video &&
        typeof video.videoWidth === "number" &&
        typeof video.videoHeight === "number" &&
        video.videoWidth > 0 &&
        video.videoHeight > 0;

      next.face = !!canSeeVideo;
      setChecks((prev) => ({ ...prev, face: next.face }));
    } catch {
      next.camera = false;
      next.face = false;
      setChecks((prev) => ({ ...prev, camera: false, face: false }));
    } finally {
      setRunning(false);
    }
  }, [running, stopMedia]);

  useEffect(() => {
    if (hasAutoStartedRef.current) return;
    hasAutoStartedRef.current = true;
    startChecks();
    return () => stopMedia();
  }, [startChecks, stopMedia]);

  const allPassed = Object.values(checks).every((v) => v === true);
  const hasAnyFailure = Object.values(checks).some((v) => v === false);
  const completedChecks = Object.values(checks).filter((v) => v !== null).length;
  const totalChecks = 3;
  const progressPct = (completedChecks / totalChecks) * 100;

  const overallLabel = running
    ? "Running system checks"
    : allPassed
    ? "All systems ready"
    : hasAnyFailure
    ? "Some checks need attention"
    : "Ready to verify";

  const overallColor = running ? t.warning : allPassed ? t.success : hasAnyFailure ? t.danger : t.accent;

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
        @keyframes slideInRow { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.4); }
          70% { opacity: 1; transform: scale(1.15); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes pulseDot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.4); } }
        @keyframes gradientShift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes floatBlob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.08); }
          66% { transform: translate(-20px, 30px) scale(0.94); }
        }
        @keyframes shine {
          0% { transform: translateX(-120%) skewX(-20deg); }
          100% { transform: translateX(220%) skewX(-20deg); }
        }
        @keyframes scanLine {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(400%); }
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

        .brand-gradient {
          background: ${t.accentGradient};
          background-size: 200% 200%;
          animation: gradientShift 8s ease infinite;
        }
        .progress-fill {
          background: ${t.accentGradient};
          background-size: 200% 200%;
          animation: gradientShift 4s ease infinite;
        }

        button, a, input, textarea, video { transition: background-color 0.25s ease, border-color 0.25s ease, color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease, opacity 0.25s ease; }
      `}</style>

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
          transition: "background 0.55s ease, border-color 0.5s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <BackButton theme={theme} onClick={onBack} />
          <div style={{ width: 1, height: 24, background: t.border }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              className="brand-gradient"
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: t.glowAccent,
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 15,
                  color: t.textPrimary,
                  fontFamily: "'Space Grotesk', sans-serif",
                  letterSpacing: -0.2,
                }}
              >
                System Precheck
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  color: t.textMuted,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Step 1 of 2 · Verify Setup
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <LogoutButton onLogout={onLogout} theme={theme} />
        </div>
      </header>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "28px 32px 40px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 0.85fr)",
              gap: 24,
              animation: "cardEnter 0.5s ease",
            }}
          >
            <div
              style={{
                background: t.cardSurface,
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: `1px solid ${t.border}`,
                borderRadius: 22,
                padding: 28,
                display: "flex",
                flexDirection: "column",
                gap: 20,
                boxShadow: t.name === "light" ? "0 12px 40px rgba(20,28,60,0.10)" : "0 4px 20px rgba(0,0,0,0.15)",
                position: "relative",
                overflow: "hidden",
                transition: "background 0.55s ease, border-color 0.5s ease, box-shadow 0.5s ease",
              }}
            >
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: t.accentGradient, opacity: 0.7 }} />

              <div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: `${overallColor}18`,
                    border: `1px solid ${overallColor}55`,
                    color: overallColor,
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: 0.7,
                    textTransform: "uppercase",
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: overallColor,
                      boxShadow: `0 0 6px ${overallColor}`,
                      animation: running ? "pulseDot 1.2s ease-in-out infinite" : "none",
                    }}
                  />
                  {overallLabel}
                </div>
                <h1
                  style={{
                    fontSize: 26,
                    fontWeight: 700,
                    color: t.textPrimary,
                    fontFamily: "'Space Grotesk', sans-serif",
                    letterSpacing: -0.7,
                    lineHeight: 1.2,
                    margin: 0,
                    marginBottom: 8,
                  }}
                >
                  Let&apos;s verify your setup
                </h1>
                <p
                  style={{
                    fontSize: 13.5,
                    color: t.textSecondary,
                    lineHeight: 1.6,
                    margin: 0,
                    maxWidth: 480,
                  }}
                >
                  We need to confirm your camera, microphone, and internet connection are working before you enter the exam hall.
                </p>
              </div>

              <div
                style={{
                  width: "100%",
                  aspectRatio: "16/9",
                  background: t.name === "light" ? "#0a0d14" : "#000000",
                  borderRadius: 16,
                  overflow: "hidden",
                  border: `1px solid ${t.border}`,
                  position: "relative",
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000000" }}
                />

                {checks.camera === true && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      pointerEvents: "none",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        height: 60,
                        background: `linear-gradient(180deg, transparent, ${t.accent}44, transparent)`,
                        animation: "scanLine 3.5s linear infinite",
                        opacity: 0.5,
                      }}
                    />

                    {[0, 1, 2, 3].map((i) => {
                      const positions = [
                        { top: 12, left: 12, borders: { top: true, left: true } },
                        { top: 12, right: 12, borders: { top: true, right: true } },
                        { bottom: 12, left: 12, borders: { bottom: true, left: true } },
                        { bottom: 12, right: 12, borders: { bottom: true, right: true } },
                      ];
                      const p = positions[i];
                      return (
                        <div
                          key={i}
                          style={{
                            position: "absolute",
                            width: 20,
                            height: 20,
                            top: p.top,
                            left: p.left,
                            right: p.right,
                            bottom: p.bottom,
                            borderTop: p.borders.top ? `2px solid ${t.accent}` : "none",
                            borderBottom: p.borders.bottom ? `2px solid ${t.accent}` : "none",
                            borderLeft: p.borders.left ? `2px solid ${t.accent}` : "none",
                            borderRight: p.borders.right ? `2px solid ${t.accent}` : "none",
                            boxShadow: `0 0 8px ${t.accent}88`,
                          }}
                        />
                      );
                    })}
                  </div>
                )}

                <div
                  style={{
                    position: "absolute",
                    top: 14,
                    left: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "rgba(0, 0, 0, 0.55)",
                    backdropFilter: "blur(6px)",
                    color: "#ffffff",
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: checks.camera === true ? t.success : t.danger,
                      boxShadow: `0 0 6px ${checks.camera === true ? t.success : t.danger}`,
                      animation: checks.camera === true ? "pulseDot 1.5s ease-in-out infinite" : "none",
                    }}
                  />
                  {checks.camera === true ? "Live" : checks.camera === false ? "Offline" : "Standby"}
                </div>

                {checks.camera !== true && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "rgba(0,0,0,0.5)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ffffff",
                      gap: 8,
                      textAlign: "center",
                      padding: 20,
                    }}
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.7">
                      <path d="M23 7l-7 5 7 5V7z" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                    <div style={{ fontSize: 13, opacity: 0.9 }}>
                      {checks.camera === null ? "Requesting camera access..." : "Camera unavailable"}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: t.textMuted,
                      fontWeight: 700,
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                    }}
                  >
                    Diagnostic Checks
                  </span>
                  <span style={{ fontSize: 12, color: t.textSecondary, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>
                    {completedChecks} / {totalChecks}
                  </span>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: 6,
                    background: t.surfaceGlass,
                    borderRadius: 999,
                    overflow: "hidden",
                    border: `1px solid ${t.border}`,
                  }}
                >
                  <div
                    className="progress-fill"
                    style={{
                      height: "100%",
                      width: `${progressPct}%`,
                      borderRadius: 999,
                      transition: "width 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <CheckItem label="Camera & Microphone" status={checks.camera} iconKey="camera" theme={theme} index={0} />
                <CheckItem label="Face Visible" status={checks.face} iconKey="face" theme={theme} index={1} />
                <CheckItem label="Internet Connection" status={checks.internet} iconKey="internet" theme={theme} index={2} />
              </div>

              {!running && hasAnyFailure && (
                <div
                  style={{
                    background: t.warningBg,
                    border: `1px solid ${t.warning}55`,
                    borderRadius: 14,
                    padding: "12px 14px",
                    fontSize: 12.5,
                    color: t.warning,
                    lineHeight: 1.6,
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>Some checks did not pass. You can retry, or continue if this is for review purposes only.</span>
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                {!running && !allPassed && (
                  <button
                    onClick={startChecks}
                    style={{
                      flex: "0 0 auto",
                      padding: "12px 20px",
                      fontSize: 13.5,
                      fontWeight: 700,
                      background: t.surfaceGlass,
                      color: t.textPrimary,
                      border: `1px solid ${t.borderStrong}`,
                      borderRadius: 12,
                      cursor: "pointer",
                      fontFamily: "'Inter', sans-serif",
                      letterSpacing: 0.3,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    Retry
                  </button>
                )}

                <button
                  onClick={onPass}
                  className="cta-shine"
                  style={{
                    flex: 1,
                    padding: "13px 0",
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#ffffff",
                    background: t.accentGradient,
                    border: "none",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontFamily: "'Inter', sans-serif",
                    letterSpacing: 0.4,
                    boxShadow: t.glowAccent,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <span style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", gap: 10 }}>
                    Continue to Instructions
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </span>
                </button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: -50,
                    right: -50,
                    width: 180,
                    height: 180,
                    borderRadius: "50%",
                    background: t.accentGradient,
                    opacity: t.name === "light" ? 0.14 : 0.1,
                    filter: "blur(50px)",
                    pointerEvents: "none",
                  }}
                />

                <div style={{ position: "relative", zIndex: 1 }}>
                  <div
                    style={{
                      fontSize: 10.5,
                      color: t.textMuted,
                      fontWeight: 700,
                      letterSpacing: 1.2,
                      textTransform: "uppercase",
                      marginBottom: 10,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ display: "inline-block", width: 20, height: 1, background: t.accentGradient }} />
                    Assessment
                  </div>

                  <h3
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: t.textPrimary,
                      fontFamily: "'Space Grotesk', sans-serif",
                      letterSpacing: -0.4,
                      lineHeight: 1.25,
                      margin: 0,
                      marginBottom: 16,
                    }}
                  >
                    {examView.name}
                  </h3>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <InfoRow label="Assessment ID" value={examView.assessmentid} mono t={t} />
                    <InfoRow label="Exam ID" value={examView.examid} mono t={t} />
                    <div style={{ height: 1, background: t.border }} />
                    <InfoRow label="Date" value={examView.date} t={t} />
                    <InfoRow
                      label="Window"
                      value={`${examView.starttime} — ${examView.endtime}`}
                      t={t}
                    />
                    <InfoRow
                      label="Duration"
                      value={
                        <span style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                          {examView.durationminutes}
                          <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 500, marginLeft: 4 }}>min</span>
                        </span>
                      }
                      t={t}
                    />
                    <div style={{ height: 1, background: t.border }} />
                    <InfoRow
                      label="Assessment"
                      value={
                        <span style={{ color: t.success, fontWeight: 700, letterSpacing: 0.3 }}>{examView.status}</span>
                      }
                      t={t}
                    />
                    <InfoRow
                      label="Exam Session"
                      value={
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            color: examView.examstatus === "RUNNING" ? t.success : t.textPrimary,
                            fontWeight: 700,
                          }}
                        >
                          {examView.examstatus === "RUNNING" && (
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
                          {examView.examstatus}
                        </span>
                      }
                      t={t}
                    />
                  </div>
                </div>
              </div>

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
                    marginBottom: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ display: "inline-block", width: 20, height: 1, background: t.accentGradient }} />
                  Permitted Access
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: t.textMuted,
                      fontWeight: 600,
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                      marginBottom: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    Websites ({examView.allowedwebsites.length})
                  </div>
                  {examView.allowedwebsites.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {examView.allowedwebsites.map((site, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: 11.5,
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: t.accentSoft,
                            border: `1px solid ${t.borderAccent}`,
                            color: t.accent,
                            fontWeight: 600,
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          {site}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: t.textMuted, fontStyle: "italic" }}>None permitted</div>
                  )}
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: t.textMuted,
                      fontWeight: 600,
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                      marginBottom: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <rect x="4" y="4" width="16" height="16" rx="2" />
                      <path d="M9 10h6M9 14h4" />
                    </svg>
                    Applications ({examView.allowedapplications.length})
                  </div>
                  {examView.allowedapplications.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {examView.allowedapplications.map((app, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: 11.5,
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: t.accentSoft,
                            border: `1px solid ${t.borderAccent}`,
                            color: t.accent,
                            fontWeight: 600,
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          {app}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: t.textMuted, fontStyle: "italic" }}>None permitted</div>
                  )}
                </div>
              </div>

              <div
                style={{
                  background: t.accentSoft,
                  border: `1px solid ${t.borderAccent}`,
                  borderRadius: 16,
                  padding: 16,
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2.2" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: t.accent,
                      fontWeight: 700,
                      marginBottom: 4,
                      letterSpacing: 0.2,
                    }}
                  >
                    Development mode
                  </div>
                  <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.55 }}>
                    Checks are visible for review but will not block the flow. Strict enforcement can be re-enabled once routing and exam flow are finalized.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
