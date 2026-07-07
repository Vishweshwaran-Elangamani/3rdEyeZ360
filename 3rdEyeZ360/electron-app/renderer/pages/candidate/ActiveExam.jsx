import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import axios from "axios";
import useAuthStore from "../../store/authStore";
import useSocket from "../../hooks/useSocket";

const API = "http://localhost:3000";
const POLL_INTERVAL = 3000;

const TERMINAL_ASSESSMENT_STATUSES = new Set(["TERMINATED", "LOCKED", "COMPLETED"]);
const TERMINAL_EXAM_STATUSES = new Set(["COMPLETED", "TERMINATED"]);

function pick(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return null;
}

function toUpper(value) {
  return String(value ?? "").trim().toUpperCase();
}

function canonicalStatus(value) {
  return toUpper(value).replace(/\s+/g, "").replace(/_/g, "");
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

  const examStatus = toUpper(pick(raw.examstatus, raw.exam_status, raw.status, ""));

  return {
    ...raw,
    examid: pick(raw.examid, raw.exam_id),
    assessmentid: pick(raw.assessmentid, raw.assessment_id),
    candidateid: pick(raw.candidateid, raw.candidate_id),
    name: pick(raw.name, raw.examname, raw.exam_name, "Exam"),
    description: pick(raw.description, raw.examdescription, raw.exam_description, ""),
    date: pick(raw.date, raw.examdate, raw.exam_date, "--"),
    starttime: pick(raw.starttime, raw.start_time, raw.examstarttime, raw.exam_start_time, "--:--"),
    endtime: pick(raw.endtime, raw.end_time, raw.examendtime, raw.exam_end_time, "--:--"),
    durationminutes: Number(pick(raw.durationminutes, raw.duration_minutes, 0) || 0),
    violationthreshold: Number(pick(raw.violationthreshold, raw.violation_threshold, 0) || 0),
    instructions: pick(raw.instructions, ""),
    allowedwebsites: normalizeSites(raw.allowedwebsites, raw.allowed_websites),
    allowedapplications: Array.isArray(pick(raw.allowedapplications, raw.allowed_applications))
      ? pick(raw.allowedapplications, raw.allowed_applications)
      : [],
    status: examStatus,
    examstatus: examStatus,
  };
}

function normalizeAssessment(raw) {
  if (!raw) return null;

  const assessmentStatus = toUpper(pick(raw.status, raw.assessmentstatus, raw.assessment_status, ""));
  const finalStatus = toUpper(pick(raw.finalstatus, raw.final_status, ""));
  const examStatus = toUpper(
    pick(raw.examstatus, raw.exam_status, raw.status_exam, raw.runtimestatus, "")
  );

  return {
    ...raw,
    assessmentid: pick(raw.assessmentid, raw.assessment_id),
    examid: pick(raw.examid, raw.exam_id),
    candidateid: pick(raw.candidateid, raw.candidate_id),
    examinerid: pick(raw.examinerid, raw.examiner_id),
    name: pick(raw.name, raw.examname, raw.exam_name, "Exam"),
    description: pick(raw.description, raw.examdescription, raw.exam_description, ""),
    date: pick(raw.date, raw.examdate, raw.exam_date, "--"),
    starttime: pick(raw.starttime, raw.start_time, raw.examstarttime, raw.exam_start_time, "--:--"),
    endtime: pick(raw.endtime, raw.end_time, raw.examendtime, raw.exam_end_time, "--:--"),
    durationminutes: Number(pick(raw.durationminutes, raw.duration_minutes, 0) || 0),
    violationthreshold: Number(pick(raw.violationthreshold, raw.violation_threshold, 0) || 0),
    instructions: pick(raw.instructions, ""),
    allowedwebsites: normalizeSites(raw.allowedwebsites, raw.allowed_websites),
    allowedapplications: Array.isArray(pick(raw.allowedapplications, raw.allowed_applications))
      ? pick(raw.allowedapplications, raw.allowed_applications)
      : [],
    status: assessmentStatus,
    assessmentstatus: assessmentStatus,
    finalstatus: finalStatus,
    examstatus: examStatus,
  };
}

function getExamStatus(source) {
  return canonicalStatus(pick(source?.examstatus, source?.exam_status, source?.status, ""));
}

function getAssessmentStatus(source) {
  return canonicalStatus(pick(source?.assessmentstatus, source?.assessment_status, source?.status, ""));
}

function getFinalStatus(source) {
  return canonicalStatus(pick(source?.finalstatus, source?.final_status, ""));
}

function safeHost(url) {
  try {
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function pill(bg, color) {
  return {
    background: bg,
    color,
    borderRadius: 10,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
  };
}

function formatRemaining(ms) {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const hrs = Math.floor(totalSecs / 3600);
  const remMins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  return `${String(hrs).padStart(2, "0")}:${String(remMins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function ActiveExam({ exam, assessment, onComplete, onLogout, onReturnToDashboard }) {
  const shellRef = useRef(null);
  const browserAreaRef = useRef(null);
  const completedRef = useRef(false);
  const browserOpenedRef = useRef(false);
  const lastNavigatedUrlRef = useRef(null);
  const returningRef = useRef(false);
  const finishingRef = useRef(false);

  const { accessToken, user } = useAuthStore();
  const socket = useSocket(accessToken);

  const normalizedExam = useMemo(() => normalizeExam(exam), [exam]);
  const normalizedAssessment = useMemo(() => normalizeAssessment(assessment), [assessment]);

  const [liveExam, setLiveExam] = useState(normalizedExam);
  const [liveAssessment, setLiveAssessment] = useState(normalizedAssessment);
  const [activeTab, setActiveTab] = useState(0);
  const [checking, setChecking] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [returning, setReturning] = useState(false);
  const [browserError, setBrowserError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    setLiveExam(normalizedExam);
  }, [normalizedExam]);

  useEffect(() => {
    setLiveAssessment(normalizedAssessment);
  }, [normalizedAssessment]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const examId = pick(
    liveAssessment?.examid,
    normalizedAssessment?.examid,
    liveExam?.examid,
    normalizedExam?.examid
  );

  const assessmentId = pick(
    liveAssessment?.assessmentid,
    normalizedAssessment?.assessmentid,
    liveExam?.assessmentid,
    normalizedExam?.assessmentid
  );

  const candidateId = pick(
    liveAssessment?.candidateid,
    normalizedAssessment?.candidateid,
    liveExam?.candidateid,
    normalizedExam?.candidateid,
    user?.userid
  );

  const allowedSites = useMemo(
    () =>
      normalizeSites(
        normalizedAssessment?.allowedwebsites,
        normalizedExam?.allowedwebsites,
        liveAssessment?.allowedwebsites,
        liveExam?.allowedwebsites
      ),
    [normalizedAssessment, normalizedExam, liveAssessment, liveExam]
  );

  useEffect(() => {
    if (activeTab > allowedSites.length - 1) {
      setActiveTab(0);
    }
  }, [allowedSites, activeTab]);

  const merged = useMemo(
    () => ({
      ...(normalizedExam || {}),
      ...(normalizedAssessment || {}),
      ...(liveExam || {}),
      ...(liveAssessment || {}),
    }),
    [normalizedExam, normalizedAssessment, liveExam, liveAssessment]
  );

  const activeUrl = allowedSites[activeTab] || allowedSites[0] || null;

  const safeElectron = useCallback(async (runner, fallbackMessage) => {
    try {
      const result = await runner();
      if (result && typeof result === "object" && "success" in result && result.success !== true) {
        throw new Error(result?.error || fallbackMessage);
      }
      return true;
    } catch (error) {
      console.log(fallbackMessage, error);
      setBrowserError(error?.message || fallbackMessage);
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const ensureBrowserOpen = async () => {
      if (!window.electronAPI || completedRef.current) return;
      if (!allowedSites.length) return;
      if (browserOpenedRef.current) return;

      const ok = await safeElectron(
        () =>
          window.electronAPI.openBrowser({
            allowedWebsites: allowedSites,
          }),
        "Failed to open secured browser."
      );

      if (!cancelled && ok) {
        browserOpenedRef.current = true;
        setBrowserError("");
      }
    };

    ensureBrowserOpen();

    return () => {
      cancelled = true;
    };
  }, [allowedSites, safeElectron]);

  const positionAndFocusBrowser = useCallback(async () => {
    if (!window.electronAPI || completedRef.current) return;

    const shellRect = shellRef.current?.getBoundingClientRect?.();
    const browserRect = browserAreaRef.current?.getBoundingClientRect?.();

    if (shellRect && browserRect) {
      const top = Math.max(0, Math.round(browserRect.top - shellRect.top));
      const left = Math.max(0, Math.round(browserRect.left - shellRect.left));
      const right = Math.max(0, Math.round(shellRect.right - browserRect.right));
      const bottom = Math.max(0, Math.round(shellRect.bottom - browserRect.bottom));

      await safeElectron(
        () => window.electronAPI.resizeBrowser({ top, left, right, bottom }),
        "Failed to resize secured browser."
      );
    }

    await safeElectron(() => window.electronAPI.showBrowser(), "Failed to show secured browser.");
    await safeElectron(() => window.electronAPI.restoreBrowser(), "Failed to restore secured browser.");
    await safeElectron(() => window.electronAPI.focusBrowser(), "Failed to focus secured browser.");
  }, [safeElectron]);

  useEffect(() => {
    positionAndFocusBrowser();
  }, [positionAndFocusBrowser]);

  useEffect(() => {
    if (!activeUrl || !window.electronAPI || completedRef.current) return;
    if (!browserOpenedRef.current) return;
    if (lastNavigatedUrlRef.current === activeUrl) return;

    let cancelled = false;

    const navigateToTab = async () => {
      const ok = await safeElectron(
        () => window.electronAPI.navigateBrowser(activeUrl),
        "Failed to navigate secured browser."
      );

      if (!cancelled && ok) {
        lastNavigatedUrlRef.current = activeUrl;
        setBrowserError("");
        await safeElectron(() => window.electronAPI.showBrowser(), "Failed to show secured browser.");
        await safeElectron(() => window.electronAPI.focusBrowser(), "Failed to focus secured browser.");
      }
    };

    navigateToTab();

    return () => {
      cancelled = true;
    };
  }, [activeUrl, safeElectron]);

  useEffect(() => {
    const sendBounds = async () => {
      if (!shellRef.current || !browserAreaRef.current || !window.electronAPI || completedRef.current) return;

      const shellRect = shellRef.current.getBoundingClientRect();
      const browserRect = browserAreaRef.current.getBoundingClientRect();

      const top = Math.max(0, Math.round(browserRect.top - shellRect.top));
      const left = Math.max(0, Math.round(browserRect.left - shellRect.left));
      const right = Math.max(0, Math.round(shellRect.right - browserRect.right));
      const bottom = Math.max(0, Math.round(shellRect.bottom - browserRect.bottom));

      await safeElectron(
        () => window.electronAPI.resizeBrowser({ top, left, right, bottom }),
        "Failed to resize secured browser."
      );
      await safeElectron(() => window.electronAPI.showBrowser(), "Failed to show secured browser.");
    };

    sendBounds();
    const id = setTimeout(sendBounds, 300);
    window.addEventListener("resize", sendBounds);

    return () => {
      clearTimeout(id);
      window.removeEventListener("resize", sendBounds);
    };
  }, [allowedSites.length, safeElectron]);

  const cleanupExamShell = useCallback(async () => {
    try {
      await window.electronAPI?.stopCapture?.();
    } catch (error) {
      console.log("stopCapture failed", error);
    }
    try {
      await window.electronAPI?.closeBrowser?.();
    } catch (error) {
      console.log("closeBrowser failed", error);
    }
    try {
      await window.electronAPI?.disableLockdown?.();
    } catch (error) {
      console.log("disableLockdown failed", error);
    }
    try {
      await window.electronAPI?.setClosable?.(true);
    } catch (error) {
      console.log("setClosable failed", error);
    }

    browserOpenedRef.current = false;
    lastNavigatedUrlRef.current = null;
  }, []);

  const finishExam = useCallback(async () => {
    if (completedRef.current || finishingRef.current) return;
    finishingRef.current = true;
    completedRef.current = true;

    await cleanupExamShell();
    onComplete?.();
  }, [cleanupExamShell, onComplete]);

  const returnToDashboardSafe = useCallback(async () => {
    if (completedRef.current || returningRef.current || returning) return;

    returningRef.current = true;
    setReturning(true);

    try {
      await cleanupExamShell();
      await onReturnToDashboard?.();
    } finally {
      setReturning(false);
      returningRef.current = false;
    }
  }, [cleanupExamShell, onReturnToDashboard, returning]);

  useEffect(() => {
    if (!socket || !examId) return;

    socket.emit("joinexam", {
      examid: examId,
      assessmentid: assessmentId,
      candidateid: candidateId,
      role: "Candidate",
    });

    const onControlCommand = async (payload) => {
      const payloadExamId = pick(payload?.examid, payload?.examId);
      const payloadAssessmentId = pick(payload?.assessmentid, payload?.assessmentId);
      const payloadCandidateId = pick(payload?.candidateid, payload?.candidateId);

      const examMatch = !payloadExamId || String(payloadExamId) === String(examId);
      const assessmentMatch = !payloadAssessmentId || String(payloadAssessmentId) === String(assessmentId);
      const candidateMatch = !payloadCandidateId || String(payloadCandidateId) === String(candidateId);

      if (!examMatch || !assessmentMatch || !candidateMatch) return;

      const action = toUpper(payload?.action ?? payload);
      const status = canonicalStatus(payload?.status);

      if (action === "TERMINATE" || status === "TERMINATED") {
        setStatusMsg("Your assessment has been terminated by the examiner.");
        await finishExam();
        return;
      }

      if (action === "PAUSE") {
        setLiveAssessment((prev) => ({
          ...(prev || {}),
          status: "PAUSED",
          assessmentstatus: "PAUSED",
        }));
        setStatusMsg("Your assessment has been paused by the examiner.");
        return;
      }

      if (action === "RESUME") {
        setLiveAssessment((prev) => ({
          ...(prev || {}),
          status: "ACTIVE",
          assessmentstatus: "ACTIVE",
        }));
        setStatusMsg("Your assessment has been resumed.");
      }
    };

    socket.on("controlcommand", onControlCommand);

    return () => {
      socket.off("controlcommand", onControlCommand);
    };
  }, [socket, examId, assessmentId, candidateId, finishExam]);

  const checkLiveStatus = useCallback(async () => {
    if (completedRef.current) {
      setChecking(false);
      return;
    }

    if (!examId || !assessmentId || !accessToken) {
      setChecking(false);
      return;
    }

    try {
      const [examRes, assessmentRes] = await Promise.all([
        axios.get(`${API}/api/exams/${examId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        axios.get(`${API}/api/assessments/${assessmentId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      const latestExam = normalizeExam(examRes?.data);
      const latestAssessment = normalizeAssessment(assessmentRes?.data);

      if (latestExam) setLiveExam(latestExam);
      if (latestAssessment) setLiveAssessment(latestAssessment);

      const examStatus = getExamStatus(latestExam);
      const assessmentStatus = getAssessmentStatus(latestAssessment);
      const finalStatus = getFinalStatus(latestAssessment);

      console.log("ACTIVE checkLiveStatus", {
        examStatus,
        assessmentStatus,
        finalStatus,
        latestExam,
        latestAssessment,
      });

      const shouldEnd =
        TERMINAL_EXAM_STATUSES.has(examStatus) ||
        TERMINAL_ASSESSMENT_STATUSES.has(assessmentStatus) ||
        (finalStatus && TERMINAL_ASSESSMENT_STATUSES.has(finalStatus));

      if (shouldEnd) {
        await finishExam();
        return;
      }

      await safeElectron(() => window.electronAPI?.showBrowser?.(), "Failed to show secured browser.");
      await safeElectron(() => window.electronAPI?.focusBrowser?.(), "Failed to focus secured browser.");
    } catch (error) {
      console.log("ActiveExam status check failed", error);
      setStatusMsg(error?.response?.data?.detail || error?.message || "Live status check failed.");
    } finally {
      setChecking(false);
    }
  }, [examId, assessmentId, accessToken, finishExam, safeElectron]);

  useEffect(() => {
    checkLiveStatus();
    const poll = setInterval(checkLiveStatus, POLL_INTERVAL);
    return () => clearInterval(poll);
  }, [checkLiveStatus]);

  const startDate = merged.date || normalizedExam?.date;
  const startClock = merged.starttime || normalizedExam?.starttime;
  const durationMinutes = Number(merged.durationminutes || normalizedExam?.durationminutes || 0);

  const startMs =
    startDate && startClock && startDate !== "--" && startClock !== "--:--"
      ? new Date(`${startDate}T${startClock}:00`).getTime()
      : null;

  const endMs = startMs && durationMinutes > 0 ? startMs + durationMinutes * 60 * 1000 : null;
  const remainingMs = endMs ? Math.max(0, endMs - now) : 0;

  useEffect(() => {
    if (completedRef.current) return;
    if (!endMs) return;
    if (now >= endMs) {
      console.log("Timer reached scheduled end, waiting for backend terminal status.");
      setStatusMsg("Scheduled end time reached. Waiting for final confirmation from server.");
    }
  }, [endMs, now]);

  useEffect(() => {
    return () => {
      browserOpenedRef.current = false;
      lastNavigatedUrlRef.current = null;

      if (!completedRef.current && !returningRef.current) {
        console.log("ActiveExam unmounted without completion; browser close skipped to avoid accidental teardown.");
      }
    };
  }, []);

  const endLabel = merged.endtime || normalizedExam?.endtime || "--:--";
  const examName = merged.name || normalizedExam?.name || "Exam";
  const assessmentStatus = liveAssessment?.status || normalizedAssessment?.status || merged.status || "-";
  const examStatus = liveExam?.examstatus || liveExam?.status || merged.examstatus || "-";
  const isPaused = canonicalStatus(assessmentStatus) === "PAUSED";

  return (
    <div
      ref={shellRef}
      style={{
        minHeight: "100vh",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#0f1117",
        color: "#e8eaf0",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 58,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 18px",
          background: "#1a1d27",
          borderBottom: "1px solid #2c3143",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>3rdEyeZ360</div>
          <div style={{ width: 1, height: 20, background: "#394055" }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>{examName}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={pill("#2b2230", "#ff6b6b")}>{formatRemaining(remainingMs)}</div>
          <div style={pill("#252c40", "#b8d1ff")}>Ends at {endLabel}</div>
          <div style={pill("#252937", "#f2c46d")}>Assessment {assessmentStatus}</div>
          <div style={pill("#15281f", "#4ade80")}>Exam {examStatus}</div>
          {onLogout ? (
            <button onClick={onLogout} className="btn btn-ghost" style={{ padding: "7px 14px", fontSize: 13 }}>
              Logout
            </button>
          ) : null}
        </div>
      </div>

      {allowedSites.length > 1 ? (
        <div
          style={{
            height: 44,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 16px",
            background: "#161925",
            borderBottom: "1px solid #2c3143",
            flexShrink: 0,
            overflowX: "auto",
          }}
        >
          <span style={{ fontSize: 11, color: "#8b90a0", marginRight: 6 }}>Allowed sites</span>
          {allowedSites.map((site, index) => (
            <button
              key={`${site}-${index}`}
              onClick={() => setActiveTab(index)}
              style={{
                background: index === activeTab ? "#10243a" : "#22263a",
                border: index === activeTab ? "1px solid #4f8ef7" : "1px solid #2e3347",
                color: index === activeTab ? "#8fc2ff" : "#c8cad0",
                borderRadius: 8,
                padding: "5px 12px",
                fontSize: 12,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              title={site}
            >
              {safeHost(site)}
            </button>
          ))}
        </div>
      ) : null}

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div
          ref={browserAreaRef}
          style={{
            flex: 1,
            background: "#0a0c14",
            position: "relative",
            borderRight: "1px solid #2c3143",
          }}
        >
          {isPaused ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0, 0, 0, 0.82)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 100,
                textAlign: "center",
                padding: 24,
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 16 }}>⏸️</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Assessment Paused</h2>
              <p style={{ color: "#8b90a0", fontSize: 14, maxWidth: 360, lineHeight: 1.7 }}>
                Your examiner has paused the assessment. Please stay available and wait for resume.
              </p>
            </div>
          ) : null}

          {browserError ? (
            <div
              style={{
                position: "absolute",
                top: 16,
                left: 16,
                right: 16,
                zIndex: 101,
                background: "#2a1010",
                border: "1px solid #f75f5f",
                borderRadius: 10,
                padding: "12px 14px",
                color: "#f3c2c2",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {browserError}
            </div>
          ) : null}

          {!allowedSites.length ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#8b90a0",
                fontSize: 14,
                zIndex: 50,
                padding: 24,
                textAlign: "center",
              }}
            >
              No allowed website configured for this assessment.
            </div>
          ) : null}
        </div>

        <div
          style={{
            width: 340,
            background: "#1a1d27",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <div style={{ padding: "16px 18px", borderBottom: "1px solid #2e3347", flexShrink: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Exam Status</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ background: "#22263a", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, color: "#8b90a0", marginBottom: 2 }}>Assessment</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#f2c46d" }}>{assessmentStatus}</div>
              </div>
              <div style={{ background: "#22263a", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, color: "#8b90a0", marginBottom: 2 }}>Exam</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#4ade80" }}>{examStatus}</div>
              </div>
              <div style={{ background: "#22263a", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, color: "#8b90a0", marginBottom: 2 }}>Start</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{merged.starttime || "--:--"}</div>
              </div>
              <div style={{ background: "#22263a", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, color: "#8b90a0", marginBottom: 2 }}>Duration</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{durationMinutes} min</div>
              </div>
            </div>

            {checking ? (
              <div style={{ fontSize: 11, color: "#8b90a0", marginTop: 10 }}>Syncing live state...</div>
            ) : null}

            {statusMsg ? (
              <div
                style={{
                  marginTop: 12,
                  background: "#22263a",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 12,
                  color: "#c8cad0",
                  lineHeight: 1.6,
                }}
              >
                {statusMsg}
              </div>
            ) : null}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Allowed websites</div>

            {allowedSites.length === 0 ? (
              <p style={{ fontSize: 12, color: "#8b90a0" }}>No allowed websites found.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {allowedSites.map((site, index) => (
                  <button
                    key={`${site}-${index}`}
                    onClick={() => setActiveTab(index)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: index === activeTab ? "#10243a" : "#22263a",
                      border: index === activeTab ? "1px solid #4f8ef7" : "1px solid #2e3347",
                      borderRadius: 8,
                      padding: "10px 12px",
                      color: index === activeTab ? "#8fc2ff" : "#c8cad0",
                      cursor: "pointer",
                    }}
                    title={site}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{safeHost(site)}</div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#8b90a0",
                        marginTop: 4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {site}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {merged.instructions ? (
              <>
                <div style={{ fontWeight: 700, fontSize: 13, marginTop: 18, marginBottom: 10 }}>Instructions</div>
                <div
                  style={{
                    background: "#22263a",
                    borderRadius: 8,
                    padding: "12px 14px",
                    fontSize: 12,
                    color: "#c8cad0",
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {merged.instructions}
                </div>
              </>
            ) : null}
          </div>

          <div
            style={{
              height: 48,
              borderTop: "1px solid #2e3347",
              display: "flex",
              alignItems: "center",
              padding: "0 16px",
              gap: 16,
              fontSize: 11,
              color: "#8b90a0",
              flexShrink: 0,
            }}
          >
            <span>Secured Browser</span>
            <span>{allowedSites.length ? "Domain restricted" : "No domain config"}</span>
            <span style={{ marginLeft: "auto", color: "#f75f5f" }}>Do not close this window</span>
          </div>
        </div>
      </div>

      {typeof onReturnToDashboard === "function" &&
      (canonicalStatus(assessmentStatus) === "LOCKED" || canonicalStatus(assessmentStatus) === "TERMINATED") ? (
        <div style={{ position: "fixed", right: 16, bottom: 16, zIndex: 120 }}>
          <button
            onClick={returnToDashboardSafe}
            disabled={returning}
            className="btn btn-ghost"
            style={{ padding: "10px 14px", fontSize: 13, background: "#1a1d27" }}
          >
            {returning ? "Returning..." : "Back to Dashboard"}
          </button>
        </div>
      ) : null}
    </div>
  );
}