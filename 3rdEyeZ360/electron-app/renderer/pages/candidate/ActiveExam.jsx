import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import axios from "axios";
import useAuthStore from "../../store/authStore";
import { useSocket } from "../../hooks/useSocket";

const API = "http://localhost:3000";

const RUNTIME_ASSESSMENT_STATUSES = new Set([
  "ACTIVE",
  "PAUSED",
  "READY",
  "ASSIGNED",
  "AVAILABLE",
  "REENTRYAPPROVED",
  "LATEENTRYAPPROVED",
  "REENTRY_APPROVED",
  "LATEENTRY_APPROVED",
]);

const TERMINAL_ASSESSMENT_STATUSES = new Set([
  "TERMINATED",
  "LOCKED",
]);

export default function ActiveExam({
  exam,
  assessment,
  onComplete,
  onLogout,
}) {
  const shellRef = useRef(null);
  const browserAreaRef = useRef(null);
  const completedRef = useRef(false);

  const { accessToken } = useAuthStore();
  const socket = useSocket(accessToken);

  const examId =
    assessment?.examid ??
    assessment?.exam_id ??
    exam?.examid ??
    exam?.exam_id;

  const assessmentId =
    assessment?.assessmentid ??
    assessment?.assessment_id ??
    exam?.assessmentid ??
    exam?.assessment_id;

  const candidateId =
    assessment?.candidateid ??
    assessment?.candidate_id ??
    exam?.candidateid ??
    exam?.candidate_id;

  const allowedSites = useMemo(() => {
    const candidates = [
      assessment?.allowedwebsites,
      assessment?.allowed_websites,
      exam?.allowedwebsites,
      exam?.allowed_websites,
    ];

    for (const item of candidates) {
      if (Array.isArray(item) && item.length) return item;
    }

    return [];
  }, [assessment, exam]);

  const [activeTab, setActiveTab] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [liveExam, setLiveExam] = useState(null);
  const [liveAssessment, setLiveAssessment] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const merged = useMemo(
    () => ({
      ...exam,
      ...assessment,
      ...liveExam,
      ...liveAssessment,
    }),
    [exam, assessment, liveExam, liveAssessment]
  );

  const activeUrl = allowedSites[activeTab] || "";

  useEffect(() => {
    if (!window.electronAPI || !activeUrl) return;
    window.electronAPI.navigateBrowser?.(activeUrl);
  }, [activeUrl]);

  useEffect(() => {
    const sendBounds = () => {
      if (!shellRef.current || !browserAreaRef.current || !window.electronAPI) return;

      const shellRect = shellRef.current.getBoundingClientRect();
      const browserRect = browserAreaRef.current.getBoundingClientRect();

      const top = Math.max(0, Math.round(browserRect.top - shellRect.top));
      const left = Math.max(0, Math.round(browserRect.left - shellRect.left));
      const right = Math.max(0, Math.round(shellRect.right - browserRect.right));
      const bottom = Math.max(0, Math.round(shellRect.bottom - browserRect.bottom));

      window.electronAPI.resizeBrowser?.({ top, left, right, bottom });
    };

    sendBounds();

    const id = setTimeout(sendBounds, 300);
    window.addEventListener("resize", sendBounds);

    return () => {
      clearTimeout(id);
      window.removeEventListener("resize", sendBounds);
    };
  }, [activeTab, allowedSites.length]);

  const finishExam = useCallback(async () => {
    if (completedRef.current) return;
    completedRef.current = true;

    try {
      await window.electronAPI?.stopCapture?.();
    } catch (e) {
      console.log("stopCapture failed", e);
    }

    try {
      await window.electronAPI?.closeBrowser?.();
    } catch (e) {
      console.log("closeBrowser failed", e);
    }

    try {
      await window.electronAPI?.disableLockdown?.();
    } catch (e) {
      console.log("disableLockdown failed", e);
    }

    try {
      await window.electronAPI?.setClosable?.(true);
    } catch (e) {
      console.log("setClosable failed", e);
    }

    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    if (!socket || !examId) return;

    socket.emit("join_exam", {
      exam_id: examId,
      examid: examId,
      assessment_id: assessmentId,
      assessmentid: assessmentId,
      candidate_id: candidateId,
      candidateid: candidateId,
      role: "Candidate",
    });

    const onExaminerControl = async (payload) => {
      const payloadExamId = payload?.exam_id ?? payload?.examid;
      const payloadAssessmentId = payload?.assessment_id ?? payload?.assessmentid;
      const payloadCandidateId = payload?.candidate_id ?? payload?.candidateid;
      const action = String(payload?.action ?? "").toLowerCase();
      const status = String(payload?.status ?? "").toUpperCase();

      const examMatch = !payloadExamId || String(payloadExamId) === String(examId);
      const assessmentMatch = !payloadAssessmentId || String(payloadAssessmentId) === String(assessmentId);
      const candidateMatch = !payloadCandidateId || String(payloadCandidateId) === String(candidateId);

      if (!examMatch || !assessmentMatch || !candidateMatch) return;

      if (action === "terminate" || status === "TERMINATED") {
        await finishExam();
      }
    };

    socket.on("examiner_control", onExaminerControl);
    return () => {
      socket.off("examiner_control", onExaminerControl);
    };
  }, [socket, examId, assessmentId, candidateId, finishExam]);

  const checkLiveStatus = useCallback(async () => {
    if (!examId || !accessToken || !assessmentId) {
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

      const latestExam = examRes?.data ?? null;
      const latestAssessment = assessmentRes?.data ?? null;

      if (latestExam) setLiveExam(latestExam);
      if (latestAssessment) setLiveAssessment(latestAssessment);

      const examStatus = String(latestExam?.status ?? "");
      const assessmentStatus = String(latestAssessment?.status ?? "").toUpperCase();
      const finalStatus = String(
        latestAssessment?.finalstatus ?? latestAssessment?.final_status ?? ""
      ).toUpperCase();

      const shouldEnd =
        examStatus !== "Running" ||
        TERMINAL_ASSESSMENT_STATUSES.has(assessmentStatus) ||
        TERMINAL_ASSESSMENT_STATUSES.has(finalStatus);

      if (shouldEnd) {
        await finishExam();
        return;
      }
    } catch (e) {
      console.log("ActiveExam status check failed", e);
    } finally {
      setChecking(false);
    }
  }, [examId, assessmentId, accessToken, finishExam]);

  useEffect(() => {
    checkLiveStatus();
    const poll = setInterval(checkLiveStatus, 3000);
    return () => clearInterval(poll);
  }, [checkLiveStatus]);

  const startDate = merged.date || exam?.date;
  const startClock =
    merged.starttime || merged.start_time || exam?.starttime || exam?.start_time;

  const durationMinutes = Number(
    merged.durationminutes ??
      merged.duration_minutes ??
      exam?.durationminutes ??
      exam?.duration_minutes ??
      0
  );

  const startMs = startDate && startClock
    ? new Date(`${startDate}T${startClock}:00`).getTime()
    : null;

  const endMs = startMs && durationMinutes > 0
    ? startMs + durationMinutes * 60 * 1000
    : null;

  const remainingMs = endMs ? Math.max(0, endMs - now) : 0;
  const totalSecs = Math.floor(remainingMs / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const remMins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  useEffect(() => {
    if (endMs && now >= endMs) {
      finishExam();
    }
  }, [endMs, now, finishExam]);

  useEffect(() => {
    return () => {
      window.electronAPI?.closeBrowser?.();
    };
  }, []);

  const endLabel = merged.endtime || merged.end_time || exam?.endtime || exam?.end_time || "--:--";
  const examName = merged.name || exam?.name || "Exam";
  const assessmentStatus = liveAssessment?.status || assessment?.status || merged.status || "-";
  const examStatus = liveExam?.status || merged.examstatus || merged.exam_status || exam?.status || "-";

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
          <div style={pill("#2b2230", "#ff6b6b")}>
            ⏱ {String(hrs).padStart(2, "0")}:
            {String(remMins).padStart(2, "0")}:
            {String(secs).padStart(2, "0")}
          </div>
          <div style={pill("#252c40", "#b8d1ff")}>🕒 Ends at {endLabel}</div>
          <div style={pill("#252937", "#f2c46d")}>Assessment {assessmentStatus}</div>
          <div style={pill("#15281f", "#44d17a")}>Exam {examStatus}</div>
        </div>
      </div>

      <div
        style={{
          height: 44,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 10px",
          background: "#252a3d",
          borderBottom: "1px solid #32384d",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 13, color: "#98a0b8" }}>Allowed websites:</div>

        {allowedSites.map((site, i) => {
          const label = safeHost(site) || `Tab ${i + 1}`;
          const active = i === activeTab;

          return (
            <button
              key={`${site}-${i}`}
              onClick={() => setActiveTab(i)}
              style={{
                border: active ? "1px solid #4f8ef7" : "1px solid #474e65",
                background: active ? "#193457" : "#2a2f3f",
                color: active ? "#cfe3ff" : "#e8eaf0",
                borderRadius: 8,
                padding: "7px 12px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Tab {i + 1}: {label}
            </button>
          );
        })}

        {checking && (
          <div style={{ marginLeft: "auto", fontSize: 12, color: "#98a0b8" }}>
            Syncing exam status...
          </div>
        )}
      </div>

      <div
        ref={browserAreaRef}
        style={{
          flex: 1,
          minHeight: 0,
          background: "#0b0f17",
        }}
      />

      <div
        style={{
          height: 34,
          background: "#1a1d27",
          borderTop: "1px solid #2c3143",
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "0 12px",
          color: "#a5acc0",
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        <span>📷 Camera Active</span>
        <span>🌐 Connected</span>
        <span>🔴 Recording</span>

        {onLogout && (
          <button
            onClick={onLogout}
            style={{
              marginLeft: "auto",
              background: "#2a2f3f",
              color: "#e8eaf0",
              border: "1px solid #474e65",
              borderRadius: 8,
              padding: "5px 10px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        )}
      </div>
    </div>
  );
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