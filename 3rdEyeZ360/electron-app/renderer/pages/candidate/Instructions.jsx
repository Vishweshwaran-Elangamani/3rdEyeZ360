import React, { useState, useRef, useEffect, useCallback } from "react";

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
    danger: "#ef6a6a",
    dangerBg: "rgba(239,106,106,0.1)",
    glowAccent: "0 8px 32px rgba(91,140,255,0.28), 0 0 60px rgba(160,101,255,0.15)",
    // Proctoring icon tiles — light glass surface for dark theme
    iconTileBg: "rgba(255, 255, 255, 0.06)",
    iconTileBorder: "rgba(255, 255, 255, 0.16)",
    iconTileHighlight: "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 55%)",
    iconStroke: "rgba(200, 210, 240, 0.35)",
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
    danger: "#dc2626",
    dangerBg: "rgba(220,38,38,0.12)",
    glowAccent: "0 12px 40px rgba(75,96,232,0.25), 0 0 60px rgba(124,58,237,0.15)",
    // Proctoring icon tiles — darker indigo glass for light theme
    iconTileBg: "rgba(75, 96, 232, 0.08)",
    iconTileBorder: "rgba(75, 96, 232, 0.20)",
    iconTileHighlight: "linear-gradient(135deg, rgba(124, 58, 237, 0.14) 0%, transparent 55%)",
    iconStroke: "rgba(45, 60, 130, 0.35)",
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

/* ============= Proctoring icons (inline SVG) ============= */

function ProctoringIcon({ type, stroke, size }) {
  const s = size * 0.5;
  const sw = 1.6;
  const common = {
    width: s,
    height: s,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: sw,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  switch (type) {
    case "laptop":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <line x1="2" y1="20" x2="22" y2="20" />
        </svg>
      );
    case "browser":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <circle cx="6" cy="6.5" r="0.6" fill={stroke} />
          <circle cx="8.5" cy="6.5" r="0.6" fill={stroke} />
          <circle cx="11" cy="6.5" r="0.6" fill={stroke} />
        </svg>
      );
    case "mic":
      return (
        <svg {...common}>
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0" />
          <line x1="12" y1="19" x2="12" y2="22" />
          <line x1="8" y1="22" x2="16" y2="22" />
        </svg>
      );
    case "camera":
      return (
        <svg {...common}>
          <path d="M23 7l-7 5 7 5V7z" />
          <rect x="1" y="5" width="15" height="14" rx="2" />
        </svg>
      );
    case "battery":
      return (
        <svg {...common}>
          <rect x="2" y="7" width="18" height="10" rx="2" />
          <line x1="22" y1="11" x2="22" y2="13" />
          <rect x="4" y="9" width="8" height="6" fill={stroke} opacity="0.6" />
        </svg>
      );
    case "wifi":
      return (
        <svg {...common}>
          <path d="M5 12a10 10 0 0 1 14 0" />
          <path d="M8.5 15.5a5 5 0 0 1 7 0" />
          <line x1="12" y1="19" x2="12.01" y2="19" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "eye":
      return (
        <svg {...common}>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "lock":
      return (
        <svg {...common}>
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "monitor":
      return (
        <svg {...common}>
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    default:
      return null;
  }
}

/* ============= Animated Background ============= */

function AnimatedBackground({ theme }) {
  const t = THEMES[theme];

 // Proctoring-themed icons — kept strictly to the outer edges so they never
// overlap the centered instruction column (max-width ~820px).
const iconTiles = [
  // Left edge strip
  { type: "laptop",  top: "6%",    left: "3%", size: 88, dur: 26, delay: 0, rotate: -6  },
  { type: "eye",     top: "24%",   left: "11%", size: 72, dur: 24, delay: 4, rotate: -4  },
  { type: "wifi",    top: "42%",   left: "3%", size: 76, dur: 26, delay: 5, rotate: 0   },
  { type: "monitor", top: "60%",   left: "14%", size: 86, dur: 30, delay: 1, rotate: -10 },
  { type: "lock",    bottom: "12%",left: "3%", size: 78, dur: 26, delay: 4, rotate: 8   },

  // Right edge strip
  { type: "mic",     top: "6%",    right: "13%", size: 78, dur: 28, delay: 1, rotate: 8  },
  { type: "shield",  top: "24%",   right: "4%", size: 82, dur: 30, delay: 2, rotate: 12 },
  { type: "battery", top: "44%",   right: "14%", size: 82, dur: 24, delay: 6, rotate: 6  },
  { type: "clock",   top: "62%",   right: "4%", size: 72, dur: 22, delay: 3, rotate: 0  },
  { type: "user",    bottom: "10%",right: "13%", size: 80, dur: 30, delay: 5, rotate: -6 },
];
  // Floating bubbles — scattered
  const bubbles = [
    { top: "12%", left: "22%",  size: 22, dur: 14, delay: 0 },
    { top: "18%", left: "68%",  size: 14, dur: 12, delay: 2 },
    { top: "30%", left: "8%",   size: 30, dur: 16, delay: 4 },
    { top: "32%", left: "52%",  size: 18, dur: 13, delay: 1 },
    { top: "36%", left: "88%",  size: 24, dur: 15, delay: 3 },
    { top: "50%", left: "30%",  size: 16, dur: 12, delay: 5 },
    { top: "54%", left: "74%",  size: 26, dur: 18, delay: 2 },
    { top: "60%", left: "14%",  size: 20, dur: 14, delay: 6 },
    { top: "66%", left: "58%",  size: 12, dur: 11, delay: 1 },
    { top: "74%", left: "82%",  size: 28, dur: 17, delay: 3 },
    { top: "80%", left: "24%",  size: 18, dur: 13, delay: 5 },
    { top: "84%", left: "44%",  size: 22, dur: 15, delay: 2 },
    { top: "88%", left: "68%",  size: 14, dur: 12, delay: 4 },
    { top: "16%", left: "90%",  size: 16, dur: 13, delay: 0 },
    { top: "44%", left: "3%",   size: 12, dur: 11, delay: 3 },
  ];

  const renderIconTile = (item, i) => {
    const wrapStyle = {
      position: "absolute",
      top: item.top,
      bottom: item.bottom,
      left: item.left,
      right: item.right,
      width: item.size,
      height: item.size,
      pointerEvents: "none",
      animation: `driftFloat ${item.dur}s ease-in-out infinite`,
      animationDelay: `${item.delay}s`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transform: `rotate(${item.rotate}deg)`,
      filter:
        t.name === "dark"
          ? "drop-shadow(0 4px 12px rgba(91,140,255,0.15))"
          : "drop-shadow(0 4px 12px rgba(75,96,232,0.18))",
    };

    return (
      <div key={`icon-${i}`} style={wrapStyle}>
        <ProctoringIcon type={item.type} stroke={t.iconStroke} size={item.size * 2} />
      </div>
    );
  };

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
      {/* Ambient radial glows */}
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

      {/* Bubbles */}
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

      {/* Proctoring-themed glass tiles */}
      {iconTiles.map((item, i) => renderIconTile(item, i))}
    </div>
  );
}

/* ============= Instructions data ============= */

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value) !== "") return value;
  }
  return "";
}

const INSTRUCTIONS = [
  "Keep your face clearly visible in the camera at all times throughout the assessment.",
  "Mobile phones and any additional electronic devices must not be present on your desk.",
  "Ensure you are alone in the room. No other person should be visible or audible on the stream.",
  "Stay in a silent environment. Background voices and conversations will be flagged as violations.",
  "Only the pre-approved exam websites will be accessible during the session. All other sites are blocked.",
  "Keep your laptop connected to its charger throughout the assessment to avoid unexpected shutdowns.",
  "Do not attempt to close, minimize, or switch away from the exam window at any point.",
  "Keep your eyes focused on the screen. Looking away repeatedly may trigger proctoring alerts.",
  "Use the built-in chat feature to contact the examiner if you need assistance during the exam.",
  "You will receive a friendly on-screen warning before any violation is officially recorded on your report.",
];

/* ============= Launch overlay ============= */

function LaunchOverlay({ theme, examName }) {
  const t = THEMES[theme];
  const [phase, setPhase] = useState(0);

  const phases = [
    "Verifying agreement",
    "Locking down environment",
    "Establishing secure channel",
    "Opening exam workspace",
  ];

  useEffect(() => {
    const id = setInterval(() => {
      setPhase((p) => (p < phases.length - 1 ? p + 1 : p));
    }, 1400);
    return () => clearInterval(id);
    // eslint-disable-next-line
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: t.name === "dark" ? "rgba(3, 5, 10, 0.88)" : "rgba(15, 20, 36, 0.55)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, animation: "fadeIn 0.35s ease" }}>
      <div style={{ width: "100%", maxWidth: 460, background: t.surfaceElevated, border: `1px solid ${t.borderStrong}`, borderRadius: 22, padding: 40, textAlign: "center", boxShadow: "0 30px 80px rgba(0,0,0,0.5)", position: "relative", overflow: "hidden", animation: "launchIn 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
        <div style={{ position: "absolute", inset: 0, background: t.accentGradientSoft, opacity: 0.7, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)", width: 200, height: 200, borderRadius: "50%", background: t.accentGradient, opacity: 0.35, filter: "blur(50px)", animation: "pulseBlob 2.4s ease-in-out infinite" }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ position: "relative", width: 90, height: 90, margin: "0 auto 26px" }}>
            <svg width="90" height="90" viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
              <circle cx="50" cy="50" r="42" stroke={t.border} strokeWidth="3" fill="none" />
              <circle cx="50" cy="50" r="42" stroke="url(#launchGrad)" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="264" strokeDashoffset="0" style={{ animation: "arcSpin 2.2s linear infinite" }} />
              <defs>
                <linearGradient id="launchGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={t.accent} />
                  <stop offset="50%" stopColor={t.accent2} />
                  <stop offset="100%" stopColor={t.accent3} />
                </linearGradient>
              </defs>
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="brand-gradient" style={{ width: 54, height: 54, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: t.glowAccent, animation: "gentleFloat 2.4s ease-in-out infinite" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 22, fontWeight: 700, color: t.textPrimary, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.5, lineHeight: 1.2, marginBottom: 6 }}>
            Preparing your workspace
          </div>
          <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 26 }}>
            {examName}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
            {phases.map((p, i) => {
              const done = i < phase;
              const active = i === phase;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: t.surfaceGlass, borderRadius: 10, border: `1px solid ${active ? t.borderAccent : t.border}`, opacity: done || active ? 1 : 0.55, transition: "all 0.35s ease" }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: done ? t.successGradient : active ? t.accentGradient : t.surfaceGlassHover, border: done || active ? "none" : `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: done ? `0 2px 8px ${t.success}55` : active ? `0 2px 8px ${t.accent}55` : "none" }}>
                    {done ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : active ? (
                      <span style={{ width: 8, height: 8, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#ffffff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                    ) : null}
                  </div>
                  <span style={{ fontSize: 12.5, color: done || active ? t.textPrimary : t.textMuted, fontWeight: active ? 700 : 500, letterSpacing: 0.2, transition: "color 0.3s ease" }}>{p}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============= Main component ============= */

export default function Instructions({ exam, assessment, onStart, onLogout }) {
  const { theme, toggleTheme } = useTheme();
  const t = THEMES[theme];

  const [agreed, setAgreed] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");

  const launchAttemptRef = useRef(false);
  const launchTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (launchTimeoutRef.current) clearTimeout(launchTimeoutRef.current);
    };
  }, []);

  const examName = firstValue(exam?.name, assessment?.name, "Upcoming Exam");
  const duration = firstValue(
    exam?.durationminutes,
    exam?.duration_minutes,
    assessment?.durationminutes,
    assessment?.duration_minutes,
    "—"
  );
  const examinerInstructions = firstValue(exam?.instructions, assessment?.instructions, "");

  const handleStart = async () => {
    if (!agreed || launching || launchAttemptRef.current) return;
    launchAttemptRef.current = true;
    setLaunching(true);
    setError("");

    if (launchTimeoutRef.current) clearTimeout(launchTimeoutRef.current);

    launchTimeoutRef.current = setTimeout(() => {
      setLaunching(false);
      launchAttemptRef.current = false;
      setError("The workspace is taking longer than expected to open. Please try again.");
    }, 12000);

    try {
      await onStart?.();
    } catch (e) {
      console.log("Instructions launch failed", e);
      if (launchTimeoutRef.current) {
        clearTimeout(launchTimeoutRef.current);
        launchTimeoutRef.current = null;
      }
      setError("Unable to launch the exam workspace right now. Please try again.");
      setLaunching(false);
      launchAttemptRef.current = false;
      return;
    }

    if (launchTimeoutRef.current) {
      clearTimeout(launchTimeoutRef.current);
      launchTimeoutRef.current = null;
    }
    setLaunching(false);
    launchAttemptRef.current = false;
  };

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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideInRow { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cardEnter { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
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
        @keyframes shine {
          0% { transform: translateX(-120%) skewX(-20deg); }
          100% { transform: translateX(220%) skewX(-20deg); }
        }
        @keyframes launchIn {
          from { opacity: 0; transform: scale(0.94) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes pulseBlob {
          0%, 100% { opacity: 0.3; transform: translateX(-50%) scale(1); }
          50% { opacity: 0.55; transform: translateX(-50%) scale(1.1); }
        }
        @keyframes arcSpin {
          0% { transform: rotate(0deg); stroke-dashoffset: 264; }
          50% { stroke-dashoffset: 60; }
          100% { transform: rotate(360deg); stroke-dashoffset: 264; }
        }
        @keyframes gentleFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes numberPop {
          from { opacity: 0; transform: scale(0.6); }
          to { opacity: 1; transform: scale(1); }
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
        .num-gradient {
          background: ${t.accentGradient};
          background-size: 200% 200%;
          animation: gradientShift 6s ease infinite;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }

        button, a, input, textarea { transition: background-color 0.25s ease, border-color 0.25s ease, color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease, opacity 0.25s ease; }
      `}</style>

      {/* Animated Background layer */}
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
              Exam Instructions
            </span>
            <span style={{ fontSize: 10.5, color: t.textMuted, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 600 }}>
              Read carefully before you begin
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <LogoutButton onLogout={onLogout} theme={theme} />
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "36px 24px 40px", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22, animation: "cardEnter 0.5s ease" }}>
          {/* Hero */}
          <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
            <div
              style={{
                fontSize: 11,
                color: t.textMuted,
                fontWeight: 700,
                letterSpacing: 1.6,
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              {examName}{duration && duration !== "—" ? ` · ${duration} minutes` : ""}
            </div>
            <h1
              style={{
                fontSize: 36,
                fontWeight: 700,
                margin: 0,
                color: t.textPrimary,
                fontFamily: "'Space Grotesk', sans-serif",
                letterSpacing: -1,
                lineHeight: 1.15,
              }}
            >
              Please read every instruction
              <br />
              <span className="num-gradient">before you begin.</span>
            </h1>
            <p
              style={{
                marginTop: 14,
                fontSize: 14,
                color: t.textSecondary,
                lineHeight: 1.65,
                maxWidth: 560,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              These rules apply for the full duration of your assessment. Take a moment to review each one carefully.
            </p>
          </div>

          {/* Examiner note (optional) */}
          {examinerInstructions ? (
            <div
              style={{
                background: t.cardSurface,
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: `1px solid ${t.borderAccent}`,
                borderRadius: 16,
                padding: "16px 18px",
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2.2" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <div>
                <div style={{ fontSize: 11, color: t.accent, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>
                  Note from your examiner
                </div>
                <div style={{ fontSize: 13.5, color: t.textSecondary, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {examinerInstructions}
                </div>
              </div>
            </div>
          ) : null}

          {/* Instruction list card — glassmorphic */}
          <div
            style={{
              background: t.cardSurface,
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: `1px solid ${t.border}`,
              borderRadius: 22,
              padding: "8px 8px",
              boxShadow:
                t.name === "light"
                  ? "0 12px 40px rgba(20,28,60,0.10)"
                  : "0 4px 20px rgba(0,0,0,0.15)",
              transition: "background 0.55s ease, border-color 0.5s ease, box-shadow 0.5s ease",
            }}
          >
            <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column" }}>
              {INSTRUCTIONS.map((text, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 18,
                    padding: "18px 22px",
                    borderBottom: i < INSTRUCTIONS.length - 1 ? `1px solid ${t.border}` : "none",
                    animation: `slideInRow 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) ${i * 0.04}s both`,
                    transition: "background 0.25s ease",
                    cursor: "default",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = t.surfaceGlass;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span
                    className="num-gradient"
                    style={{
                      flexShrink: 0,
                      width: 38,
                      textAlign: "right",
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: 22,
                      fontWeight: 700,
                      letterSpacing: -0.5,
                      lineHeight: 1.3,
                      animation: `numberPop 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55) ${i * 0.04}s both`,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 14.5,
                      color: t.textPrimary,
                      lineHeight: 1.65,
                      fontWeight: 500,
                      paddingTop: 3,
                    }}
                  >
                    {text}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* Consent + CTA */}
          <div
            style={{
              background: t.cardSurface,
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: `1px solid ${agreed ? t.borderAccent : t.border}`,
              borderRadius: 22,
              padding: 22,
              boxShadow:
                t.name === "light"
                  ? "0 8px 30px rgba(20,28,60,0.08)"
                  : "0 4px 20px rgba(0,0,0,0.12)",
              transition: "background 0.55s ease, border-color 0.35s ease, box-shadow 0.5s ease",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {agreed && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: t.accentGradientSoft,
                  opacity: 0.5,
                  pointerEvents: "none",
                  transition: "opacity 0.35s ease",
                }}
              />
            )}

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                cursor: launching ? "not-allowed" : "pointer",
                userSelect: "none",
                position: "relative",
                zIndex: 1,
                marginBottom: error ? 16 : 20,
              }}
            >
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                disabled={launching}
                style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
              />
              <span
                aria-hidden
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  border: `2px solid ${agreed ? "transparent" : t.borderStrong}`,
                  background: agreed ? t.accentGradient : t.surfaceGlass,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 1,
                  boxShadow: agreed ? `0 6px 16px ${t.accent}55` : "none",
                  transition: "all 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55)",
                  transform: agreed ? "scale(1.05)" : "scale(1)",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    strokeDasharray: 24,
                    strokeDashoffset: agreed ? 0 : 24,
                    transition: "stroke-dashoffset 0.35s ease 0.05s",
                    opacity: agreed ? 1 : 0,
                  }}
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <div>
                <div style={{ fontSize: 14, color: t.textPrimary, fontWeight: 600, lineHeight: 1.45 }}>
                  I have read and understood all the instructions above.
                </div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4, lineHeight: 1.55 }}>
                  By continuing, you agree to be monitored for the duration of this assessment.
                </div>
              </div>
            </label>

            {error ? (
              <div
                style={{
                  background: t.dangerBg,
                  border: `1px solid ${t.danger}55`,
                  color: t.danger,
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontSize: 13,
                  marginBottom: 14,
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  position: "relative",
                  zIndex: 1,
                  lineHeight: 1.5,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            ) : null}

            <button
              onClick={handleStart}
              disabled={!agreed || launching}
              className="cta-shine"
              style={{
                width: "100%",
                padding: "14px 0",
                fontSize: 14.5,
                fontWeight: 700,
                color: "#ffffff",
                background: agreed && !launching ? t.accentGradient : t.borderStrong,
                border: "none",
                borderRadius: 12,
                cursor: agreed && !launching ? "pointer" : "not-allowed",
                fontFamily: "'Inter', sans-serif",
                letterSpacing: 0.4,
                boxShadow: agreed && !launching ? t.glowAccent : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                position: "relative",
                overflow: "hidden",
                opacity: agreed && !launching ? 1 : 0.55,
              }}
            >
              <span style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", gap: 10 }}>
                {launching ? (
                  <>
                    <span
                      style={{
                        width: 15,
                        height: 15,
                        border: "2px solid rgba(255,255,255,0.35)",
                        borderTopColor: "#ffffff",
                        borderRadius: "50%",
                        animation: "spin 0.7s linear infinite",
                      }}
                    />
                    Launching workspace
                  </>
                ) : (
                  <>
                    Launch Exam Workspace
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>

      {launching && <LaunchOverlay theme={theme} examName={examName} />}
    </div>
  );
}
