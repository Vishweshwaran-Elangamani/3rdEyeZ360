import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import useAuthStore from "../store/authStore";
import useExamStore from "../store/examStore";
import appIcon from "../../assets/icons/app-icon (2).png";

const API = "http://localhost:3000";

const LOCK_STATE = {
  IDLE: "idle",
  SUCCESS: "success",
  ERROR: "error",
};

const FLOAT_SYMBOLS = [
  { top: "12%", left: "8%",  size: 46, dur: 14, delay: 0,   type: "eye" },
  { top: "22%", left: "72%", size: 38, dur: 18, delay: 2,   type: "mic" },
  { top: "48%", left: "18%", size: 42, dur: 16, delay: 4,   type: "shield" },
  { top: "38%", left: "82%", size: 40, dur: 20, delay: 1,   type: "chip" },
  { top: "68%", left: "12%", size: 36, dur: 15, delay: 3,   type: "face" },
  { top: "72%", left: "68%", size: 44, dur: 22, delay: 2.5, type: "wave" },
  { top: "85%", left: "40%", size: 34, dur: 17, delay: 5,   type: "lock" },
];

const VALUE_STRIP = [
  { label: "AI+",  caption: "Live behavior analysis" },
  { label: "360°", caption: "Audio, video & screen watch" },
  // { label: "E2E",  caption: "Encrypted by default" },
];

function getFriendlyErrorMessage(err) {
  if (!err) return "Something went wrong. Please try again.";

  if (err.code === "ERR_NETWORK" || err.message === "Network Error") {
    return "Unable to reach the server. Check your internet connection and try again.";
  }
  if (err.code === "ECONNABORTED") {
    return "The request took too long. Please try again.";
  }

  const status = err?.response?.status;
  const data = err?.response?.data;

  let rawText = "";
  if (typeof data === "string") {
    rawText = data;
  } else if (data && typeof data === "object") {
    rawText = [
      data.detail,
      data.message,
      data.error,
      data.error_description,
    ]
      .filter(Boolean)
      .map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
      .join(" ");
  }
  rawText = rawText.toLowerCase();

  if (
    status === 401 ||
    rawText.includes("invalid_grant") ||
    rawText.includes("invalid user credentials") ||
    rawText.includes("invalid credentials") ||
    rawText.includes("wrong password") ||
    rawText.includes("incorrect password")
  ) {
    return "Incorrect email or password. Please try again.";
  }
  if (rawText.includes("user not found") || rawText.includes("no such user")) {
    return "No account found with this email address.";
  }
  if (rawText.includes("disabled")) {
    return "Your account has been disabled. Please contact your administrator.";
  }
  if (rawText.includes("locked")) {
    return "Your account is temporarily locked. Please try again later.";
  }
  if (rawText.includes("not verified") || rawText.includes("email not verified")) {
    return "Please verify your email address before signing in.";
  }
  if (status === 429 || rawText.includes("too many")) {
    return "Too many sign-in attempts. Please wait a moment and try again.";
  }
  if (status === 403) {
    return "You don't have permission to access this workspace.";
  }
  if (status === 404) {
    return "Sign-in service is unavailable. Please contact support.";
  }
  if (status >= 500) {
    return "The server is currently unavailable. Please try again in a few moments.";
  }
  return "Unable to sign in. Please check your credentials and try again.";
}

function renderFloatSymbol(type) {
  const stroke = "rgba(180, 190, 220, 1)";
  switch (type) {
    case "eye":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "mic":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.2">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "chip":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.2">
          <rect x="6" y="6" width="12" height="12" rx="2" />
          <rect x="9" y="9" width="6" height="6" />
          <line x1="9" y1="2" x2="9" y2="6" />
          <line x1="15" y1="2" x2="15" y2="6" />
          <line x1="9" y1="18" x2="9" y2="22" />
          <line x1="15" y1="18" x2="15" y2="22" />
          <line x1="2" y1="9" x2="6" y2="9" />
          <line x1="2" y1="15" x2="6" y2="15" />
          <line x1="18" y1="9" x2="22" y2="9" />
          <line x1="18" y1="15" x2="22" y2="15" />
        </svg>
      );
    case "face":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.2">
          <path d="M3 7V5a2 2 0 0 1 2-2h2" />
          <path d="M17 3h2a2 2 0 0 1 2 2v2" />
          <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
          <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
          <circle cx="9" cy="10" r="1" />
          <circle cx="15" cy="10" r="1" />
          <path d="M9 15c1 1 2 1 3 1s2 0 3-1" />
        </svg>
      );
    case "wave":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.2" strokeLinecap="round">
          <line x1="3"  y1="12" x2="3"  y2="12" />
          <line x1="7"  y1="8"  x2="7"  y2="16" />
          <line x1="11" y1="4"  x2="11" y2="20" />
          <line x1="15" y1="8"  x2="15" y2="16" />
          <line x1="19" y1="10" x2="19" y2="14" />
        </svg>
      );
    case "lock":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.2">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      );
    default:
      return null;
  }
}

function LockAnimation({ hasEmail, hasPassword, lockState }) {
  const isError = lockState === LOCK_STATE.ERROR;
  const isSuccess = lockState === LOCK_STATE.SUCCESS;
  const keyInserted = hasEmail && hasPassword;

  const lockStroke = isError ? "#ff6b6b" : isSuccess ? "#4ade80" : "#a8b1c9";
  const lockGlow = isError
    ? "rgba(255,107,107,0.5)"
    : isSuccess
    ? "rgba(74,222,128,0.5)"
    : "rgba(79,142,247,0.35)";
  const lockFill = isError
    ? "rgba(255,107,107,0.08)"
    : isSuccess
    ? "rgba(74,222,128,0.08)"
    : "rgba(79,142,247,0.06)";

  const statusText = isError
    ? "Access Denied"
    : isSuccess
    ? "Access Granted"
    : keyInserted
    ? "Ready to Unlock"
    : hasEmail
    ? "Key Detected"
    : "Awaiting Credentials";

  const statusColor = isError
    ? "#ff6b6b"
    : isSuccess
    ? "#4ade80"
    : keyInserted
    ? "#d5cdab"
    : hasEmail
    ? "#a8b1c9"
    : "#4a4f63";

  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
      <div
        style={{
          position: "relative",
          width: 180,
          height: 130,
          animation: isError ? "shakeError 0.5s ease" : "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at center, ${lockGlow} 0%, transparent 70%)`,
            animation: "glowBreath 3s ease-in-out infinite",
            filter: "blur(8px)",
            transition: "background 0.3s ease",
          }}
        />

        {isSuccess && (
          <>
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: 80,
                height: 80,
                marginLeft: -40,
                marginTop: -40,
                borderRadius: "50%",
                border: "2px solid rgba(74,222,128,0.6)",
                animation: "ringPulse 1.2s ease-out forwards",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: 80,
                height: 80,
                marginLeft: -40,
                marginTop: -40,
                borderRadius: "50%",
                border: "2px solid rgba(74,222,128,0.4)",
                animation: "ringPulse 1.4s ease-out 0.15s forwards",
              }}
            />
          </>
        )}

        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <svg
            width="100"
            height="112"
            viewBox="0 0 100 112"
            fill="none"
            style={{ overflow: "visible", display: "block" }}
          >
            {/* Draw the lock body first so its top border can never cut across
                or hide the curved shackle during the unlock animation. */}
            <rect
              x="18"
              y="48"
              width="64"
              height="54"
              rx="9"
              stroke={lockStroke}
              strokeWidth="3.5"
              fill={lockFill}
              style={{ transition: "all 0.3s ease" }}
            />

            {/* The complete shackle is rendered above the body and SVG overflow
                remains visible, preventing clipping while it rotates open. */}
            <g
              style={{
                transformOrigin: "25px 49px",
                animation: isSuccess ? "shackleOpen 0.65s ease-out forwards" : "none",
                transition: "stroke 0.3s ease",
              }}
            >
              <path
                d="M25 49 V35 C25 13 75 13 75 35 V49"
                stroke={lockStroke}
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </g>

            {!isSuccess && !isError && (
              <>
                <circle cx="50" cy="69" r="5" fill={lockStroke} opacity="0.9" />
                <rect x="48" y="72" width="4" height="12" fill={lockStroke} opacity="0.9" />
              </>
            )}

            {isError && (
              <g
                style={{
                  transformOrigin: "50px 75px",
                  animation: "xPop 0.4s ease-out forwards",
                }}
              >
                <line x1="41" y1="67" x2="59" y2="83" stroke="#ff6b6b" strokeWidth="4" strokeLinecap="round" />
                <line x1="59" y1="67" x2="41" y2="83" stroke="#ff6b6b" strokeWidth="4" strokeLinecap="round" />
              </g>
            )}

            {isSuccess && (
              <path
                d="M39 73 L48 82 L63 64"
                stroke="#4ade80"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                strokeDasharray="30"
                style={{ animation: "checkPop 0.6s ease-out 0.3s forwards" }}
              />
            )}
          </svg>
        </div>

        {hasEmail && !isSuccess && !isError && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              right: 0,
              transform: "translateY(-50%)",
              animation: keyInserted
                ? "keyInsert 0.7s ease-in-out forwards"
                : "keyEnter 0.5s ease-out forwards, keyFloat 3s ease-in-out infinite 0.5s",
            }}
          >
            <svg width="60" height="26" viewBox="0 0 60 26" fill="none">
              <rect x="18" y="10" width="30" height="6" rx="2" fill="#C0C0C0" />
              <rect x="20" y="16" width="4" height="6" fill="#C0C0C0" />
              <rect x="28" y="16" width="4" height="4" fill="#C0C0C0" />
              <rect x="36" y="16" width="4" height="6" fill="#C0C0C0" />
              <circle cx="52" cy="13" r="7" stroke="#C0C0C0" strokeWidth="3" fill="none" />
              <circle cx="52" cy="13" r="2" fill="#C0C0C0" />
              <rect x="18" y="10" width="30" height="2" rx="1" fill="rgba(255,255,255,0.4)" />
            </svg>
          </div>
        )}

        <div
          style={{
            position: "absolute",
            bottom: -22,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 11,
            letterSpacing: 1,
            fontWeight: 500,
            textTransform: "uppercase",
            color: statusColor,
            transition: "color 0.3s ease",
          }}
        >
          {statusText}
        </div>
      </div>
    </div>
  );
}

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [transitionPhase, setTransitionPhase] = useState("idle");
  const transitionTimers = useRef([]);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState("");
  const [lockState, setLockState] = useState(LOCK_STATE.IDLE);

  const setAuth = useAuthStore((s) => s.setAuth);
  const resetExam = useExamStore((s) => s.reset);

  const hasEmail = email.trim().length > 0;
  const hasPassword = password.trim().length > 0;

  useEffect(() => {
    if (lockState === LOCK_STATE.ERROR && (email || password)) {
      setLockState(LOCK_STATE.IDLE);
      setError("");
    }
  }, [email, password]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      transitionTimers.current.forEach(clearTimeout);
    };
  }, []);

  const handleLogin = async () => {
    if (loading) return;

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError("Please enter both your email and password.");
      setLockState(LOCK_STATE.ERROR);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await axios.post(`${API}/api/auth/login`, {
        email: cleanEmail,
        password: cleanPassword,
      });

      // Do not write authentication into the global store yet. The application
      // may render the dashboard as soon as accessToken changes, which would
      // skip the success animation even if onLogin itself is delayed.
      setLockState(LOCK_STATE.SUCCESS);
      setTransitionPhase("unlocking");

      // Keep the unlocked lock and Access Granted state visible for 2.8 seconds.
      const handoffTimer = setTimeout(() => {
        setTransitionPhase("handoff");
      }, 1800);

      // After the visible 1.2 second handoff, commit authentication and route.
      const navigationTimer = setTimeout(() => {
        resetExam();
        setAuth(res.data.user, res.data.access_token, res.data.refresh_token);
        onLogin?.(res.data.user);
      }, 4000);

      transitionTimers.current = [handoffTimer, navigationTimer];
    } catch (e) {
      const friendly = getFriendlyErrorMessage(e);
      setError(friendly);
      setLockState(LOCK_STATE.ERROR);
      setTransitionPhase("idle");
      setLoading(false);
      return;
    }

  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleLogin();
  };

  const inputBaseStyle = {
    width: "100%",
    padding: "12px 14px 12px 42px",
    fontSize: 14,
    color: "#e8eaf0",
    background: "#0f1117",
    border: "1px solid #2e3347",
    borderRadius: 10,
    outline: "none",
    transition: "all 0.2s ease",
    boxSizing: "border-box",
    fontFamily: "'Inter', sans-serif",
  };

  const inputFocusStyle = {
    borderColor: "#4f8ef7",
    boxShadow: "0 0 0 3px rgba(79,142,247,0.15)",
  };

  const inputIconStyle = {
    position: "absolute",
    left: 14,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#6b7085",
    pointerEvents: "none",
  };

  const labelStyle = {
    fontSize: 12,
    color: "#a0a5b8",
    marginBottom: 8,
    display: "block",
    fontWeight: 500,
    letterSpacing: 0.4,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "#0a0c12",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        position: "relative",
        overflow: "hidden",
        animation:
          transitionPhase === "handoff"
            ? "loginPageExit 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards"
            : transitionPhase === "unlocking"
            ? "verifiedGlow 1.4s ease-in-out 2"
            : "none",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:ital,wght@0,300;0,400;0,600;0,700;0,800;1,300;1,400;1,600;1,700;1,800&display=swap');

        @keyframes spin { to { transform: rotate(360deg); } }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes verifiedGlow {
          0%, 100% { box-shadow: inset 0 0 0 rgba(74,222,128,0); }
          50% { box-shadow: inset 0 0 110px rgba(74,222,128,0.1); }
        }
        @keyframes handoffBackdrop {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes handoffPanel {
          from { opacity: 0; transform: translateY(30px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes dashboardMark {
          0% { opacity: 0; transform: scale(0.55) rotate(-12deg); }
          75% { opacity: 1; transform: scale(1.08) rotate(2deg); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
        }
        @keyframes handoffBar {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes loginPageExit {
          from { opacity: 1; transform: scale(1); filter: blur(0); }
          to { opacity: 0; transform: scale(1.05); filter: blur(9px); }
        }

        @keyframes drift {
          0%   { transform: translate(0, 0); }
          50%  { transform: translate(14px, -18px); }
          100% { transform: translate(0, 0); }
        }

        @keyframes softPulse {
          0%, 100% { opacity: 0.06; }
          50%      { opacity: 0.14; }
        }

        @keyframes softGlow {
          0%, 100% { opacity: 0.35; }
          50%      { opacity: 0.55; }
        }

        @keyframes keyEnter {
          0%   { opacity: 0; transform: translate(60px, 10px) rotate(-8deg); }
          100% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
        }

        @keyframes keyFloat {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50%      { transform: translate(-3px, -4px) rotate(-3deg); }
        }

        @keyframes keyInsert {
          0%   { transform: translate(0, 0) rotate(0deg); }
          60%  { transform: translate(-38px, -6px) rotate(-4deg); }
          100% { transform: translate(-46px, -2px) rotate(0deg); }
        }

        @keyframes shackleOpen {
          0%   { transform: rotate(0deg) translateY(0); }
          100% { transform: rotate(-25deg) translateY(-3px); }
        }

        @keyframes shakeError {
          0%, 100% { transform: translateX(0); }
          20%      { transform: translateX(-6px); }
          40%      { transform: translateX(6px); }
          60%      { transform: translateX(-4px); }
          80%      { transform: translateX(4px); }
        }

        @keyframes xPop {
          0%   { opacity: 0; transform: scale(0.4); }
          70%  { opacity: 1; transform: scale(1.15); }
          100% { opacity: 1; transform: scale(1); }
        }

        @keyframes checkPop {
          0%   { stroke-dashoffset: 30; opacity: 0; }
          40%  { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }

        @keyframes ringPulse {
          0%   { transform: scale(0.9); opacity: 0.7; }
          100% { transform: scale(1.6); opacity: 0; }
        }

        @keyframes glowBreath {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 0.9; }
        }

        .login-input::placeholder { color: #4a4f63; }

        .login-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 24px rgba(79,142,247,0.35);
        }

        .login-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        @media (max-width: 900px) {
          .login-branding { display: none !important; }
          .login-form-panel { width: 100% !important; flex: 1 !important; }
        }
      `}</style>

      {transitionPhase === "handoff" && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(circle at center, rgba(31,43,78,0.94), rgba(5,7,13,0.99) 70%)",
            animation: "handoffBackdrop 0.3s ease forwards",
            pointerEvents: "all",
          }}
        >
          <div style={{ width: 340, padding: "36px 34px 30px", borderRadius: 22, textAlign: "center", color: "#fff", background: "rgba(17,21,35,0.96)", border: "1px solid rgba(111,145,255,0.38)", boxShadow: "0 32px 100px rgba(0,0,0,0.62), 0 0 80px rgba(79,142,247,0.25)", animation: "handoffPanel 0.55s cubic-bezier(0.2,0.8,0.2,1) forwards" }}>
            <div style={{ width: 68, height: 68, margin: "0 auto 18px", borderRadius: 19, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#4f8ef7,#7c5ce7)", boxShadow: "0 16px 40px rgba(79,142,247,0.42)", animation: "dashboardMark 0.65s ease forwards" }}>
              <svg width="31" height="31" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" />
              </svg>
            </div>
            <div style={{ fontFamily: "'Poppins',sans-serif", fontSize: 20, fontWeight: 600 }}>Opening your dashboard</div>
            <div style={{ marginTop: 8, color: "#a1abc5", fontSize: 13, lineHeight: 1.5 }}>Credentials verified successfully</div>
            <div style={{ height: 4, marginTop: 25, borderRadius: 999, background: "rgba(255,255,255,0.09)", overflow: "hidden" }}>
              <div style={{ width: "100%", height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#4ade80,#4f8ef7,#7c5ce7)", transformOrigin: "left", animation: "handoffBar 1.2s linear forwards" }} />
            </div>
          </div>
        </div>
      )}

      <div
        className="login-branding"
        style={{
          flex: "0 0 60%",
          position: "relative",
          background: "radial-gradient(ellipse at 20% 30%, #1a1f3a 0%, #14172a 40%, #0a0c18 100%)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-20%",
            right: "-15%",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(79,142,247,0.15) 0%, transparent 65%)",
            animation: "softGlow 10s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-25%",
            left: "-10%",
            width: 700,
            height: 700,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124,92,231,0.12) 0%, transparent 65%)",
            animation: "softGlow 14s ease-in-out infinite",
          }}
        />

        {FLOAT_SYMBOLS.map((s, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
              animation: `drift ${s.dur}s ease-in-out infinite, softPulse ${s.dur / 1.5}s ease-in-out infinite`,
              animationDelay: `${s.delay}s, ${s.delay}s`,
              opacity: 0.1,
            }}
          >
            {renderFloatSymbol(s.type)}
          </div>
        ))}

        <div
          style={{
            position: "relative",
            zIndex: 2,
            height: "100%",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "56px 72px",
          }}
        >
          {/* ===== LOGO — image is the badge, fills box, no double-frame ===== */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "transparent",
                    overflow: "visible",
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={appIcon}
                    alt="3rdEyeZ360"
                    draggable="false"
                    style={{
                      width: "68px",
                      height: "68px",
                      objectFit: "contain",
                      display: "block",
                      background: "transparent",
                      filter:
                        "drop-shadow(0 0 2px rgba(255,255,255,0.85)) drop-shadow(0 0 6px rgba(190,65,255,0.8)) drop-shadow(0 0 12px rgba(255,35,180,0.55))",
                      userSelect: "none",
                    }}
                  />
                </div>
          
                <span
                  style={{
                    color: "#e8eaf0",
                    fontSize: 22,
                    fontWeight: 600,
                    letterSpacing: 0.3,
                    fontFamily: "'Poppins', sans-serif",
                  }}
                >
                  3rdEyeZ360
                </span>
              </div>
          <div style={{ maxWidth: 620 }}>
            <h1
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: 56,
                lineHeight: 1.15,
                margin: 0,
                color: "#ffffff",
                fontWeight: 300,
                fontStyle: "italic",
                letterSpacing: -0.5,
              }}
            >
              A new standard of
              <br />
              <span
                style={{
                  fontWeight: 800,
                  fontStyle: "italic",
                  textTransform: "uppercase",
                  letterSpacing: -1,
                }}
              >
                Intelligent
              </span>{" "}
              proctoring
            </h1>

            <p
              style={{
                marginTop: 28,
                color: "#c8ccd8",
                fontSize: 16,
                lineHeight: 1.7,
                maxWidth: 460,
                fontWeight: 400,
              }}
            >
              We're 3rdEyeZ360 — an AI-powered proctoring platform built on
              trust. We bring clarity, fairness, and quiet confidence to every
              assessment you deliver.
            </p>

            <div
              style={{
                marginTop: 56,
                display: "flex",
                gap: 56,
                alignItems: "flex-end",
              }}
            >
              {VALUE_STRIP.map((item, i) => (
                <div key={i}>
                  <div
                    style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontSize: 48,
                      fontWeight: 300,
                      color: "#ffffff",
                      lineHeight: 1,
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      color: "#8b90a0",
                      fontSize: 13,
                      letterSpacing: 0.5,
                    }}
                  >
                    {item.caption}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: "#6b7085",
              fontSize: 12,
              letterSpacing: 0.3,
            }}
          >
            {/* <span>© {new Date().getFullYear()} 3rdEyeZ360 · All rights reserved</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#4ade80",
                  boxShadow: "0 0 6px #4ade80",
                }}
              />
              All systems operational
            </span> */}
          </div>
        </div>
      </div>

      <div
        className="login-form-panel"
        style={{
          flex: "0 0 40%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 40,
          background: "#0f1117",
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{ width: "100%", maxWidth: 380 }}
          autoComplete="on"
        >
          <LockAnimation
            hasEmail={hasEmail}
            hasPassword={hasPassword}
            lockState={lockState}
          />

          <div style={{ marginBottom: 28, marginTop: 20 }}>
            <h1
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: 26,
                fontWeight: 600,
                color: "#e8eaf0",
                margin: 0,
                letterSpacing: -0.3,
                textAlign: "center",
              }}
            >
              Welcome back
            </h1>
            <p
              style={{
                color: "#8b90a0",
                fontSize: 14,
                marginTop: 8,
                marginBottom: 0,
                textAlign: "center",
              }}
            >
              Sign in to continue to your workspace
            </p>
          </div>

          {error && (
            <div
              role="alert"
              style={{
                background: "rgba(247, 95, 95, 0.08)",
                border: "1px solid rgba(247, 95, 95, 0.35)",
                borderRadius: 10,
                padding: "11px 14px",
                color: "#ff8080",
                fontSize: 13,
                marginBottom: 18,
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                animation: "fadeIn 0.25s ease",
                lineHeight: 1.45,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ flexShrink: 0, marginTop: 1 }}
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>EMAIL ADDRESS</label>
              <div style={{ position: "relative" }}>
                <span style={inputIconStyle}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
                <input
                  className="login-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField("")}
                  type="email"
                  placeholder="Enter your email"
                  autoComplete="username"
                  disabled={loading}
                  style={{
                    ...inputBaseStyle,
                    ...(focusedField === "email" ? inputFocusStyle : {}),
                  }}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>PASSWORD</label>
              <div style={{ position: "relative" }}>
                <span style={inputIconStyle}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  className="login-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField("")}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                  style={{
                    ...inputBaseStyle,
                    paddingRight: 44,
                    ...(focusedField === "password" ? inputFocusStyle : {}),
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    color: "#6b7085",
                    cursor: "pointer",
                    padding: 6,
                    display: "flex",
                    alignItems: "center",
                  }}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="login-btn"
              style={{
                width: "100%",
                marginTop: 8,
                padding: "12px 0",
                fontSize: 15,
                fontWeight: 600,
                color: "#ffffff",
                background: loading
                  ? "#3a4159"
                  : "linear-gradient(135deg, #4f8ef7, #7c5ce7)",
                border: "none",
                borderRadius: 10,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
                boxShadow: loading ? "none" : "0 6px 16px rgba(79,142,247,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                fontFamily: "'Poppins', sans-serif",
                letterSpacing: 0.3,
              }}
            >
              {loading && (
                <span
                  style={{
                    width: 16,
                    height: 16,
                    border: "2px solid rgba(255,255,255,0.35)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
              )}
              {transitionPhase === "unlocking" ? "Access granted" : transitionPhase === "handoff" ? "Opening dashboard..." : loading ? "Signing in..." : "Sign In"}
            </button>
          </div>

          {/* <div 
            style={{
              marginTop: 28,
              paddingTop: 20,
              borderTop: "1px solid #1f2333",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              color: "#6b7085",
              fontSize: 12,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            {/* Protected by enterprise-grade encryption */}
          {/* </div> */} 
        </form>
      </div>
    </div>
  );
}
