import React, { useState, useEffect, useCallback, useRef } from "react";
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
    surfaceElevated: "rgba(24, 28, 44, 0.96)",
    surfaceGlass: "rgba(255, 255, 255, 0.05)",
    surfaceGlassHover: "rgba(255, 255, 255, 0.08)",
    cardSurface: "rgba(22, 26, 40, 0.42)",
    cardSurfaceHover: "rgba(28, 32, 48, 0.55)",
    border: "rgba(255, 255, 255, 0.10)",
    borderStrong: "rgba(255, 255, 255, 0.16)",
    borderAccent: "rgba(91, 140, 255, 0.45)",
    textPrimary: "#ffffff",
    textSecondary: "#d5daea",
    textMuted: "#9aa2ba",
    textFaint: "#6b7286",
    label: "#c7cee3",
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
    danger: "#ff8686",
    dangerGradient: "linear-gradient(135deg, #ff7a7a 0%, #d94a4a 100%)",
    dangerBg: "rgba(239,106,106,0.14)",
    glowAccent: "0 8px 32px rgba(91,140,255,0.28), 0 0 60px rgba(160,101,255,0.15)",
    glowSuccess: "0 6px 24px rgba(62,207,142,0.28)",
    inputBg: "rgba(255,255,255,0.07)",
    inputReadonly: "rgba(255,255,255,0.03)",
    wheelMask: "#181c2c",
    iconStroke: "rgba(200, 210, 240, 0.32)",
    bubbleFill: "rgba(255, 255, 255, 0.06)",
    bubbleBorder: "rgba(255, 255, 255, 0.20)",
    bubbleHighlight: "rgba(255, 255, 255, 0.35)",
  },
  light: {
    name: "light",
    canvas: "#eef1fb",
    canvasTint:
      "radial-gradient(ellipse at top left, #dbe4ff 0%, #eef1fb 45%), radial-gradient(ellipse at bottom right, #ffd9ec 0%, #eef1fb 55%)",
    surface: "rgba(255, 255, 255, 0.88)",
    surfaceElevated: "rgba(255, 255, 255, 0.98)",
    surfaceGlass: "rgba(255, 255, 255, 0.7)",
    surfaceGlassHover: "rgba(255, 255, 255, 0.9)",
    cardSurface: "rgba(255, 255, 255, 0.68)",
    cardSurfaceHover: "rgba(255, 255, 255, 0.85)",
    border: "rgba(20, 28, 60, 0.12)",
    borderStrong: "rgba(20, 28, 60, 0.20)",
    borderAccent: "rgba(75, 96, 232, 0.45)",
    textPrimary: "#0b1024",
    textSecondary: "#2a3150",
    textMuted: "#5a6280",
    textFaint: "#98a0ba",
    label: "#42496a",
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
    danger: "#c81e1e",
    dangerGradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    dangerBg: "rgba(220,38,38,0.12)",
    glowAccent: "0 12px 40px rgba(75,96,232,0.25), 0 0 60px rgba(124,58,237,0.15)",
    glowSuccess: "0 8px 28px rgba(14,165,100,0.28)",
    inputBg: "rgba(255,255,255,0.9)",
    inputReadonly: "#f2f4fa",
    wheelMask: "#ffffff",
    iconStroke: "rgba(45, 60, 130, 0.32)",
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

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";
  const t = THEMES[theme];
  return (
    <button
      onClick={onToggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      style={{
        position: "relative",
        width: 54,
        height: 28,
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
        { top: 5, left: 9, size: 2, o: isDark ? 0.9 : 0 },
        { top: 17, left: 14, size: 1.5, o: isDark ? 0.6 : 0 },
        { top: 8, left: 19, size: 1.5, o: isDark ? 0.7 : 0 },
      ].map((s, i) => (
        <span key={i} style={{ position: "absolute", top: s.top, left: s.left, width: s.size, height: s.size, borderRadius: "50%", background: "#ffffff", opacity: s.o, transition: "opacity 0.6s ease" }} />
      ))}
      <span
        style={{
          position: "absolute",
          top: 3,
          left: isDark ? 28 : 3,
          width: 20,
          height: 20,
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
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={isDark ? "#3d4460" : "#7a4a00"} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: isDark ? 1 : 0, transform: isDark ? "rotate(0)" : "rotate(-140deg) scale(0.4)", transition: "opacity 0.4s ease, transform 0.5s ease", position: "absolute" }}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7a4a00" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: isDark ? 0 : 1, transform: isDark ? "rotate(140deg) scale(0.4)" : "rotate(0)", transition: "opacity 0.4s ease, transform 0.5s ease", position: "absolute" }}>
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
        gap: 7,
        padding: "7px 13px 7px 9px",
        borderRadius: 11,
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
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: hover ? "translateX(-2px)" : "translateX(0)", transition: "transform 0.25s ease" }}>
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
      Back
    </button>
  );
}

/* ============= Wheel Time Picker (iOS-style drum roller) ============= */

// value / onChange use 24-hour "HH:MM". Displays 12-hour + AM/PM wheels.
const ITEM_H = 40;          // px height of each wheel item
const VISIBLE = 5;          // visible rows (must be odd)
const PAD = Math.floor(VISIBLE / 2);

function to12h(value24) {
  if (!value24 || !/^\d{1,2}:\d{2}$/.test(value24)) return null;
  const [hh, mm] = value24.split(":").map(Number);
  const period = hh >= 12 ? "PM" : "AM";
  let h12 = hh % 12;
  if (h12 === 0) h12 = 12;
  return { h12, mm, period };
}

function to24h(h12, mm, period) {
  let hh = h12 % 12;
  if (period === "PM") hh += 12;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function formatDisplay(value24) {
  const parsed = to12h(value24);
  if (!parsed) return "";
  return `${parsed.h12}:${String(parsed.mm).padStart(2, "0")} ${parsed.period}`;
}

function Wheel({ items, index, onIndexChange, theme, width }) {
  const t = THEMES[theme];
  const ref = useRef(null);
  const scrollTimeout = useRef(null);
  const isProgrammatic = useRef(false);

  // keep scroll position in sync when index changes externally
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = index * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 1) {
      isProgrammatic.current = true;
      el.scrollTo({ top: target, behavior: "auto" });
      setTimeout(() => { isProgrammatic.current = false; }, 30);
    }
  }, [index]);

  const handleScroll = () => {
    const el = ref.current;
    if (!el || isProgrammatic.current) return;
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      const nearest = Math.round(el.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, nearest));
      // snap
      isProgrammatic.current = true;
      el.scrollTo({ top: clamped * ITEM_H, behavior: "smooth" });
      setTimeout(() => { isProgrammatic.current = false; }, 220);
      if (clamped !== index) onIndexChange(clamped);
    }, 90);
  };

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      style={{
        width,
        height: ITEM_H * VISIBLE,
        overflowY: "auto",
        scrollSnapType: "y mandatory",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        position: "relative",
      }}
      className="wheel-scroll"
    >
      {/* top + bottom padding so first/last items can reach the center band */}
      <div style={{ height: ITEM_H * PAD }} />
      {items.map((it, i) => {
        const dist = Math.abs(i - index);
        const opacity = dist === 0 ? 1 : dist === 1 ? 0.5 : dist === 2 ? 0.25 : 0.12;
        const scale = dist === 0 ? 1 : dist === 1 ? 0.9 : 0.8;
        return (
          <div
            key={it.key ?? i}
            onClick={() => onIndexChange(i)}
            style={{
              height: ITEM_H,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              scrollSnapAlign: "center",
              cursor: "pointer",
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 20,
              fontWeight: dist === 0 ? 700 : 500,
              color: dist === 0 ? t.textPrimary : t.textSecondary,
              opacity,
              transform: `scale(${scale})`,
              transition: "opacity 0.18s ease, transform 0.18s ease, color 0.18s ease",
              userSelect: "none",
            }}
          >
            {it.label}
          </div>
        );
      })}
      <div style={{ height: ITEM_H * PAD }} />
    </div>
  );
}

function WheelTimePicker({ theme, value, onChange, minValue }) {
  const t = THEMES[theme];
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const parsed = to12h(value) || { h12: 9, mm: 0, period: "AM" };

  const MINUTE_STEP = 5; // each scroll changes minutes by 5
  const hours = Array.from({ length: 12 }, (_, i) => ({ key: i + 1, label: String(i + 1).padStart(2, "0"), val: i + 1 }));
  const minutes = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => {
    const v = i * MINUTE_STEP;
    return { key: v, label: String(v).padStart(2, "0"), val: v };
  });
  const periods = [{ key: "AM", label: "AM", val: "AM" }, { key: "PM", label: "PM", val: "PM" }];

  const hIndex = parsed.h12 - 1;
  const mIndex = Math.min(minutes.length - 1, Math.round(parsed.mm / MINUTE_STEP) % minutes.length);
  const pIndex = parsed.period === "PM" ? 1 : 0;

  const emit = (h12, mm, period) => {
    const next = to24h(h12, mm, period);
    if (minValue && next < minValue) {
      onChange(minValue);
    } else {
      onChange(next);
    }
  };

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const display = value ? formatDisplay(value) : "";

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          background: t.inputBg,
          border: `1px solid ${open ? t.accent : t.border}`,
          borderRadius: 9,
          padding: "9px 12px",
          color: display ? t.textPrimary : t.textMuted,
          fontSize: 14,
          fontFamily: "'Inter', sans-serif",
          cursor: "pointer",
          outline: "none",
          boxShadow: open ? `0 0 0 3px ${t.accentSoft}` : "none",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease, background 0.5s ease",
        }}
      >
        <span style={{ fontFamily: display ? "'Space Grotesk', sans-serif" : "'Inter', sans-serif", fontWeight: display ? 700 : 400, letterSpacing: display ? 0.3 : 0 }}>
          {display || "Select time"}
        </span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={open ? t.accent : t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </button>

      {/* Popover */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 200,
            background: t.surfaceElevated,
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: `1px solid ${t.borderStrong}`,
            borderRadius: 16,
            padding: 12,
            boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
            animation: "pickerIn 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)",
            minWidth: 230,
          }}
        >
          <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "stretch", gap: 4 }}>
            {/* center selection band */}
            <div
              style={{
                position: "absolute",
                top: ITEM_H * PAD,
                left: 6,
                right: 6,
                height: ITEM_H,
                borderRadius: 10,
                background: t.accentSoft,
                border: `1px solid ${t.borderAccent}`,
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
            {/* top/bottom fade masks */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: ITEM_H * PAD, background: `linear-gradient(${t.wheelMask}, ${t.wheelMask}00)`, pointerEvents: "none", zIndex: 2, borderRadius: "12px 12px 0 0" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: ITEM_H * PAD, background: `linear-gradient(${t.wheelMask}00, ${t.wheelMask})`, pointerEvents: "none", zIndex: 2, borderRadius: "0 0 12px 12px" }} />

            <Wheel theme={theme} items={hours} index={hIndex} width={58} onIndexChange={(i) => emit(hours[i].val, parsed.mm, parsed.period)} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: t.textMuted, fontFamily: "'Space Grotesk', sans-serif", zIndex: 3 }}>:</div>
            <Wheel theme={theme} items={minutes} index={mIndex} width={58} onIndexChange={(i) => emit(parsed.h12, minutes[i].val, parsed.period)} />
            <Wheel theme={theme} items={periods} index={pIndex} width={54} onIndexChange={(i) => emit(parsed.h12, parsed.mm, periods[i].val)} />
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              marginTop: 10,
              width: "100%",
              padding: "9px 0",
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
            Done
          </button>
        </div>
      )}
    </div>
  );
}

/* ============= Stepper (violation threshold) ============= */

function Stepper({ theme, value, min = 1, max = 100, onChange }) {
  const t = THEMES[theme];
  const holdRef = useRef(null);

  const clamp = (v) => Math.max(min, Math.min(max, v));

  const bump = (delta) => onChange(clamp((Number(value) || min) + delta));

  // press-and-hold to keep changing
  const startHold = (delta) => {
    bump(delta);
    let speed = 260;
    const tick = () => {
      bump(delta);
      speed = Math.max(60, speed - 30);
      holdRef.current = setTimeout(tick, speed);
    };
    holdRef.current = setTimeout(tick, 380);
  };
  const stopHold = () => {
    if (holdRef.current) {
      clearTimeout(holdRef.current);
      holdRef.current = null;
    }
  };
  useEffect(() => () => stopHold(), []);

  const atMin = (Number(value) || min) <= min;
  const atMax = (Number(value) || min) >= max;

  const btn = (disabled) => ({
    width: 26,
    height: 26,
    flexShrink: 0,
    borderRadius: 7,
    background: disabled ? t.surfaceGlass : t.accentSoft,
    border: `1px solid ${disabled ? t.border : t.borderAccent}`,
    color: disabled ? t.textFaint : t.accent,
    cursor: disabled ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Inter', sans-serif",
    transition: "all 0.2s ease",
    userSelect: "none",
    padding: 0,
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: t.inputBg,
        border: `1px solid ${t.border}`,
        borderRadius: 9,
        padding: "5px 6px",
        boxSizing: "border-box",
      }}
    >
      <button
        type="button"
        disabled={atMin}
        onMouseDown={() => !atMin && startHold(-1)}
        onMouseUp={stopHold}
        onMouseLeave={stopHold}
        onTouchStart={(e) => { e.preventDefault(); if (!atMin) startHold(-1); }}
        onTouchEnd={stopHold}
        aria-label="Decrease"
        style={btn(atMin)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
      </button>

      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, "");
          if (digits === "") { onChange(min); return; }
          onChange(clamp(parseInt(digits, 10)));
        }}
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: "center",
          background: "transparent",
          border: "none",
          outline: "none",
          color: t.textPrimary,
          fontSize: 14,
          fontWeight: 700,
          fontFamily: "'Space Grotesk', sans-serif",
          letterSpacing: -0.2,
          padding: 0,
        }}
      />

      <button
        type="button"
        disabled={atMax}
        onMouseDown={() => !atMax && startHold(1)}
        onMouseUp={stopHold}
        onMouseLeave={stopHold}
        onTouchStart={(e) => { e.preventDefault(); if (!atMax) startHold(1); }}
        onTouchEnd={stopHold}
        aria-label="Increase"
        style={btn(atMax)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
      </button>
    </div>
  );
}

/* ============= Themed Date Picker (custom calendar) ============= */

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function pad2(n) {
  return String(n).padStart(2, "0");
}
function ymd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function parseYmd(str) {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function formatDateDisplay(str) {
  const d = parseYmd(str);
  if (!d) return "";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function DatePicker({ theme, value, onChange, minDate }) {
  const t = THEMES[theme];
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const selected = parseYmd(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minD = minDate ? parseYmd(minDate) : null;
  if (minD) minD.setHours(0, 0, 0, 0);

  const [viewMonth, setViewMonth] = useState(() => {
    const base = selected || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    if (open) {
      const base = selected || new Date();
      setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    }
    // eslint-disable-next-line
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const gotoMonth = (delta) => setViewMonth(new Date(year, month + delta, 1));

  const isDisabled = (d) => {
    if (!d) return true;
    const dd = new Date(d);
    dd.setHours(0, 0, 0, 0);
    if (minD && dd < minD) return true;
    return false;
  };
  const isSelected = (d) => d && selected && ymd(d) === ymd(selected);
  const isToday = (d) => d && ymd(d) === ymd(today);

  const display = value ? formatDateDisplay(value) : "";

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          background: t.inputBg,
          border: `1px solid ${open ? t.accent : t.border}`,
          borderRadius: 9,
          padding: "9px 12px",
          color: display ? t.textPrimary : t.textMuted,
          fontSize: 14,
          fontFamily: "'Inter', sans-serif",
          cursor: "pointer",
          outline: "none",
          boxShadow: open ? `0 0 0 3px ${t.accentSoft}` : "none",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease, background 0.5s ease",
        }}
      >
        <span style={{ fontWeight: display ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {display || "Select date"}
        </span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={open ? t.accent : t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 200,
            background: t.surfaceElevated,
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: `1px solid ${t.borderStrong}`,
            borderRadius: 16,
            padding: 14,
            boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
            animation: "pickerIn 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)",
            width: 268,
          }}
        >
          {/* Month header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button type="button" onClick={() => gotoMonth(-1)} style={{ width: 30, height: 30, borderRadius: 8, background: t.surfaceGlass, border: `1px solid ${t.border}`, color: t.textSecondary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: t.textPrimary, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.2 }}>
              {MONTHS[month]} {year}
            </div>
            <button type="button" onClick={() => gotoMonth(1)} style={{ width: 30, height: 30, borderRadius: 8, background: t.surfaceGlass, border: `1px solid ${t.border}`, color: t.textSecondary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>

          {/* Weekday labels */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 6 }}>
            {WEEKDAYS.map((w, i) => (
              <div key={i} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.4 }}>{w}</div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {cells.map((d, i) => {
              if (!d) return <div key={`e-${i}`} style={{ height: 32 }} />;
              const disabled = isDisabled(d);
              const sel = isSelected(d);
              const tod = isToday(d);
              return (
                <button
                  key={ymd(d)}
                  type="button"
                  disabled={disabled}
                  onClick={() => { onChange(ymd(d)); setOpen(false); }}
                  style={{
                    height: 32,
                    borderRadius: 8,
                    border: sel ? "none" : tod ? `1px solid ${t.borderAccent}` : "1px solid transparent",
                    background: sel ? t.accentGradient : "transparent",
                    color: sel ? "#fff" : disabled ? t.textFaint : t.textPrimary,
                    fontSize: 12.5,
                    fontWeight: sel || tod ? 700 : 500,
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.4 : 1,
                    fontFamily: "'Inter', sans-serif",
                    boxShadow: sel ? t.glowAccent : "none",
                    transition: "background 0.15s ease, color 0.15s ease",
                  }}
                  onMouseEnter={(e) => { if (!disabled && !sel) e.currentTarget.style.background = t.surfaceGlassHover; }}
                  onMouseLeave={(e) => { if (!disabled && !sel) e.currentTarget.style.background = "transparent"; }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer: Today shortcut */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button
              type="button"
              onClick={() => {
                const tstr = ymd(today);
                if (!minD || today >= minD) { onChange(tstr); setOpen(false); }
              }}
              style={{ padding: "7px 14px", fontSize: 12, fontWeight: 700, borderRadius: 9, background: t.accentSoft, color: t.accent, border: `1px solid ${t.borderAccent}`, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============= Proctoring icons ============= */

function ProctoringIcon({ type, stroke, size }) {
  const s = size * 0.5;
  const common = { width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke, strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (type) {
    case "laptop": return (<svg {...common}><rect x="3" y="4" width="18" height="12" rx="2" /><line x1="2" y1="20" x2="22" y2="20" /></svg>);
    case "browser": return (<svg {...common}><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><circle cx="6" cy="6.5" r="0.6" fill={stroke} /><circle cx="8.5" cy="6.5" r="0.6" fill={stroke} /><circle cx="11" cy="6.5" r="0.6" fill={stroke} /></svg>);
    case "mic": return (<svg {...common}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="8" y1="22" x2="16" y2="22" /></svg>);
    case "camera": return (<svg {...common}><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>);
    case "battery": return (<svg {...common}><rect x="2" y="7" width="18" height="10" rx="2" /><line x1="22" y1="11" x2="22" y2="13" /><rect x="4" y="9" width="8" height="6" fill={stroke} opacity="0.6" /></svg>);
    case "wifi": return (<svg {...common}><path d="M5 12a10 10 0 0 1 14 0" /><path d="M8.5 15.5a5 5 0 0 1 7 0" /><line x1="12" y1="19" x2="12.01" y2="19" /></svg>);
    case "shield": return (<svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>);
    case "eye": return (<svg {...common}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>);
    case "lock": return (<svg {...common}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>);
    case "clock": return (<svg {...common}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>);
    case "monitor": return (<svg {...common}><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>);
    case "user": return (<svg {...common}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>);
    default: return null;
  }
}

/* ============= Animated Background ============= */

function AnimatedBackground({ theme }) {
  const t = THEMES[theme];

  const iconTiles = [
    { type: "laptop",  top: "7%",   left: "2%",  size: 84, dur: 26, delay: 0, rotate: -6 },
    { type: "eye",     top: "30%",  left: "6%",  size: 66, dur: 24, delay: 4, rotate: -4 },
    { type: "wifi",    top: "55%",  left: "2%",  size: 72, dur: 26, delay: 5, rotate: 0 },
    { type: "monitor", bottom: "8%",left: "6%",  size: 80, dur: 30, delay: 1, rotate: -10 },
    { type: "lock",    top: "82%",  left: "1%",  size: 60, dur: 26, delay: 3, rotate: 8 },
    { type: "mic",     top: "7%",   right: "2%", size: 74, dur: 28, delay: 1, rotate: 8 },
    { type: "shield",  top: "28%",  right: "5%", size: 78, dur: 30, delay: 2, rotate: 12 },
    { type: "battery", top: "52%",  right: "2%", size: 78, dur: 24, delay: 6, rotate: 6 },
    { type: "clock",   bottom: "9%",right: "5%", size: 68, dur: 22, delay: 3, rotate: 0 },
    { type: "user",    top: "80%",  right: "2%", size: 62, dur: 30, delay: 5, rotate: -6 },
  ];

  const bubbles = [
    { top: "14%", left: "20%", size: 20, dur: 14, delay: 0 },
    { top: "20%", left: "70%", size: 14, dur: 12, delay: 2 },
    { top: "34%", left: "10%", size: 26, dur: 16, delay: 4 },
    { top: "36%", left: "52%", size: 16, dur: 13, delay: 1 },
    { top: "40%", left: "86%", size: 22, dur: 15, delay: 3 },
    { top: "56%", left: "32%", size: 15, dur: 12, delay: 5 },
    { top: "60%", left: "72%", size: 24, dur: 18, delay: 2 },
    { top: "72%", left: "16%", size: 18, dur: 14, delay: 6 },
    { top: "70%", left: "60%", size: 12, dur: 11, delay: 1 },
    { top: "82%", left: "80%", size: 24, dur: 17, delay: 3 },
    { top: "86%", left: "40%", size: 18, dur: 13, delay: 5 },
    { top: "24%", left: "90%", size: 14, dur: 12, delay: 4 },
    { top: "50%", left: "46%", size: 12, dur: 11, delay: 3 },
  ];

  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      <div style={{ position: "absolute", top: "-12%", left: "-8%", width: 520, height: 520, borderRadius: "50%", background: `radial-gradient(circle, ${t.accent}22 0%, transparent 65%)`, filter: "blur(50px)", animation: "driftFloat 26s ease-in-out infinite" }} />
      <div style={{ position: "absolute", bottom: "-14%", right: "-10%", width: 620, height: 620, borderRadius: "50%", background: `radial-gradient(circle, ${t.accent3}22 0%, transparent 65%)`, filter: "blur(60px)", animation: "driftFloat 32s ease-in-out infinite" }} />
      <div style={{ position: "absolute", top: "40%", left: "48%", width: 380, height: 380, borderRadius: "50%", background: `radial-gradient(circle, ${t.accent2}1c 0%, transparent 65%)`, filter: "blur(60px)", animation: "driftFloat 28s ease-in-out infinite" }} />

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
            boxShadow: t.name === "dark"
              ? `inset 0 1px 1px ${t.bubbleHighlight}, 0 0 12px rgba(255,255,255,0.06)`
              : `inset 0 1px 1px ${t.bubbleHighlight}, 0 4px 10px rgba(75,96,232,0.10)`,
          }}
        >
          <span style={{ position: "absolute", top: "18%", left: "22%", width: b.size * 0.28, height: b.size * 0.28, borderRadius: "50%", background: t.bubbleHighlight, opacity: 0.6, filter: "blur(1px)" }} />
        </div>
      ))}

      {iconTiles.map((item, i) => (
        <div
          key={`icon-${i}`}
          style={{
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
            filter: t.name === "dark" ? "drop-shadow(0 4px 12px rgba(91,140,255,0.15))" : "drop-shadow(0 4px 12px rgba(75,96,232,0.18))",
          }}
        >
          <ProctoringIcon type={item.type} stroke={t.iconStroke} size={item.size * 2} />
        </div>
      ))}
    </div>
  );
}

/* ============= Date/time helpers ============= */

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
  exam_type: "SINGLE_SESSION",
  timeframes: [{ date: "", start_time: "", end_time: "" }],
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

const timeframeDuration = (frame) =>
  calculateDuration(frame?.start_time, frame?.end_time);
const intervalsOverlap = (left, right) => {
  if (!left?.date || !right?.date || left.date !== right.date) return false;
  return left.start_time < right.end_time && right.start_time < left.end_time;
};
/* ============= Field + section helpers ============= */

function Field({ label, error, children, theme, hint }) {
  const t = THEMES[theme];
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11.5, color: t.label, display: "block", marginBottom: 6, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
        {label}
      </label>
      {children}
      {hint && !error && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 5 }}>{hint}</div>}
      {error && <div style={{ fontSize: 11, color: t.danger, marginTop: 5, fontWeight: 600 }}>{error}</div>}
    </div>
  );
}

function SectionCard({ title, children, theme, danger, style }) {
  const t = THEMES[theme];
  return (
    <div
      style={{
        background: t.cardSurface,
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        border: `1px solid ${danger ? t.danger + "66" : t.border}`,
        borderRadius: 16,
        padding: 20,
        boxShadow: t.name === "light" ? "0 6px 20px rgba(20,28,60,0.06)" : "0 4px 20px rgba(0,0,0,0.10)",
        transition: "background 0.55s ease, border-color 0.4s ease, box-shadow 0.5s ease",
        ...style,
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
    <div style={{ marginBottom: desc ? 14 : 16 }}>
      <div style={{ fontSize: 13, color: t.textPrimary, fontWeight: 700, letterSpacing: 0.3, fontFamily: "'Space Grotesk', sans-serif", display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ display: "inline-block", width: 22, height: 2, borderRadius: 2, background: t.accentGradient }} />
        {children}
      </div>
      {desc && <p style={{ fontSize: 11.5, color: t.textMuted, margin: "8px 0 0", lineHeight: 1.5 }}>{desc}</p>}
    </div>
  );
}

export default function CreateExam({ onBack, onCreated }) {
  const { theme, toggleTheme } = useTheme();
  const t = THEMES[theme];

  const { user, accessToken } = useAuthStore();
  const [form, setForm] = useState(defaultForm);
  const [websiteInput, setWebsiteInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);
  const [focusField, setFocusField] = useState("");
  const [websitePreviews, setWebsitePreviews] = useState({});
  const [previewLoading, setPreviewLoading] = useState({});
  const redirectTimerRef = useRef(null);
  const saveInFlightRef = useRef(false);

  const headers = { Authorization: `Bearer ${accessToken}` };

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const inputStyle = (name) => ({
    background: t.inputBg,
    border: `1px solid ${focusField === name ? t.accent : t.border}`,
    borderRadius: 9,
    padding: "9px 12px",
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
    if (form.exam_type === "MULTI_SESSION") {
      const frames = form.timeframes || [];
      if (frames.length < 1 || frames.length > 4) {
        e.timeframes = "Add between 1 and 4 timeframes";
      } else {
        frames.forEach((frame, index) => {
          if (!frame.date || !frame.start_time || !frame.end_time) {
            e.timeframes = `Complete all fields in timeframe ${index + 1}`;
          } else if (frame.date < todayStr()) {
            e.timeframes = `Timeframe ${index + 1} cannot be in the past`;
          } else if (frame.end_time <= frame.start_time) {
            e.timeframes = `Timeframe ${index + 1} end must be after start`;
          } else if (frame.date === todayStr() && frame.start_time < nowTimeStr()) {
            e.timeframes = `Timeframe ${index + 1} cannot start in the past`;
          }
        });
        for (let i = 0; i < frames.length; i += 1) {
          for (let j = i + 1; j < frames.length; j += 1) {
            if (intervalsOverlap(frames[i], frames[j])) {
              e.timeframes = "Flexible timeframes cannot overlap";
            }
          }
        }
      }
    } else {
      if (!form.date) e.date = "Date is required";
      else if (form.date < todayStr()) e.date = "Date cannot be in the past";
      if (!form.start_time) e.start_time = "Start time is required";
      if (!form.end_time) e.end_time = "End time is required";
      if (form.start_time && form.end_time && form.end_time <= form.start_time) e.end_time = "End must be after start";
      if (form.date === todayStr() && form.start_time && form.start_time < nowTimeStr()) e.start_time = "Cannot be in the past";
    }
    const effectiveDuration = form.exam_type === "MULTI_SESSION"
      ? timeframeDuration(form.timeframes?.[0])
      : form.duration_minutes;
    if (effectiveDuration < 1) e.duration_minutes = "Min 1 minute";
    if (form.violation_threshold < 1) e.violation_threshold = "Min 1";
    if (form.allowed_websites.length === 0) e.websites = "Add at least one website";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const setStartTime = (val) => {
    setForm((prev) => ({ ...prev, start_time: val, duration_minutes: calculateDuration(val, prev.end_time) }));
    setErrors((prev) => ({
      ...prev,
      start_time: form.date === todayStr() && val && val < nowTimeStr() ? "Cannot be in the past" : undefined,
      end_time: form.end_time && val && form.end_time <= val ? "End must be after start" : undefined,
    }));
  };

  const setEndTime = (val) => {
    setForm((prev) => ({ ...prev, end_time: val, duration_minutes: calculateDuration(prev.start_time, val) }));
    setErrors((prev) => ({
      ...prev,
      end_time: form.start_time && val && val <= form.start_time ? "End must be after start" : undefined,
    }));
  };

  const setExamType = (examType) => {
    setForm((previous) => ({
      ...previous,
      exam_type: examType,
      timeframes:
        previous.timeframes?.length
          ? previous.timeframes
          : [{ date: "", start_time: "", end_time: "" }],
    }));
    setErrors((previous) => ({ ...previous, timeframes: undefined }));
  };
  const updateTimeframe = (index, key, value) => {
    setForm((previous) => {
      const timeframes = previous.timeframes.map((frame, frameIndex) =>
        frameIndex === index ? { ...frame, [key]: value } : frame
      );
      return {
        ...previous,
        timeframes,
        duration_minutes: timeframeDuration(timeframes[0]),
      };
    });
    setErrors((previous) => ({ ...previous, timeframes: undefined }));
  };
  const addTimeframe = () => {
    setForm((previous) =>
      previous.timeframes.length >= 4
        ? previous
        : {
            ...previous,
            timeframes: [
              ...previous.timeframes,
              { date: "", start_time: "", end_time: "" },
            ],
          }
    );
  };
  const removeTimeframe = (index) => {
    setForm((previous) => {
      if (previous.timeframes.length <= 1) return previous;
      const timeframes = previous.timeframes.filter((_, frameIndex) => frameIndex !== index);
      return {
        ...previous,
        timeframes,
        duration_minutes: timeframeDuration(timeframes[0]),
      };
    });
  };
  const normalizeWebsiteUrl = (value) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    try {
      return new URL(withProtocol).toString();
    } catch {
      return "";
    }
  };

  const websiteHost = (value) => {
    try {
      return new URL(normalizeWebsiteUrl(value)).hostname.replace(/^www\./i, "");
    } catch {
      return value;
    }
  };

  const capturePreview = async (url) => {
    if (!window.electronAPI?.captureWebsitePreview) {
      setWebsitePreviews((prev) => ({
        ...prev,
        [url]: { error: "Preview is available only in the Electron application." },
      }));
      return;
    }

    setPreviewLoading((prev) => ({ ...prev, [url]: true }));

    try {
      const result = await window.electronAPI.captureWebsitePreview(url);
      if (!result?.success || !result?.dataUrl) {
        throw new Error(result?.error || "Unable to capture website preview");
      }

      setWebsitePreviews((prev) => ({
        ...prev,
        [url]: {
          dataUrl: result.dataUrl,
          title: result.title,
          finalUrl: result.finalUrl,
          error: "",
        },
      }));
    } catch (error) {
      setWebsitePreviews((prev) => ({
        ...prev,
        [url]: {
          error: error?.message || "Unable to capture website preview",
        },
      }));
    } finally {
      setPreviewLoading((prev) => ({ ...prev, [url]: false }));
    }
  };

  const addWebsite = () => {
    const url = normalizeWebsiteUrl(websiteInput);
    if (!url) {
      setErrors((prev) => ({ ...prev, websites: "Enter a valid website address" }));
      return;
    }

    if (!form.allowed_websites.includes(url)) {
      set("allowed_websites", [...form.allowed_websites, url]);
    }

    setErrors((prev) => ({ ...prev, websites: undefined }));
    setWebsiteInput("");
    capturePreview(url);
  };

  const removeWebsite = (url) => {
    set("allowed_websites", form.allowed_websites.filter((w) => w !== url));
    setWebsitePreviews((prev) => {
      const next = { ...prev };
      delete next[url];
      return next;
    });
    setPreviewLoading((prev) => {
      const next = { ...prev };
      delete next[url];
      return next;
    });
  };

  const handleSave = async (status = "Published") => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await axios.post(
        `${API}/api/exams`,
        {
          ...form,
          duration_minutes:
            form.exam_type === "MULTI_SESSION"
              ? timeframeDuration(form.timeframes[0])
              : calculateDuration(form.start_time, form.end_time),
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
      @keyframes pickerIn { from { opacity: 0; transform: translateY(-8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes ringPulse { 0% { transform: scale(0.9); opacity: 0.7; } 100% { transform: scale(1.7); opacity: 0; } }
      @keyframes cardEnter { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
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
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: ${t.borderStrong}; border-radius: 999px; }
      ::-webkit-scrollbar-thumb:hover { background: ${t.accent}; }
      .wheel-scroll::-webkit-scrollbar { display: none; width: 0; height: 0; }
      button, a, input, textarea { transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, opacity 0.2s ease; }
      input::placeholder, textarea::placeholder { color: ${t.textMuted}; opacity: 0.8; }
    `}</style>
  );

  if (saved) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: t.canvas, backgroundImage: t.canvasTint, color: t.textPrimary, fontFamily: "'Inter', sans-serif", transition: "background 0.7s ease, color 0.6s ease", position: "relative" }}>
        {globalStyle}
        <AnimatedBackground theme={theme} />
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ position: "relative", width: 100, height: 100, marginBottom: 24 }}>
            <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${t.success}`, opacity: 0.55, animation: "ringPulse 2s ease-out infinite" }} />
            <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${t.success}`, opacity: 0.35, animation: "ringPulse 2s ease-out 0.7s infinite" }} />
            <div style={{ position: "absolute", inset: 12, borderRadius: "50%", background: t.successGradient, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: t.glowSuccess, animation: "popIn 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55)" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.4, margin: 0, color: t.textPrimary }}>Exam Created</h2>
          <p style={{ color: t.textSecondary, marginTop: 8, fontSize: 14 }}>Redirecting to exam list...</p>
        </div>
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
        overflow: "hidden",
      }}
    >
      {globalStyle}
      <AnimatedBackground theme={theme} />

      {/* Header */}
      <header
        style={{
          minHeight: 60,
          background: t.surface,
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderBottom: `1px solid ${t.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 22px",
          gap: 14,
          flexShrink: 0,
          position: "relative",
          zIndex: 10,
          transition: "background 0.55s ease, border-color 0.5s ease",
        }}
      >
        <BackButton theme={theme} onClick={onBack} />
        <div style={{ width: 1, height: 22, background: t.borderStrong }} />
        <span style={{ fontWeight: 700, fontSize: 15.5, color: t.textPrimary, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: -0.2 }}>
          Create New Exam
        </span>
        <div style={{ marginLeft: "auto" }}>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, padding: "18px 22px", position: "relative", zIndex: 1, display: "flex", flexDirection: "column" }}>
        {errors.submit && (
          <div style={{ background: t.dangerBg, border: `1px solid ${t.danger}66`, borderRadius: 10, padding: "10px 14px", color: t.danger, fontSize: 13, marginBottom: 14, display: "flex", gap: 9, alignItems: "center", flexShrink: 0, fontWeight: 600 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            <span>{errors.submit}</span>
          </div>
        )}

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            gridTemplateRows: "1fr auto",
            gap: 16,
            maxWidth: 1180,
            width: "100%",
            margin: "0 auto",
            animation: "cardEnter 0.5s ease",
          }}
        >
          {/* LEFT COLUMN — Basic info */}
          <SectionCard theme={theme} style={{ gridRow: "1 / 2", overflow: "visible", display: "flex", flexDirection: "column" }} title={<SectionHeading theme={theme}>Basic Information</SectionHeading>}>
            <div style={{ overflowY: "visible", paddingRight: 6, flex: 1, minHeight: 0 }}>
              <Field label="Exam Name *" error={errors.name} theme={theme}>
                <input value={form.name} onChange={(e) => set("name", e.target.value)} onFocus={() => setFocusField("name")} onBlur={() => setFocusField("")} placeholder="e.g. Java Technical Assessment" style={inputStyle("name")} />
              </Field>

              <Field label="Description" theme={theme}>
                <textarea value={form.description} onChange={(e) => set("description", e.target.value)} onFocus={() => setFocusField("description")} onBlur={() => setFocusField("")} rows={3} placeholder="Brief description of this exam..." style={{ ...inputStyle("description"), resize: "none", lineHeight: 1.55 }} />
              </Field>

              <Field label="Exam Type *" theme={theme}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {["SINGLE_SESSION", "MULTI_SESSION"].map((type) => {
                    const selected = form.exam_type === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setExamType(type)}
                        style={{
                          padding: "11px 12px",
                          borderRadius: 11,
                          border: `1px solid ${selected ? t.borderAccent : t.border}`,
                          background: selected ? t.accentSoft : t.inputBg,
                          color: selected ? t.accent : t.textSecondary,
                          textAlign: "left",
                          cursor: "pointer",
                          fontFamily: "'Inter', sans-serif",
                          fontWeight: 700,
                        }}
                      >
                        {type === "SINGLE_SESSION" ? "Single-Session Exam" : "Multi-Session Exam"}
                        <div style={{ marginTop: 4, fontSize: 10.5, fontWeight: 500, color: t.textMuted, lineHeight: 1.4 }}>
                          {type === "SINGLE_SESSION"
                            ? "One examiner-controlled session."
                            : "Multiple examiner-controlled sessions; each candidate attends once."}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Field>

              {form.exam_type === "SINGLE_SESSION" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <Field label="Date *" error={errors.date} theme={theme}>
                    <DatePicker
                      theme={theme}
                      value={form.date}
                      minDate={todayStr()}
                      onChange={(val) => {
                        set("date", val);
                        setErrors((prev) => ({ ...prev, date: val && val < todayStr() ? "Cannot be in the past" : undefined, start_time: val === todayStr() && form.start_time && form.start_time < nowTimeStr() ? "Cannot be in the past" : undefined }));
                      }}
                    />
                  </Field>
                  <Field label="Start *" error={errors.start_time} theme={theme}>
                    <WheelTimePicker theme={theme} value={form.start_time} onChange={setStartTime} minValue={form.date === todayStr() ? nowTimeStr() : undefined} />
                  </Field>
                  <Field label="End *" error={errors.end_time} theme={theme}>
                    <WheelTimePicker theme={theme} value={form.end_time} onChange={setEndTime} minValue={form.start_time || undefined} />
                  </Field>
                </div>
              ) : (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontSize: 11.5, color: t.label, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
                      Available Timeframes *
                    </div>
                    <span style={{ fontSize: 10.5, color: t.textMuted }}>{form.timeframes.length}/4</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {form.timeframes.map((frame, index) => (
                      <div key={`timeframe-${index}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "end", padding: 10, borderRadius: 12, border: `1px solid ${t.border}`, background: t.surfaceGlass }}>
                        <Field label={`Date ${index + 1}`} theme={theme}>
                          <DatePicker theme={theme} value={frame.date} minDate={todayStr()} onChange={(value) => updateTimeframe(index, "date", value)} />
                        </Field>
                        <Field label="Start" theme={theme}>
                          <WheelTimePicker theme={theme} value={frame.start_time} onChange={(value) => updateTimeframe(index, "start_time", value)} minValue={frame.date === todayStr() ? nowTimeStr() : undefined} />
                        </Field>
                        <Field label="End" theme={theme}>
                          <WheelTimePicker theme={theme} value={frame.end_time} onChange={(value) => updateTimeframe(index, "end_time", value)} minValue={frame.start_time || undefined} />
                        </Field>
                        <div style={{ display: "flex", gap: 6, paddingBottom: 14 }}>
                          {index === form.timeframes.length - 1 && form.timeframes.length < 4 ? (
                            <button type="button" title="Add timeframe" onClick={addTimeframe} style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${t.borderAccent}`, background: t.accentSoft, color: t.accent, fontSize: 20, cursor: "pointer" }}>+</button>
                          ) : null}
                          {form.timeframes.length > 1 ? (
                            <button type="button" title="Remove timeframe" onClick={() => removeTimeframe(index)} style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${t.danger}55`, background: t.dangerBg, color: t.danger, fontSize: 18, cursor: "pointer" }}>×</button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                  {errors.timeframes ? <div style={{ fontSize: 11, color: t.danger, marginTop: 6, fontWeight: 600 }}>{errors.timeframes}</div> : null}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Duration (min)" error={errors.duration_minutes} theme={theme} hint="Auto from start & end time">
                  <input type="number" value={form.duration_minutes} readOnly tabIndex={-1} style={{ ...inputStyle("duration"), background: t.inputReadonly, cursor: "not-allowed", opacity: 0.9, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }} />
                </Field>
                <Field label="Violation Threshold" error={errors.violation_threshold} theme={theme} hint="Locks at this risk score">
                  <Stepper
                    theme={theme}
                    value={form.violation_threshold}
                    min={1}
                    max={100}
                    onChange={(v) => set("violation_threshold", v)}
                  />
                </Field>
              </div>
            </div>
          </SectionCard>

          {/* RIGHT COLUMN — Websites + Instructions */}
          <div style={{ gridRow: "1 / 2", minHeight: 0, display: "flex", flexDirection: "column", gap: 16, overflow: "hidden" }}>
            <SectionCard
              theme={theme}
              danger={Boolean(errors.websites)}
              style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: "1.25 1 0" }}
              title={<SectionHeading theme={theme} desc="Each added website is captured by Electron Chromium and shown below as a small visual preview.">Allowed Websites *</SectionHeading>}
            >
              {errors.websites && <div style={{ fontSize: 11, color: t.danger, marginBottom: 8, fontWeight: 600 }}>{errors.websites}</div>}

              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexShrink: 0 }}>
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
                <button type="button" onClick={addWebsite} style={{ padding: "9px 18px", fontSize: 13, fontWeight: 700, borderRadius: 9, background: t.accentGradient, color: "#fff", border: "none", cursor: "pointer", fontFamily: "'Inter', sans-serif", boxShadow: t.glowAccent, flexShrink: 0 }}>
                  Add
                </button>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4 }}>
                {form.allowed_websites.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: t.textMuted, padding: "8px 0" }}>
                    No websites added yet.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                    {form.allowed_websites.map((url) => {
                      const preview = websitePreviews[url];
                      const isLoading = Boolean(previewLoading[url]);

                      return (
                        <div
                          key={url}
                          style={{
                            minWidth: 0,
                            overflow: "hidden",
                            borderRadius: 11,
                            border: `1px solid ${preview?.error ? `${t.danger}66` : t.borderStrong}`,
                            background: t.surfaceGlass,
                          }}
                        >
                          <div style={{ height: 88, position: "relative", overflow: "hidden", background: t.inputReadonly }}>
                            {preview?.dataUrl ? (
                              <img
                                src={preview.dataUrl}
                                alt={`Preview of ${websiteHost(url)}`}
                                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }}
                              />
                            ) : (
                              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7, padding: 10, color: preview?.error ? t.danger : t.textMuted, textAlign: "center", fontSize: 10.5 }}>
                                {isLoading ? (
                                  <>
                                    <span style={{ width: 18, height: 18, border: `2px solid ${t.borderStrong}`, borderTopColor: t.accent, borderRadius: "50%", animation: "spin 0.75s linear infinite" }} />
                                    Capturing preview...
                                  </>
                                ) : (
                                  <>
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /></svg>
                                    {preview?.error || "Preview not captured"}
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          <div style={{ padding: "8px 9px", display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${t.border}` }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div title={preview?.title || websiteHost(url)} style={{ fontSize: 10.5, fontWeight: 700, color: t.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {preview?.title || websiteHost(url)}
                              </div>
                              <div title={url} style={{ marginTop: 2, fontSize: 9, color: t.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {websiteHost(url)}
                              </div>
                            </div>

                            <button type="button" disabled={isLoading} onClick={() => capturePreview(url)} title="Refresh preview" style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${t.border}`, background: t.surfaceGlass, color: t.textSecondary, cursor: isLoading ? "wait" : "pointer", padding: 0, flexShrink: 0 }}>
                              ↻
                            </button>

                            <button type="button" onClick={() => removeWebsite(url)} title="Remove website" style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${t.danger}44`, background: t.dangerBg, color: t.danger, cursor: "pointer", padding: 0, flexShrink: 0 }}>
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard
              theme={theme}
              style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: "0.75 1 0" }}
              title={<SectionHeading theme={theme} desc="Shown to candidates on the Instructions screen before the exam begins.">Candidate Instructions</SectionHeading>}
            >
              <textarea
                value={form.instructions}
                onChange={(e) => set("instructions", e.target.value)}
                onFocus={() => setFocusField("instr")}
                onBlur={() => setFocusField("")}
                placeholder="e.g. This is a 2-hour Java assessment. Keep your camera on at all times. Read all questions carefully..."
                style={{ ...inputStyle("instr"), resize: "none", lineHeight: 1.65, flex: 1, minHeight: 0 }}
              />
            </SectionCard>
          </div>

          {/* FOOTER ACTIONS */}
          <div style={{ gridColumn: "1 / -1", gridRow: "2 / 3", display: "flex", gap: 12, justifyContent: "flex-end", alignItems: "center", flexShrink: 0 }}>
            <button
              onClick={() => handleSave("Draft")}
              disabled={loading}
              style={{ padding: "12px 24px", fontSize: 14, fontWeight: 700, borderRadius: 12, background: t.surfaceGlass, color: t.textPrimary, border: `1px solid ${t.borderStrong}`, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'Inter', sans-serif", opacity: loading ? 0.6 : 1 }}
            >
              Save as Draft
            </button>
            <button
              onClick={() => handleSave("Published")}
              disabled={loading}
              style={{ padding: "12px 28px", fontSize: 14, fontWeight: 700, borderRadius: 12, background: t.accentGradient, color: "#fff", border: "none", cursor: loading ? "not-allowed" : "pointer", fontFamily: "'Inter', sans-serif", letterSpacing: 0.3, boxShadow: loading ? "none" : t.glowAccent, opacity: loading ? 0.7 : 1, display: "inline-flex", alignItems: "center", gap: 8 }}
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
