import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import useAuthStore from "../../store/authStore";

const API = "http://localhost:3000";

function LogoutButton({ onLogout }) {
  const [loading, setLoading] = useState(false);

  const handle = async () => {
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
      onClick={handle}
      disabled={loading}
      className="btn btn-ghost"
      style={{ padding: "8px 14px", fontSize: 12 }}
    >
      {loading ? "Signing out..." : "Logout"}
    </button>
  );
}

const RUNNABLE_ASSESSMENT_STATUSES = new Set([
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

const TERMINAL_EXAM_STATUSES = new Set([
  "Completed",
  "Terminated",
]);

export default function WaitScreen({ exam, assessment, onExamStart, onLogout, onComplete }) {
  const { accessToken } = useAuthStore();
  const [now, setNow] = useState(new Date());
  const [checking, setChecking] = useState(true);
  const [liveExam, setLiveExam] = useState(null);
  const [liveAssessment, setLiveAssessment] = useState(null);
  const [launched, setLaunched] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

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

  const allowedSites = useMemo(() => {
    const lists = [
      assessment?.allowedwebsites,
      assessment?.allowed_websites,
      exam?.allowedwebsites,
      exam?.allowed_websites,
      liveAssessment?.allowedwebsites,
      liveAssessment?.allowed_websites,
      liveExam?.allowedwebsites,
      liveExam?.allowed_websites,
    ];

    for (const item of lists) {
      if (Array.isArray(item) && item.length) return item;
    }

    return [];
  }, [assessment, exam, liveAssessment, liveExam]);

  const cleanupWaitingState = useCallback(async () => {
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

  const ensureBrowserVisible = useCallback(async () => {
    if (!window.electronAPI) {
      console.log("electronAPI not available");
      return false;
    }

    try {
      await window.electronAPI.enableLockdown?.();
      await window.electronAPI.setClosable?.(false);
      await window.electronAPI.openBrowser?.({ allowedWebsites: allowedSites });

      if (allowedSites.length > 0) {
        await window.electronAPI.navigateBrowser?.(allowedSites[0]);
      }

      return true;
    } catch (e) {
      console.log("ensureBrowserVisible failed", e);
      return false;
    }
  }, [allowedSites]);

  const checkExamStatus = useCallback(async () => {
    if (!examId || !accessToken) {
      setChecking(false);
      return;
    }

    try {
      const [examRes, assessmentRes] = await Promise.all([
        axios.get(`${API}/api/exams/${examId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        assessmentId
          ? axios.get(`${API}/api/assessments/${assessmentId}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            })
          : Promise.resolve({ data: null }),
      ]);

      const latestExam = examRes?.data ?? null;
      const latestAssessment = assessmentRes?.data ?? null;

      if (latestExam) setLiveExam(latestExam);
      if (latestAssessment) setLiveAssessment(latestAssessment);

      const examStatus = String(latestExam?.status ?? "");
      const assessmentStatus = String(latestAssessment?.status ?? "");
      const finalStatus = String(
        latestAssessment?.finalstatus ?? latestAssessment?.final_status ?? ""
      ).toUpperCase();

      const terminated =
        TERMINAL_ASSESSMENT_STATUSES.has(assessmentStatus.toUpperCase()) ||
        TERMINAL_ASSESSMENT_STATUSES.has(finalStatus) ||
        TERMINAL_EXAM_STATUSES.has(examStatus);

      if (terminated) {
        await cleanupWaitingState();
        return;
      }

      const examRunning = examStatus === "Running";
      const assessmentRunnable =
        RUNNABLE_ASSESSMENT_STATUSES.has(assessmentStatus.toUpperCase()) ||
        (assessmentStatus === "" && !latestAssessment);

      if (examRunning && assessmentRunnable && !launched) {
        setLaunched(true);
        const opened = await ensureBrowserVisible();
        if (opened) {
          onExamStart?.();
        } else {
          setLaunched(false);
        }
      }
    } catch (e) {
      console.log("Wait screen status check failed", e);
    } finally {
      setChecking(false);
    }
  }, [examId, assessmentId, accessToken, launched, ensureBrowserVisible, onExamStart, cleanupWaitingState]);

  useEffect(() => {
    checkExamStatus();
    const poll = setInterval(checkExamStatus, 3000);
    return () => clearInterval(poll);
  }, [checkExamStatus]);

  const merged = useMemo(
    () => ({
      ...exam,
      ...assessment,
      ...liveExam,
      ...liveAssessment,
    }),
    [exam, assessment, liveExam, liveAssessment]
  );

  const examName = merged.name || "Upcoming Exam";
  const dateLabel = merged.date || "--";
  const startLabel = merged.starttime || merged.start_time || "--:--";
  const assessmentStatus = liveAssessment?.status || assessment?.status || merged.status || "-";
  const examStatus = liveExam?.status || merged.examstatus || merged.exam_status || "-";

  const startStr =
    merged.date && (merged.starttime || merged.start_time)
      ? `${merged.date}T${merged.starttime || merged.start_time}:00`
      : null;

  const startTime = startStr ? new Date(startStr) : null;
  const diffMs = startTime ? startTime - now : 0;
  const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
  const mins = Math.floor(diffSecs / 60);
  const secs = diffSecs % 60;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#0f1117" }}>
      <div
        style={{
          height: 56,
          background: "#1a1d27",
          borderBottom: "1px solid #2e3347",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>👁️</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#e8eaf0" }}>3rdEyeZ360</span>
        </div>
        <LogoutButton onLogout={onLogout} />
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 520, width: "100%" }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>🕒</div>

          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#e8eaf0" }}>
            Waiting for Exam to Begin
          </h2>

          <p style={{ color: "#8b90a0", fontSize: 14, marginBottom: 24 }}>
            If the exam has not started, this waiting screen stays visible. Once the exam starts,
            the secure browser opens automatically.
          </p>

          <div
            style={{
              background: "#1a1d27",
              border: "1px solid #2e3347",
              borderRadius: 16,
              padding: 32,
              marginBottom: 24,
              boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, color: "#e8eaf0", marginBottom: 8 }}>
              {examName}
            </div>

            <div style={{ fontSize: 13, color: "#8b90a0", marginBottom: 18 }}>{dateLabel}</div>

            <div style={{ fontSize: 13, color: "#8b90a0", marginBottom: 8 }}>Exam starts at</div>

            <div style={{ fontSize: 28, fontWeight: 700, color: "#4f8ef7" }}>{startLabel}</div>

            {diffSecs > 0 && (
              <div style={{ fontSize: 13, color: "#8b90a0", marginTop: 8 }}>
                {mins}m {String(secs).padStart(2, "0")}s remaining
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 10,
                textAlign: "left",
                marginTop: 20,
              }}
            >
              <div style={{ background: "#22263a", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: "#8b90a0", marginBottom: 4 }}>Exam status</div>
                <div style={{ fontSize: 13, color: "#e8eaf0", fontWeight: 600 }}>{examStatus}</div>
              </div>

              <div style={{ background: "#22263a", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: "#8b90a0", marginBottom: 4 }}>Assessment status</div>
                <div style={{ fontSize: 13, color: "#e8eaf0", fontWeight: 600 }}>{assessmentStatus}</div>
              </div>
            </div>

            {checking && (
              <div style={{ fontSize: 12, color: "#8b90a0", marginTop: 14 }}>
                Checking live exam status...
              </div>
            )}
          </div>

          <div
            style={{
              background: "#0f2a1a",
              border: "1px solid #34c97a",
              borderRadius: 10,
              padding: "12px 16px",
              fontSize: 13,
              color: "#34c97a",
            }}
          >
            Stay visible on camera and wait for the exam to go live.
          </div>
        </div>
      </div>
    </div>
  );
}