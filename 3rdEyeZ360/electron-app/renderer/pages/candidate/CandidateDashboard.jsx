import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import useAuthStore from "../../store/authStore";
import useExamStore from "../../store/examStore";
import useSocket from "../../hooks/useSocket";

const API = "http://localhost:3000";
const THEME_STORAGE_KEY = "3rdeyez360.theme";

const THEMES = {
  dark: {
    name: "dark",
    canvas: "#07080d",
    canvasTint:
      "radial-gradient(ellipse at top left, #10152a 0%, #07080d 50%), radial-gradient(ellipse at bottom right, #1a0f2e 0%, #07080d 60%)",
    surface: "rgba(22, 26, 40, 0.6)",
    surfaceSolid: "#141826",
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
    overlay: "rgba(3,5,10,0.75)",
    glowAccent: "0 8px 32px rgba(91,140,255,0.28), 0 0 60px rgba(160,101,255,0.15)",
    glowSuccess: "0 6px 24px rgba(62,207,142,0.28)",
    glowWarning: "0 6px 24px rgba(232,176,75,0.28)",
    inputBg: "rgba(255,255,255,0.04)",
  },
  light: {
    name: "light",
    canvas: "#eef1fb",
    canvasTint:
      "radial-gradient(ellipse at top left, #dbe4ff 0%, #eef1fb 45%), radial-gradient(ellipse at bottom right, #ffd9ec 0%, #eef1fb 55%)",
    surface: "rgba(255, 255, 255, 0.78)",
    surfaceSolid: "#ffffff",
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
    overlay: "rgba(20, 28, 60, 0.35)",
    glowAccent: "0 12px 40px rgba(75,96,232,0.25), 0 0 60px rgba(124,58,237,0.15)",
    glowSuccess: "0 8px 28px rgba(14,165,100,0.28)",
    glowWarning: "0 8px 28px rgba(217,119,6,0.28)",
    inputBg: "#ffffff",
  },
};

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
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
function normalizeItem(raw) {
  if (!raw) return null;
  const assessmentStatusRaw =
    firstValue(
      raw.assessmentstatus,
      raw.assessment_status,
      raw.assessmentStatus,
      raw.status,
      raw.finalstatus,
      raw.final_status
    ) || "";
  const examStatusRaw =
    firstValue(
      raw.examstatus,
      raw.exam_status,
      raw.examStatus,
      raw.exam_status_text,
      raw.runtime_status,
      raw.runtimestatus,
      raw.status_exam,
      raw.examruntimestatus
    ) || "";
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
    status: toUpper(assessmentStatusRaw),
    assessmentstatus: toUpper(assessmentStatusRaw),
    examstatus: toUpper(examStatusRaw),
    finalstatus: toUpper(firstValue(raw.finalstatus, raw.final_status)),
    allowedwebsites: normalizeList(raw.allowedwebsites, raw.allowed_websites),
    allowedapplications: normalizeList(raw.allowedapplications, raw.allowed_applications),
  };
}
function hasCompleteExamDetails(item) {
  return Boolean(
    item &&
      item.name &&
      item.name !== "Upcoming Exam" &&
      item.date &&
      item.starttime &&
      item.endtime &&
      Number(item.durationminutes) > 0
  );
}
function mergeAssessmentUpdate(current, incoming) {
  if (!current) return incoming;
  if (!incoming) return current;
  const merged = { ...current, ...incoming };
  const preserve = [
    "name",
    "description",
    "date",
    "starttime",
    "endtime",
    "durationminutes",
    "examstatus",
  ];
  for (const key of preserve) {
    const value = incoming[key];
    const missing =
      value === undefined ||
      value === null ||
      value === "" ||
      (key === "name" && value === "Upcoming Exam") ||
      (key === "durationminutes" && Number(value) === 0);
    if (missing && current[key] !== undefined) merged[key] = current[key];
  }
  if (!incoming.allowedwebsites?.length && current.allowedwebsites?.length) {
    merged.allowedwebsites = current.allowedwebsites;
  }
  if (!incoming.allowedapplications?.length && current.allowedapplications?.length) {
    merged.allowedapplications = current.allowedapplications;
  }
  return merged;
}
function normalizeRequest(raw) {
  if (!raw) return null;
  return {
    ...raw,
    requestid: firstValue(raw.requestid, raw.request_id),
    assessmentid: firstValue(raw.assessmentid, raw.assessment_id),
    examid: firstValue(raw.examid, raw.exam_id),
    candidateid: firstValue(raw.candidateid, raw.candidate_id),
    type: toUpper(firstValue(raw.type, raw.requesttype, raw.request_type)),
    status: toUpper(raw.status),
    reason: firstValue(raw.reason, ""),
    reviewreason: firstValue(raw.reviewreason, raw.review_reason, ""),
    createdat: firstValue(raw.createdat, raw.created_at),
    reviewedat: firstValue(raw.reviewedat, raw.reviewed_at),
  };
}
function formatApiError(error, fallback = "Failed to submit permission request.") {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item?.loc && item?.msg) return `${item.loc.join(".")}: ${item.msg}`;
        if (item?.msg) return item.msg;
        return JSON.stringify(item);
      })
      .join(", ");
  }
  if (detail && typeof detail === "object") {
    if (detail.msg) return detail.msg;
    return JSON.stringify(detail);
  }
  return error?.message || fallback;
}
function isApprovedStatus(status) {
  const s = toUpper(status);
  return ["REENTRYAPPROVED", "REENTRY_APPROVED", "LATEENTRYAPPROVED", "LATEENTRY_APPROVED"].includes(s);
}
function isPendingRequestStatus(status) {
  const s = toUpper(status);
  return ["REENTRYREQUESTED", "REENTRY_REQUESTED", "LATEENTRYREQUESTED", "LATEENTRY_REQUESTED", "PENDING"].includes(s);
}
function isRejectedStatus(status) {
  const s = toUpper(status);
  return ["REENTRYREJECTED", "REENTRY_REJECTED", "LATEENTRYREJECTED", "LATEENTRY_REJECTED", "REJECTED"].includes(s);
}
function isExamRunningStatus(examStatus) {
  return toUpper(examStatus) === "RUNNING";
}
function getRequestType(exam) {
  const s = toUpper(exam?.status);
  if (s.includes("REENTRY")) return "REENTRY";
  return "LATEENTRY";
}
function getCardState(exam, pendingRequest) {
  const assessmentStatus = toUpper(exam?.status);
  const examStatus = toUpper(exam?.examstatus);
  const examRunning = isExamRunningStatus(examStatus);
  const hasEntered = Boolean(exam?.hasenteredexam);
  const reentryStatus = assessmentStatus.includes("REENTRY");
  const isReentryApproved = ["REENTRYAPPROVED", "REENTRY_APPROVED"].includes(assessmentStatus);
  const isLateEntryApproved = ["LATEENTRYAPPROVED", "LATEENTRY_APPROVED"].includes(assessmentStatus);
  const requiresReentry =
    hasEntered &&
    !isReentryApproved &&
    (
      exam?.requiresreentryapproval ||
      [
        "ACTIVE",
        "PAUSED",
        "INTERRUPTED",
        "REENTRY_REQUIRED",
        "REENTRYREQUESTED",
        "REENTRY_REQUESTED",
        "REENTRYREJECTED",
        "REENTRY_REJECTED",
      ].includes(assessmentStatus) ||
      isLateEntryApproved
    );

  if (assessmentStatus === "COMPLETED") {
    return { mode: "completed", cta: "Completed", disabled: true };
  }
  if (assessmentStatus === "TERMINATED") {
    return { mode: "terminated", cta: "Terminated", disabled: true };
  }
  if (assessmentStatus === "LOCKED") {
    return { mode: "locked", cta: "Locked", disabled: true };
  }

  if (pendingRequest || isPendingRequestStatus(assessmentStatus)) {
    return {
      mode: "pending-request",
      cta: reentryStatus || hasEntered ? "Re-entry Request Pending" : "Request Pending",
      disabled: true,
      helper: "Your request is pending examiner approval.",
    };
  }

  if (isRejectedStatus(assessmentStatus)) {
    const rejectedReentry = reentryStatus || hasEntered;
    return {
      mode: "request",
      cta: rejectedReentry ? "Request Re-entry Again" : "Request Permission Again",
      disabled: false,
      helper: rejectedReentry
        ? "Your previous re-entry request was declined. You may submit a new request with an updated reason."
        : "Your previous late-entry request was declined. You may submit a new request with an updated reason.",
    };
  }

  if (requiresReentry) {
    return {
      mode: "request",
      cta: "Request Re-entry",
      disabled: false,
      helper:
        "A previous secured session existed for this assessment. Examiner approval is required before a new session can be created.",
    };
  }

  if (isReentryApproved || isLateEntryApproved) {
    return {
      mode: "enter",
      cta: isReentryApproved ? "Re-enter Assessment" : "Enter Assessment Page",
      disabled: false,
      helper: isReentryApproved
        ? "Re-entry approved. This approval can be used once to create a new secured session."
        : "Permission granted. Continue to precheck and enter the assessment.",
    };
  }

  if (assessmentStatus === "ACTIVE") {
    return {
      mode: "enter",
      cta: "Enter Assessment",
      disabled: false,
      helper: "Your approved assessment session is available.",
    };
  }

  if (assessmentStatus === "PAUSED") {
    return {
      mode: "waiting",
      cta: "Assessment Paused",
      disabled: true,
      helper: "The examiner has paused this assessment.",
    };
  }

  if (["ASSIGNED", "AVAILABLE", "READY"].includes(assessmentStatus)) {
    if (examRunning) {
      return {
        mode: "request",
        cta: "Request Late Entry",
        disabled: false,
        helper: "The exam is already running. You must request late-entry permission before entry.",
      };
    }
    return {
      mode: "enter",
      cta: "Enter Assessment Waiting Window",
      disabled: false,
      helper: "You may enter early, complete precheck, read instructions, and wait in the waiting window.",
    };
  }

  return {
    mode: "waiting",
    cta: "Not Available",
    disabled: true,
    helper: "This assessment is not available right now.",
  };
}

function getStatusMeta(status, examStatus, pendingRequest, t, exam = null) {
  const s = toUpper(status);
  const e = toUpper(examStatus);
  const cardState = getCardState(
    exam || { status: s, examstatus: e },
    pendingRequest
  );

  if (s === "TERMINATED") {
    return {
      label: "Terminated",
      color: t.danger,
      gradient: t.dangerGradient,
      bucket: "terminated",
    };
  }

  if (pendingRequest || isPendingRequestStatus(s) || cardState.mode === "pending-request") {
    return {
      label: "Awaiting Review",
      color: t.warning,
      gradient: t.warningGradient,
      bucket: "awaiting-review",
    };
  }

  if (isApprovedStatus(s)) {
    return {
      label: "Approved",
      color: t.success,
      gradient: t.successGradient,
      bucket: "approved",
    };
  }

  if (cardState.mode === "request") {
    return {
      label: "Re-entry Required",
      color: t.info,
      gradient: `linear-gradient(135deg, ${t.info}, ${t.accent2})`,
      bucket: "reentry-required",
    };
  }

  if (["ASSIGNED", "AVAILABLE", "READY", "ACTIVE"].includes(s)) {
    return {
      label: "Ready",
      color: t.accent,
      gradient: t.accentGradient,
      bucket: "ready",
    };
  }

  if (s === "COMPLETED") {
    return {
      label: "Completed",
      color: t.success,
      gradient: t.successGradient,
      bucket: "other",
    };
  }

  if (s === "LOCKED") {
    return {
      label: "Locked",
      color: t.danger,
      gradient: t.dangerGradient,
      bucket: "other",
    };
  }

  if (isRejectedStatus(s)) {
    return {
      label: "Declined",
      color: t.danger,
      gradient: t.dangerGradient,
      bucket: "reentry-required",
    };
  }

  if (s === "PAUSED") {
    return {
      label: "Paused",
      color: t.warning,
      gradient: t.warningGradient,
      bucket: "other",
    };
  }

  return {
    label: status || "Unknown",
    color: t.textMuted,
    gradient: `linear-gradient(135deg, ${t.textMuted}, ${t.textFaint})`,
    bucket: "other",
  };
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
          flexDirection: "column",
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
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, zIndex: 1 }}>
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
      title="Refresh assessments"
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
          animation: active ? "spinFluid 0.9s cubic-bezier(0.4, 0, 0.2, 1) infinite" : "none",
          transition: "transform 0.4s ease",
        }}
      >
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
    </button>
  );
}

function LogoutButton({ onLogout, theme }) {
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState(false);
  const t = THEMES[theme];

  const cleanupAssessmentSession = async () => {
    const electronAPI = window.electronAPI;

    if (!electronAPI) {
      return;
    }

    const cleanupOperations = [
      {
        name: "stopCapture",
        execute: () => electronAPI.stopCapture?.(),
      },
      {
        name: "closeBrowser",
        execute: () => electronAPI.closeBrowser?.(),
      },
      {
        name: "disableLockdown",
        execute: () => electronAPI.disableLockdown?.(),
      },
      {
        name: "setClosable",
        execute: () => electronAPI.setClosable?.(true),
      },
    ];

    for (const operation of cleanupOperations) {
      try {
        const result = await operation.execute();

        if (result && result.success === false) {
          console.warn(
            `${operation.name} returned an unsuccessful result:`,
            result.error
          );
        }
      } catch (error) {
        console.warn(`${operation.name} cleanup failed:`, error);
      }
    }
  };

const clearLocalSession = () => {
  try {
    /*
     * Reset the in-memory stores before navigating to the login page.
     * Removing localStorage alone does not clear the currently loaded
     * Zustand state.
     */
    useExamStore.getState().reset?.();
    useAuthStore.getState().clearAuth?.();

    localStorage.removeItem("app-screen");
    localStorage.removeItem("auth-storage");
    localStorage.removeItem("exam-storage");

    sessionStorage.removeItem("app-screen");
    sessionStorage.removeItem("auth-storage");
    sessionStorage.removeItem("exam-storage");
  } catch (error) {
    console.warn("Local session cleanup failed:", error);
  }
};

  const handleLogout = async () => {
    if (loading) {
      return;
    }

    setLoading(true);

    const { refreshToken } = useAuthStore.getState();

    try {
      /*
       * This must happen before changing the React screen.
       * BrowserView is an Electron-native layer and survives React navigation
       * unless it is explicitly destroyed.
       */
      await cleanupAssessmentSession();

      if (refreshToken) {
        try {
          await axios.post(`${API}/api/auth/logout`, {
            refreshtoken: refreshToken,
          });
        } catch (error) {
          console.warn(
            "Logout API failed. The local session will still be cleared.",
            error
          );
        }
      }
    } finally {
      /*
       * Clear the local session even when the backend logout request or an
       * Electron cleanup operation fails.
       */
      clearLocalSession();

      try {
        if (typeof onLogout === "function") {
          await onLogout();
        }
      } catch (error) {
        console.error("Parent logout navigation failed:", error);
      }

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
        opacity: loading ? 0.65 : 1,
      }}
    >
      {loading ? (
        <span
          style={{
            width: 15,
            height: 15,
            border: "2px solid currentColor",
            borderTopColor: "transparent",
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

function SearchAndFilter({ theme, query, onQuery, filter, onFilter, counts }) {
  const t = THEMES[theme];
  const [focused, setFocused] = useState(false);

  const chips = [
    { key: "all", label: "All", count: counts.all, color: t.accent },
    { key: "ready", label: "Ready", count: counts.ready, color: t.accent },
    { key: "approved", label: "Approved", count: counts.approved, color: t.success },
    {
      key: "awaiting-review",
      label: "Awaiting Review",
      count: counts["awaiting-review"],
      color: t.warning,
    },
    {
      key: "reentry-required",
      label: "Re-entry Required",
      count: counts["reentry-required"],
      color: t.info,
    },
    {
      key: "terminated",
      label: "Terminated",
      count: counts.terminated,
      color: t.danger,
    },
  ];

  return (
    <div
      style={{
        background: t.cardSurface,
        border: `1px solid ${t.border}`,
        borderRadius: 18,
        padding: 14,
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        boxShadow: t.name === "light" ? "0 4px 18px rgba(20,28,60,0.06)" : "none",
        transition: "background 0.55s ease, border-color 0.5s ease",
      }}
    >
      <div
        style={{
          position: "relative",
          flex: "1 1 260px",
          minWidth: 240,
          display: "flex",
          alignItems: "center",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={focused ? t.accent : t.textMuted}
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
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search by name, description, or date"
          style={{
            width: "100%",
            padding: "11px 14px 11px 40px",
            fontSize: 13.5,
            color: t.textPrimary,
            background: t.inputBg,
            border: `1px solid ${focused ? t.accent : t.border}`,
            borderRadius: 12,
            outline: "none",
            fontFamily: "'Inter', sans-serif",
            boxSizing: "border-box",
            boxShadow: focused ? `0 0 0 3px ${t.accentSoft}` : "none",
            transition: "border-color 0.2s ease, box-shadow 0.2s ease, background 0.5s ease",
          }}
        />
        {query && (
          <button
            onClick={() => onQuery("")}
            aria-label="Clear search"
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "transparent",
              border: "none",
              color: t.textMuted,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color 0.2s ease, background 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = t.surfaceGlass;
              e.currentTarget.style.color = t.textPrimary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = t.textMuted;
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {chips.map((c) => {
          const active = filter === c.key;
          return (
            <button
              key={c.key}
              onClick={() => onFilter(c.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 12px",
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
                if (!active) e.currentTarget.style.background = t.surfaceGlassHover;
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = t.surfaceGlass;
              }}
            >
              {c.label}
              <span
                style={{
                  fontSize: 10.5,
                  padding: "1px 7px",
                  borderRadius: 999,
                  background: active ? "rgba(255,255,255,0.28)" : t.surfaceGlassHover,
                  color: active ? "#ffffff" : t.textMuted,
                  fontWeight: 700,
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
  );
}

function AssessmentCard({ exam, pendingRequest, theme, onEnter, onRequest, index }) {
  const t = THEMES[theme];
  const [hover, setHover] = useState(false);
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });
  const cardRef = useRef(null);
  const meta = getStatusMeta(exam.status, exam.examstatus, pendingRequest, t, exam);
  const cardState = getCardState(exam, pendingRequest);
  const enterable = cardState.mode === "enter";
  const runningNow = isExamRunningStatus(exam.examstatus);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMouse({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
  };

  const renderCta = () => {
    const base = {
      width: "100%",
      padding: "13px 0",
      fontSize: 13.5,
      fontWeight: 700,
      borderRadius: 12,
      fontFamily: "'Inter', sans-serif",
      letterSpacing: 0.3,
      cursor: "pointer",
      border: "none",
      transition: "all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      position: "relative",
      overflow: "hidden",
    };
    if (cardState.mode === "enter") {
      return (
        <button
          onClick={() => onEnter?.(exam)}
          style={{ ...base, background: t.accentGradient, color: "#ffffff", boxShadow: t.glowAccent }}
          className="cta-shine"
        >
          <span style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", gap: 10 }}>
            {cardState.cta}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </span>
        </button>
      );
    }
    if (cardState.mode === "request") {
  return (
    <button
      onClick={() => onRequest?.(exam)}
      style={{ ...base, background: t.warningGradient, color: "#ffffff", boxShadow: t.glowWarning }}
      className="cta-shine"
    >
      <span style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", gap: 10 }}>
        {cardState.cta}
      </span>
    </button>
  );
}
    return (
      <button
        disabled
        style={{
          ...base,
          background: t.surfaceGlass,
          color: t.textMuted,
          cursor: "not-allowed",
          border: `1px solid ${t.border}`,
        }}
      >
        {cardState.cta}
      </button>
    );
  };

  return (
    <div
      ref={cardRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setMouse({ x: 0.5, y: 0.5 });
      }}
      onMouseMove={handleMouseMove}
      style={{
        background: hover ? t.cardSurfaceHover : t.cardSurface,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: `1px solid ${enterable ? t.borderAccent : hover ? t.borderStrong : t.border}`,
        borderRadius: 22,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        boxShadow: hover
          ? `0 24px 48px ${t.name === "light" ? "rgba(20,28,60,0.15)" : "rgba(0,0,0,0.28)"}, 0 0 0 1px ${meta.color}22 inset`
          : t.name === "light"
          ? "0 6px 20px rgba(20,28,60,0.08)"
          : "0 4px 20px rgba(0,0,0,0.12)",
        transition:
          "background 0.5s ease, border-color 0.3s ease, box-shadow 0.4s ease, transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)",
        transform: hover ? "translateY(-6px)" : "translateY(0)",
        position: "relative",
        overflow: "hidden",
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
          left: 0,
          right: 0,
          height: 3,
          background: meta.gradient,
          opacity: hover || enterable ? 1 : 0.6,
          transition: "opacity 0.35s ease",
        }}
      />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, position: "relative", zIndex: 1 }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: t.textMuted, fontWeight: 500 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {exam.date || "—"}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: t.textMuted, fontWeight: 500 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {exam.starttime} — {exam.endtime}
            </span>
          </div>
        </div>

        <div
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.4,
            color: "#ffffff",
            background: meta.gradient,
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: 6,
            boxShadow: `0 4px 12px ${meta.color}44`,
          }}
        >
          {runningNow && (
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
        </div>
      </div>

      <div
        style={{
          fontSize: 13,
          color: exam.description ? t.textSecondary : t.textFaint,
          lineHeight: 1.6,
          minHeight: 40,
          position: "relative",
          zIndex: 1,
        }}
      >
        {exam.description || "No additional description provided for this assessment."}
      </div>

      <div style={{ display: "flex", gap: 8, position: "relative", zIndex: 1 }}>
        <div style={{ flex: 1, background: t.surfaceGlass, border: `1px solid ${t.border}`, borderRadius: 12, padding: "10px 12px" }}>
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
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
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
            <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 500 }}>min</span>
          </div>
        </div>
        <div style={{ flex: 1, background: t.surfaceGlass, border: `1px solid ${t.border}`, borderRadius: 12, padding: "10px 12px" }}>
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
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            Allowed
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
            {exam.allowedwebsites.length}
            <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 500 }}>sites</span>
          </div>
        </div>
        {/* <div style={{ flex: 1, background: t.surfaceGlass, border: `1px solid ${t.border}`, borderRadius: 12, padding: "10px 12px" }}>
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
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Session
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: runningNow ? t.success : t.textPrimary,
              fontFamily: "'Space Grotesk', sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            {runningNow && (
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
            {exam.examstatus || "—"}
          </div>
        </div> */}
      </div>

      {cardState.helper ? (
        <div
          style={{
            background: enterable ? t.accentSoft : t.surfaceGlass,
            border: `1px solid ${enterable ? t.borderAccent : t.border}`,
            borderRadius: 12,
            padding: "10px 12px",
            fontSize: 12,
            color: enterable ? t.accent : t.textSecondary,
            lineHeight: 1.55,
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            position: "relative",
            zIndex: 1,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>{cardState.helper}</span>
        </div>
      ) : null}

      <div style={{ position: "relative", zIndex: 1 }}>{renderCta()}</div>
    </div>
  );
}

function RequestModal({ open, exam, reason, onChangeReason, onClose, onSubmit, submitting, submitError, theme }) {
  const t = THEMES[theme];
  if (!open || !exam) return null;
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
        zIndex: 9999,
        padding: 20,
        animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: t.surfaceElevated,
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: `1px solid ${t.borderStrong}`,
          borderRadius: 20,
          overflow: "hidden",
          animation: "slideUp 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ padding: "22px 26px", borderBottom: `1px solid ${t.border}`, position: "relative", overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              top: -40,
              right: -40,
              width: 160,
              height: 160,
              borderRadius: "50%",
              background: t.accentGradientSoft,
              filter: "blur(40px)",
            }}
          />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div
              style={{
                fontSize: 19,
                fontWeight: 700,
                color: t.textPrimary,
                marginBottom: 6,
                fontFamily: "'Space Grotesk', sans-serif",
                letterSpacing: -0.3,
              }}
            >
              Request Permission
            </div>
            <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6 }}>
              The exam has already started for <span style={{ color: t.textSecondary, fontWeight: 600 }}>{exam.name}</span>. Enter your reason to request permission from the examiner.
            </div>
          </div>
        </div>
        <div style={{ padding: 26 }}>
          <label
            style={{
              display: "block",
              fontSize: 11,
              color: t.textMuted,
              marginBottom: 8,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            Reason
          </label>
          <textarea
            value={reason}
            onChange={(e) => onChangeReason(e.target.value)}
            placeholder="Example: I joined late due to a network issue."
            rows={5}
            style={{
              width: "100%",
              boxSizing: "border-box",
              resize: "vertical",
              minHeight: 120,
              background: t.inputBg,
              border: `1px solid ${t.border}`,
              borderRadius: 12,
              color: t.textPrimary,
              padding: 14,
              fontSize: 14,
              outline: "none",
              fontFamily: "'Inter', sans-serif",
              lineHeight: 1.5,
              transition: "border-color 0.2s ease, box-shadow 0.2s ease",
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
          {submitError ? (
            <div
              style={{
                marginTop: 12,
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
              <span>{submitError}</span>
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "18px 26px", borderTop: `1px solid ${t.border}` }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 600,
              background: "transparent",
              color: t.textSecondary,
              border: `1px solid ${t.borderStrong}`,
              borderRadius: 10,
              cursor: submitting ? "not-allowed" : "pointer",
              fontFamily: "'Inter', sans-serif",
              transition: "all 0.2s ease",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting || !reason.trim()}
            style={{
              padding: "10px 22px",
              fontSize: 13,
              fontWeight: 700,
              background: submitting || !reason.trim() ? t.borderStrong : t.accentGradient,
              color: "#ffffff",
              border: "none",
              borderRadius: 10,
              cursor: submitting || !reason.trim() ? "not-allowed" : "pointer",
              fontFamily: "'Inter', sans-serif",
              boxShadow: submitting || !reason.trim() ? "none" : t.glowAccent,
              transition: "all 0.25s ease",
              display: "flex",
              alignItems: "center",
              gap: 8,
              letterSpacing: 0.3,
            }}
          >
            {submitting ? (
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
                Submitting...
              </>
            ) : (
              "Submit Request"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CandidateDashboard({ onEnterExam, onLogout }) {
  const { user, accessToken } = useAuthStore();
  const socket = useSocket(accessToken);
  useEffect(() => {
  let cancelled = false;

  const cleanupOrphanedAssessmentSession = async () => {
    const electronAPI = window.electronAPI;

    if (!electronAPI || cancelled) {
      return;
    }

    const cleanupOperations = [
      {
        name: "stopCapture",
        execute: () => electronAPI.stopCapture?.(),
      },
      {
        name: "closeBrowser",
        execute: () => electronAPI.closeBrowser?.(),
      },
      {
        name: "disableLockdown",
        execute: () => electronAPI.disableLockdown?.(),
      },
      {
        name: "setClosable",
        execute: () => electronAPI.setClosable?.(true),
      },
    ];

    for (const operation of cleanupOperations) {
      if (cancelled) {
        return;
      }

      try {
        const result = await operation.execute();

        if (result && result.success === false) {
          console.warn(
            `${operation.name} dashboard cleanup was unsuccessful:`,
            result.error
          );
        }
      } catch (error) {
        console.warn(
          `${operation.name} dashboard safety cleanup failed:`,
          error
        );
      }
    }
  };

  cleanupOrphanedAssessmentSession();

  return () => {
    cancelled = true;
  };
}, []);

  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark") return stored;
    } catch (e) {}
    return "dark";
  });
  const t = THEMES[theme];
  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch (e) {}
      return next;
    });
  }, []);

  const [assessments, setAssessments] = useState([]);
  const [pendingRequestsByAssessment, setPendingRequestsByAssessment] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedExamForRequest, setSelectedExamForRequest] = useState(null);
  const [requestReason, setRequestReason] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [submitRequestError, setSubmitRequestError] = useState("");
  const [clock, setClock] = useState(new Date());

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const firstLoadResolvedRef = useRef(false);
  const lastUpdatedRef = useRef(null);
  const headers = useMemo(() => ({ Authorization: `Bearer ${accessToken}` }), [accessToken]);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const reconcileAssessment = useCallback(
    async (item) => {
      if (!item?.assessmentid) return item;

      try {
        const response = await axios.get(
          `${API}/api/assessments/${item.assessmentid}`,
          { headers }
        );
        const latest = normalizeItem(response.data);
        return latest ? { ...item, ...latest } : item;
      } catch (reconcileError) {
        console.warn(
          `Could not reconcile assessment ${item.assessmentid}:`,
          reconcileError
        );
        return item;
      }
    },
    [headers]
  );

  const fetchAssessments = useCallback(
    async (silent = false) => {
      if (!accessToken) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError("");
      try {
        const res = await axios.get(`${API}/api/exams/candidate/upcoming`, { headers });
        const baseRows = Array.isArray(res.data)
          ? res.data
              .map(normalizeItem)
              .filter(Boolean)
              .filter((item) => item.assessmentid || item.examid)
          : [];

        const rows = await Promise.all(
          baseRows.map((item) => reconcileAssessment(item))
        );

        setAssessments(rows);
        setPendingRequestsByAssessment((prev) => {
          const next = {};
          for (const item of rows) {
            const assessmentId = item.assessmentid;
            if (!assessmentId) continue;
            const assessmentStatus = toUpper(item.status);
            const existing = prev[assessmentId];
            if (isApprovedStatus(assessmentStatus) || isRejectedStatus(assessmentStatus)) continue;
            if (isPendingRequestStatus(assessmentStatus)) {
              next[assessmentId] =
                normalizeRequest({
                  requestid: `derived-${assessmentId}`,
                  assessmentid: assessmentId,
                  examid: item.examid,
                  candidateid: item.candidateid ?? user?.userid ?? user?.user_id ?? null,
                  type: getRequestType(item),
                  status: "PENDING",
                  reason: "",
                }) || existing;
              continue;
            }
            if (
              existing &&
              isPendingRequestStatus(existing.status) &&
              !["ACTIVE", "PAUSED", "COMPLETED", "TERMINATED"].includes(assessmentStatus)
            ) {
              next[assessmentId] = existing;
            }
          }
          return next;
        });
        lastUpdatedRef.current = new Date();
      } catch (e) {
        console.error("load candidate assessments", e);
        if (!silent) setError(formatApiError(e, "Failed to load your assessments."));
      } finally {
        firstLoadResolvedRef.current = true;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken, headers, user, reconcileAssessment]
  );

  useEffect(() => {
    fetchAssessments(false);
  }, [fetchAssessments]);
  useEffect(() => {
    if (!socket) return;

    const matchesCandidate = (payload) => {
      const payloadCandidateId = firstValue(payload?.candidateid, payload?.candidate_id);
      const currentCandidateId = firstValue(user?.userid, user?.user_id);
      return !payloadCandidateId || String(payloadCandidateId) === String(currentCandidateId);
    };

    const upsertAssessment = async (payload) => {
      if (!matchesCandidate(payload)) return;
      const incoming = normalizeItem(payload?.assessment || payload);
      if (!incoming?.assessmentid) return;

      // Reconcile legacy/partial events before inserting a new card.
      const next = hasCompleteExamDetails(incoming)
        ? incoming
        : await reconcileAssessment(incoming);

      setAssessments((previous) => {
        const index = previous.findIndex(
          (item) => item.assessmentid === next.assessmentid
        );
        if (index < 0) return [next, ...previous];
        return previous.map((item, itemIndex) =>
          itemIndex === index ? mergeAssessmentUpdate(item, next) : item
        );
      });
      if (!isPendingRequestStatus(next.status)) {
        setPendingRequestsByAssessment((previous) => {
          const copy = { ...previous };
          delete copy[next.assessmentid];
          return copy;
        });
      }
      lastUpdatedRef.current = new Date();
    };

    const upsertExam = (payload) => {
      const next = normalizeItem(payload?.exam || payload);
      if (!next?.examid) return;
      setAssessments((previous) =>
        previous.map((item) =>
          item.examid === next.examid
            ? { ...item, ...next, status: item.status, assessmentstatus: item.assessmentstatus }
            : item
        )
      );
      lastUpdatedRef.current = new Date();
    };

    const onAssignmentRemoved = (payload) => {
      if (!matchesCandidate(payload)) return;
      const assessmentId = firstValue(payload?.assessmentid, payload?.assessment_id);
      setAssessments((previous) =>
        previous.filter((item) => item.assessmentid !== assessmentId)
      );
    };

    const onRequestCreated = (payload) => {
      if (!matchesCandidate(payload)) return;
      const request = normalizeRequest(payload?.request || payload);
      if (!request?.assessmentid) return;
      setPendingRequestsByAssessment((previous) => ({
        ...previous,
        [request.assessmentid]: request,
      }));
    };

    const onRequestReviewed = (payload) => {
      if (!matchesCandidate(payload)) return;
      const assessmentId = firstValue(payload?.assessmentid, payload?.assessment_id);
      if (assessmentId) {
        setPendingRequestsByAssessment((previous) => {
          const copy = { ...previous };
          delete copy[assessmentId];
          return copy;
        });
      }
      if (payload?.assessment) upsertAssessment(payload.assessment);
    };

    socket.on("assessment_created", upsertAssessment);
    socket.on("assessment_updated", upsertAssessment);
    socket.on("assessment_removed", onAssignmentRemoved);
    socket.on("exam_created", upsertExam);
    socket.on("exam_updated", upsertExam);
    socket.on("request_created", onRequestCreated);
    socket.on("request_reviewed", onRequestReviewed);
    socket.on("connect", fetchAssessments);

    return () => {
      socket.off("assessment_created", upsertAssessment);
      socket.off("assessment_updated", upsertAssessment);
      socket.off("assessment_removed", onAssignmentRemoved);
      socket.off("exam_created", upsertExam);
      socket.off("exam_updated", upsertExam);
      socket.off("request_created", onRequestCreated);
      socket.off("request_reviewed", onRequestReviewed);
      socket.off("connect", fetchAssessments);
    };
  }, [socket, user, fetchAssessments, reconcileAssessment]);

  const allottedCount = assessments.length;
  const completedCount = assessments.filter((a) => toUpper(a.status) === "COMPLETED").length;
  const activeCount = assessments.filter((a) => {
    const pending = pendingRequestsByAssessment[a.assessmentid];
    return getCardState(a, pending).mode === "enter";
  }).length;
  const pendingCount = assessments.filter((a) => {
    const pending = pendingRequestsByAssessment[a.assessmentid];
    return !!pending || isPendingRequestStatus(a.status);
  }).length;

  const bucketCounts = useMemo(() => {
    const counts = {
      all: assessments.length,
      ready: 0,
      approved: 0,
      "awaiting-review": 0,
      "reentry-required": 0,
      terminated: 0,
    };

    for (const assessment of assessments) {
      const pending =
        pendingRequestsByAssessment[assessment.assessmentid] ?? null;
      const meta = getStatusMeta(
        assessment.status,
        assessment.examstatus,
        pending,
        t,
        assessment
      );

      if (Object.prototype.hasOwnProperty.call(counts, meta.bucket)) {
        counts[meta.bucket] += 1;
      }
    }

    return counts;
  }, [assessments, pendingRequestsByAssessment, t]);

  const filteredAssessments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return assessments.filter((assessment) => {
      const pending =
        pendingRequestsByAssessment[assessment.assessmentid] ?? null;
      const meta = getStatusMeta(
        assessment.status,
        assessment.examstatus,
        pending,
        t,
        assessment
      );

      if (filter !== "all" && meta.bucket !== filter) {
        return false;
      }

      if (!q) return true;

      const haystack = [
        assessment.name,
        assessment.description,
        assessment.assessmentid,
        assessment.examid,
        assessment.date,
        assessment.starttime,
        assessment.endtime,
        assessment.status,
        assessment.examstatus,
        meta.label,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase())
        .join(" ");

      return haystack.includes(q);
    });
  }, [
    assessments,
    searchQuery,
    filter,
    pendingRequestsByAssessment,
    t,
  ]);

  const openRequestModal = (exam) => {
    setSelectedExamForRequest(exam);
    setRequestReason("");
    setSubmitRequestError("");
    setRequestModalOpen(true);
  };
  const resetRequestModalState = () => {
    setRequestModalOpen(false);
    setSelectedExamForRequest(null);
    setRequestReason("");
    setSubmitRequestError("");
  };
  const closeRequestModal = () => {
    if (submittingRequest) return;
    resetRequestModalState();
  };

  const submitPermissionRequest = async () => {
    if (!selectedExamForRequest) return;
    const reason = requestReason.trim();
    if (!reason) {
      setSubmitRequestError("Reason is required.");
      return;
    }
    setSubmittingRequest(true);
    setSubmitRequestError("");
    const requestType = getRequestType(selectedExamForRequest);
    const requestedStatus = requestType === "REENTRY" ? "REENTRYREQUESTED" : "LATEENTRYREQUESTED";
    try {
      const payload = {
        assessmentid: selectedExamForRequest.assessmentid,
        examid: selectedExamForRequest.examid,
        type: requestType,
        reason,
      };
      const res = await axios.post(`${API}/api/requests`, payload, {
        headers,
        timeout: 15000,
        validateStatus: (status) => status >= 200 && status < 500,
      });
      if (res.status >= 200 && res.status < 300) {
        const createdRequest = normalizeRequest(res.data);
        setPendingRequestsByAssessment((prev) => ({
          ...prev,
          [selectedExamForRequest.assessmentid]:
            createdRequest ??
            normalizeRequest({
              requestid: `created-${selectedExamForRequest.assessmentid}`,
              assessmentid: selectedExamForRequest.assessmentid,
              examid: selectedExamForRequest.examid,
              candidateid: selectedExamForRequest.candidateid ?? user?.userid ?? user?.user_id ?? null,
              type: requestType,
              status: "PENDING",
              reason,
            }),
        }));
        setAssessments((prev) =>
          prev.map((item) =>
            item.assessmentid === selectedExamForRequest.assessmentid
              ? { ...item, status: requestedStatus, assessmentstatus: requestedStatus }
              : item
          )
        );
        resetRequestModalState();
        return;
      }
      const detail = res?.data?.detail;
      const serverMessage = typeof detail === "string" && detail.trim() ? detail : "Failed to submit permission request.";
      if (
        res.status === 409 ||
        serverMessage.toLowerCase().includes("already requested") ||
        serverMessage.toLowerCase().includes("pending request already exists")
      ) {
        setPendingRequestsByAssessment((prev) => ({
          ...prev,
          [selectedExamForRequest.assessmentid]: normalizeRequest({
            requestid: `existing-${selectedExamForRequest.assessmentid}`,
            assessmentid: selectedExamForRequest.assessmentid,
            examid: selectedExamForRequest.examid,
            candidateid: selectedExamForRequest.candidateid ?? user?.userid ?? user?.user_id ?? null,
            type: requestType,
            status: "PENDING",
            reason,
          }),
        }));
        setAssessments((prev) =>
          prev.map((item) =>
            item.assessmentid === selectedExamForRequest.assessmentid
              ? { ...item, status: requestedStatus, assessmentstatus: requestedStatus }
              : item
          )
        );
        resetRequestModalState();
        return;
      }
      setSubmitRequestError(serverMessage);
    } catch (e) {
      const apiMessage = formatApiError(e, "Failed to submit permission request.");
      if (
        apiMessage.toLowerCase().includes("already requested") ||
        apiMessage.toLowerCase().includes("pending request already exists")
      ) {
        setPendingRequestsByAssessment((prev) => ({
          ...prev,
          [selectedExamForRequest.assessmentid]: normalizeRequest({
            requestid: `existing-${selectedExamForRequest.assessmentid}`,
            assessmentid: selectedExamForRequest.assessmentid,
            examid: selectedExamForRequest.examid,
            candidateid: selectedExamForRequest.candidateid ?? user?.userid ?? user?.user_id ?? null,
            type: requestType,
            status: "PENDING",
            reason,
          }),
        }));
        setAssessments((prev) =>
          prev.map((item) =>
            item.assessmentid === selectedExamForRequest.assessmentid
              ? { ...item, status: requestedStatus, assessmentstatus: requestedStatus }
              : item
          )
        );
        resetRequestModalState();
        return;
      }
      setSubmitRequestError(apiMessage);
    } finally {
      setSubmittingRequest(false);
    }
  };

  if (loading && !firstLoadResolvedRef.current) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: t.canvas,
          color: t.textMuted,
          fontSize: 14,
          fontFamily: "'Inter', sans-serif",
          transition: "background 0.6s ease",
        }}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
          @keyframes spinFluid { to { transform: rotate(360deg); } }
        `}</style>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ position: "relative", width: 44, height: 44 }}>
            <span
              style={{
                position: "absolute",
                inset: 0,
                border: `3px solid ${t.border}`,
                borderTopColor: t.accent,
                borderRightColor: t.accent2,
                borderRadius: "50%",
                animation: "spinFluid 1s linear infinite",
              }}
            />
          </div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5 }}>Preparing your workspace</div>
        </div>
      </div>
    );
  }

  const hour = clock.getHours();
  const greeting =
    hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : hour < 21 ? "Good evening" : "Good night";
  const timeText = clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateText = clock.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

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
          background: ${t.accentGradient};
          background-size: 200% 200%;
          animation: gradientShift 6s ease infinite;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          display: inline-block;
        }
        .clock-gradient {
          background: ${t.accentGradient};
          background-size: 200% 200%;
          animation: gradientShift 6s ease infinite;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          display: inline-block;
          line-height: 1;
        }
        .brand-gradient {
          background: ${t.accentGradient};
          background-size: 200% 200%;
          animation: gradientShift 8s ease infinite;
        }
        .avatar-gradient {
          background: ${t.accentGradient};
          background-size: 200% 200%;
          animation: gradientShift 6s ease infinite;
        }

        button, a, input, textarea { transition: background-color 0.25s ease, border-color 0.25s ease, color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease, opacity 0.25s ease; }
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
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
         
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
            <span
              style={{
                fontWeight: 700,
                fontSize: 16,
                color: t.textPrimary,
                fontFamily: "'Space Grotesk', sans-serif",
                letterSpacing: -0.3,
              }}
            >
              
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
              Candidate Workspace
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
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                }}
              >
                {String(user.name).charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 13, color: t.textPrimary, fontWeight: 600, letterSpacing: 0.1 }}>{user.name}</span>
            </div>
          )}

          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <IconMorphButton theme={theme} refreshing={refreshing} loading={loading} onClick={() => fetchAssessments(false)} />
          <LogoutButton onLogout={onLogout} theme={theme} />
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "32px 32px 40px", position: "relative", zIndex: 1 }}>
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
                boxShadow: t.name === "light" ? "0 8px 30px rgba(20,28,60,0.08)" : "none",
                transition: "background 0.55s ease, border-color 0.5s ease, box-shadow 0.5s ease",
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
                  <span style={{ display: "inline-block", width: 24, height: 1, background: t.accentGradient }} />
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
                  {user?.name ? <span className="gradient-text">, {user.name.split(" ")[0]}</span> : null}
                </h1>
                <p style={{ fontSize: 14.5, color: t.textSecondary, margin: 0, lineHeight: 1.65, maxWidth: 560 }}>
                  Enter your assessment early to complete the precheck and settle in. If the exam is already running, request permission from your examiner.
                </p>
                <div style={{ display: "flex", gap: 12, marginTop: 22, flexWrap: "wrap" }}>
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
                    <span style={{ fontSize: 12, color: t.textSecondary, fontWeight: 600 }}>Auto-sync active</span>
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
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2.2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span style={{ fontSize: 12, color: t.textSecondary, fontWeight: 600 }}>End-to-end encrypted</span>
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
                boxShadow: t.name === "light" ? "0 8px 30px rgba(20,28,60,0.08)" : "none",
                transition: "background 0.55s ease, border-color 0.5s ease, box-shadow 0.5s ease",
              }}
            >
              <div style={{ position: "absolute", inset: 0, background: t.accentGradientSoft, opacity: 0.7 }} />
              <div style={{ position: "relative", zIndex: 1 }}>
                <div
                  style={{
                    fontSize: 10.5,
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
                <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 8, fontWeight: 500, letterSpacing: 0.3 }}>
                  {clock.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
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
              label="Total Allotted"
              value={allottedCount}
              total={Math.max(allottedCount, 1)}
              color={t.accent}
              gradient={t.accentGradient}
              icon={
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <path d="M9 10h6M9 14h4" />
                </svg>
              }
            />
            <StatOrb
              theme={theme}
              label="Ready to Enter"
              value={activeCount}
              total={Math.max(allottedCount, 1)}
              color={t.success}
              gradient={t.successGradient}
              icon={
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              }
            />
            <StatOrb
              theme={theme}
              label="In Review"
              value={pendingCount}
              total={Math.max(allottedCount, 1)}
              color={t.warning}
              gradient={t.warningGradient}
              icon={
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              }
            />
            <StatOrb
              theme={theme}
              label="Completed"
              value={completedCount}
              total={Math.max(allottedCount, 1)}
              color={t.textSecondary}
              gradient={`linear-gradient(135deg, ${t.textSecondary}, ${t.textMuted})`}
              icon={
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
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
                Your Assessments
                <span
                  style={{
                    fontSize: 12,
                    color: t.textMuted,
                    fontWeight: 600,
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: t.surfaceGlass,
                    border: `1px solid ${t.border}`,
                    fontFamily: "'Inter', sans-serif",
                    letterSpacing: 0.2,
                  }}
                >
                  {filteredAssessments.length}
                  {filteredAssessments.length !== allottedCount ? ` of ${allottedCount}` : ""}
                </span>
              </h3>
              <p style={{ fontSize: 12.5, color: t.textMuted, margin: "4px 0 0", letterSpacing: 0.2 }}>
                Live updates are pushed instantly. Press refresh only if you need to recover after a connection issue.
              </p>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <SearchAndFilter
              theme={theme}
              query={searchQuery}
              onQuery={setSearchQuery}
              filter={filter}
              onFilter={setFilter}
              counts={bucketCounts}
            />
          </div>

          {error ? (
            <div
              style={{
                background: t.dangerBg,
                border: `1px solid ${t.danger}55`,
                color: t.danger,
                borderRadius: 14,
                padding: 16,
                fontSize: 14,
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                animation: "fadeIn 0.3s ease",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          ) : filteredAssessments.length === 0 ? (
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
                boxShadow: t.name === "light" ? "0 6px 20px rgba(20,28,60,0.06)" : "none",
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
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="1.8">
                  {searchQuery || filter !== "all" ? (
                    <>
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </>
                  ) : (
                    <>
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </>
                  )}
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
                {searchQuery || filter !== "all" ? "No matches found" : "No assessments yet"}
              </div>
              <div>
                {searchQuery || filter !== "all"
                  ? "Try adjusting your search or filter."
                  : "You will see your upcoming assessments here once they are assigned."}
              </div>
              {(searchQuery || filter !== "all") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setFilter("all");
                  }}
                  style={{
                    marginTop: 16,
                    padding: "8px 18px",
                    fontSize: 12,
                    fontWeight: 700,
                    background: t.accentGradient,
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 999,
                    cursor: "pointer",
                    fontFamily: "'Inter', sans-serif",
                    letterSpacing: 0.4,
                    boxShadow: t.glowAccent,
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
                gap: 20,
                alignItems: "start",
              }}
            >
              {filteredAssessments.map((exam, i) => (
                <AssessmentCard
                  key={exam.assessmentid ?? exam.examid}
                  exam={exam}
                  index={i}
                  pendingRequest={pendingRequestsByAssessment[exam.assessmentid] ?? null}
                  theme={theme}
                  onEnter={onEnterExam}
                  onRequest={openRequestModal}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <RequestModal
        open={requestModalOpen}
        exam={selectedExamForRequest}
        reason={requestReason}
        onChangeReason={setRequestReason}
        onClose={closeRequestModal}
        onSubmit={submitPermissionRequest}
        submitting={submittingRequest}
        submitError={submitRequestError}
        theme={theme}
      />
    </div>
  );
}
