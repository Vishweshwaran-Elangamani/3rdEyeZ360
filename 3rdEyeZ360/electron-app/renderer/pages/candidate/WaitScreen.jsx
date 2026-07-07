import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import axios from "axios";
import useAuthStore from "../../store/authStore";

const API = "http://localhost:3000";
const POLL_INTERVAL = 3000;

const TERMINAL_ASSESSMENT_STATUSES = new Set(["TERMINATED", "LOCKED", "COMPLETED"]);
const TERMINAL_EXAM_STATUSES = new Set(["COMPLETED", "TERMINATED"]);
const APPROVED_ENTRY_STATUSES = new Set([
  "ACTIVE",
  "PAUSED",
  "REENTRY_APPROVED",
  "LATEENTRY_APPROVED",
]);
const PENDING_ENTRY_STATUSES = new Set([
  "REENTRY_REQUESTED",
  "LATEENTRY_REQUESTED",
  "PENDING",
]);
const REJECTED_ENTRY_STATUSES = new Set([
  "REENTRY_REJECTED",
  "LATEENTRY_REJECTED",
  "REJECTED",
]);

function pick(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
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
  const status = String(pick(raw.examstatus, raw.exam_status, raw.status) || "").toUpperCase();

  return {
    ...raw,
    examid: pick(raw.examid, raw.exam_id),
    assessmentid: pick(raw.assessmentid, raw.assessment_id),
    candidateid: pick(raw.candidateid, raw.candidate_id),
    name: pick(raw.name, raw.examname, "Exam"),
    date: pick(raw.date, raw.examdate, "--"),
    starttime: pick(raw.starttime, raw.start_time, raw.examstarttime, "--:--"),
    endtime: pick(raw.endtime, raw.end_time, raw.examendtime, "--:--"),
    durationminutes: Number(pick(raw.durationminutes, raw.duration_minutes, 0) || 0),
    allowedwebsites: Array.isArray(pick(raw.allowedwebsites, raw.allowed_websites))
      ? pick(raw.allowedwebsites, raw.allowed_websites)
      : [],
    allowedapplications: Array.isArray(pick(raw.allowedapplications, raw.allowed_applications))
      ? pick(raw.allowedapplications, raw.allowed_applications)
      : [],
    status,
    examstatus: status,
  };
}

function normalizeAssessment(raw) {
  if (!raw) return null;
  const status = String(pick(raw.status, raw.assessmentstatus, raw.assessment_status) || "").toUpperCase();
  const finalstatus = String(pick(raw.finalstatus, raw.final_status) || "").toUpperCase();

  return {
    ...raw,
    assessmentid: pick(raw.assessmentid, raw.assessment_id),
    examid: pick(raw.examid, raw.exam_id),
    candidateid: pick(raw.candidateid, raw.candidate_id),
    allowedwebsites: Array.isArray(pick(raw.allowedwebsites, raw.allowed_websites))
      ? pick(raw.allowedwebsites, raw.allowed_websites)
      : [],
    status,
    finalstatus,
  };
}

function getExamStatus(exam) {
  return String(pick(exam?.examstatus, exam?.exam_status, exam?.status) || "").toUpperCase();
}

function getAssessmentStatus(assessment) {
  return String(pick(assessment?.status, assessment?.assessmentstatus, assessment?.assessment_status) || "").toUpperCase();
}

function getFinalStatus(assessment) {
  return String(pick(assessment?.finalstatus, assessment?.final_status) || "").toUpperCase();
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

function LogoutButton({ onLogout }) {
  const [loading, setLoading] = useState(false);

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
    <button onClick={handleLogout} disabled={loading} className="btn btn-ghost" style={{ padding: "5px 12px", fontSize: 13 }}>
      {loading ? "Signing out..." : "Logout"}
    </button>
  );
}

export default function WaitScreen({
  exam,
  assessment,
  onExamStart,
  onLogout,
  onComplete,
  onReturnToDashboard,
}) {
  const { accessToken } = useAuthStore();

  const [liveExam, setLiveExam] = useState(normalizeExam(exam));
  const [liveAssessment, setLiveAssessment] = useState(normalizeAssessment(assessment));
  const [activeTab, setActiveTab] = useState(0);
  const [checking, setChecking] = useState(true);
  const [now, setNow] = useState(new Date());
  const [returning, setReturning] = useState(false);

  const launchingRef = useRef(false);
  const launchedRef = useRef(false);
  const finishedRef = useRef(false);
  const returningRef = useRef(false);

  useEffect(() => {
    setLiveExam(normalizeExam(exam));
  }, [exam]);

  useEffect(() => {
    setLiveAssessment(normalizeAssessment(assessment));
  }, [assessment]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const examId = pick(liveAssessment?.examid, assessment?.examid, liveExam?.examid, exam?.examid);
  const assessmentId = pick(
    liveAssessment?.assessmentid,
    assessment?.assessmentid,
    liveExam?.assessmentid,
    exam?.assessmentid
  );

  const allowedSites = useMemo(
    () =>
      normalizeSites(
        liveAssessment?.allowedwebsites,
        liveExam?.allowedwebsites,
        assessment?.allowedwebsites,
        exam?.allowedwebsites
      ),
    [assessment, exam, liveAssessment, liveExam]
  );

  useEffect(() => {
    if (activeTab > allowedSites.length - 1) setActiveTab(0);
  }, [allowedSites, activeTab]);

  const merged = useMemo(
    () => ({
      ...(normalizeExam(exam) || {}),
      ...(normalizeAssessment(assessment) || {}),
      ...(liveExam || {}),
      ...(liveAssessment || {}),
    }),
    [exam, assessment, liveExam, liveAssessment]
  );

  const activeUrl = allowedSites[activeTab] || null;

  const finishWaitingFlow = useCallback(async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;

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

    onComplete?.();
  }, [onComplete]);

  const returnToDashboardSafe = useCallback(async () => {
    if (returningRef.current) return;
    returningRef.current = true;
    setReturning(true);

    try {
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

      await onReturnToDashboard?.();
    } finally {
      setReturning(false);
    }
  }, [onReturnToDashboard]);

  const ensureBrowserVisible = useCallback(async () => {
    if (!window.electronAPI) return false;

    try {
      await window.electronAPI?.enableLockdown?.();
      await window.electronAPI?.setClosable?.(false);
      await window.electronAPI?.openBrowser?.({ allowedWebsites: allowedSites });

      if (allowedSites.length > 0) {
        await window.electronAPI?.navigateBrowser?.(allowedSites[0]);
      }

      await window.electronAPI?.showBrowser?.();
      await window.electronAPI?.restoreBrowser?.();
      await window.electronAPI?.focusBrowser?.();
      return true;
    } catch (error) {
      console.log("ensureBrowserVisible failed", error);

      try {
        await window.electronAPI?.closeBrowser?.();
      } catch {}
      try {
        await window.electronAPI?.disableLockdown?.();
      } catch {}
      try {
        await window.electronAPI?.setClosable?.(true);
      } catch {}

      return false;
    }
  }, [allowedSites]);

  const checkExamStatus = useCallback(async () => {
    if (finishedRef.current || returningRef.current) {
      setChecking(false);
      return;
    }

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

      const latestExam = normalizeExam(examRes?.data);
      const latestAssessment = normalizeAssessment(assessmentRes?.data);

      if (latestExam) setLiveExam(latestExam);
      if (latestAssessment) setLiveAssessment(latestAssessment);

      const examStatus = getExamStatus(latestExam || merged);
      const assessmentStatus = getAssessmentStatus(latestAssessment || merged);
      const finalStatus = getFinalStatus(latestAssessment || merged);

      const assessmentTerminal =
        TERMINAL_ASSESSMENT_STATUSES.has(assessmentStatus) ||
        TERMINAL_ASSESSMENT_STATUSES.has(finalStatus);
      const examTerminal = TERMINAL_EXAM_STATUSES.has(examStatus);
      const examRunning = examStatus === "RUNNING";
      const approvedToEnter = APPROVED_ENTRY_STATUSES.has(assessmentStatus);
      const pendingApproval = PENDING_ENTRY_STATUSES.has(assessmentStatus);
      const rejectedRequest = REJECTED_ENTRY_STATUSES.has(assessmentStatus);

      if (assessmentTerminal || examTerminal) {
        await finishWaitingFlow();
        return;
      }

      if (rejectedRequest) {
        await returnToDashboardSafe();
        return;
      }

      if (examRunning && approvedToEnter && !launchedRef.current && !launchingRef.current) {
        launchingRef.current = true;
        const opened = await ensureBrowserVisible();
        if (opened) {
          launchedRef.current = true;
          launchingRef.current = false;
          onExamStart?.();
          return;
        }
        launchingRef.current = false;
      }

      if (examRunning && !approvedToEnter && !pendingApproval) {
        await returnToDashboardSafe();
        return;
      }
    } catch (error) {
      console.log("Wait screen status check failed", error);
    } finally {
      setChecking(false);
    }
  }, [
    examId,
    assessmentId,
    accessToken,
    merged,
    finishWaitingFlow,
    returnToDashboardSafe,
    ensureBrowserVisible,
    onExamStart,
  ]);

  useEffect(() => {
    checkExamStatus();
    const poll = setInterval(checkExamStatus, POLL_INTERVAL);
    return () => clearInterval(poll);
  }, [checkExamStatus]);

  const examName = merged.name || "Upcoming Exam";
  const dateLabel = merged.date || "--";
  const startLabel = merged.starttime || "--:--";

  const currentExamStatus = getExamStatus(liveExam || merged);
  const currentAssessmentStatus = getAssessmentStatus(liveAssessment || merged);
  const examRunning = currentExamStatus === "RUNNING";
  const approvedToEnter = APPROVED_ENTRY_STATUSES.has(currentAssessmentStatus);
  const pendingApproval = PENDING_ENTRY_STATUSES.has(currentAssessmentStatus);
  const rejectedRequest = REJECTED_ENTRY_STATUSES.has(currentAssessmentStatus);

  const startStr = merged.date && merged.starttime ? `${merged.date}T${merged.starttime}:00` : null;
  const startTime = startStr ? new Date(startStr) : null;
  const diffMs = startTime ? startTime.getTime() - now.getTime() : 0;
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
          <span style={{ fontSize: 20 }}>🛡️</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#e8eaf0" }}>3rdEyeZ360</span>
        </div>
        <LogoutButton onLogout={onLogout} />
      </div>

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 18,
          padding: 20,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: "#1a1d27",
            border: "1px solid #2e3347",
            borderRadius: 14,
            padding: 22,
            overflow: "auto",
          }}
        >
          <div style={{ fontSize: 21, fontWeight: 700, color: "#e8eaf0", marginBottom: 8 }}>{examName}</div>
          <div style={{ fontSize: 13, color: "#8b90a0", marginBottom: 16 }}>
            {dateLabel} • {startLabel}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
            <span style={pill(examRunning ? "#0f2a1a" : "#22263a", examRunning ? "#34c97a" : "#c8cad0")}>
              Exam: {currentExamStatus || "-"}
            </span>
            <span
              style={pill(
                approvedToEnter ? "#0f2a1a" : rejectedRequest ? "#2a1010" : "#10243a",
                approvedToEnter ? "#34c97a" : rejectedRequest ? "#f75f5f" : "#4f8ef7"
              )}
            >
              Assessment: {currentAssessmentStatus || "-"}
            </span>
          </div>

          <div
            style={{
              background: "#22263a",
              borderRadius: 12,
              padding: 16,
              marginBottom: 18,
              border: "1px solid #2e3347",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: "#e8eaf0", marginBottom: 8 }}>Current state</div>

            {checking ? (
              <div style={{ color: "#8b90a0", fontSize: 13 }}>Checking latest exam status...</div>
            ) : approvedToEnter && examRunning ? (
              <div style={{ color: "#34c97a", fontSize: 13 }}>
                Entry approved and exam is running. Launching exam workspace...
              </div>
            ) : pendingApproval ? (
              <div style={{ color: "#f5a623", fontSize: 13 }}>
                Your permission request is pending examiner approval.
              </div>
            ) : rejectedRequest ? (
              <div style={{ color: "#f75f5f", fontSize: 13 }}>
                Your permission request was rejected. Returning to dashboard...
              </div>
            ) : examRunning ? (
              <div style={{ color: "#4f8ef7", fontSize: 13 }}>
                Exam is running. Waiting for approval before entry.
              </div>
            ) : (
              <div style={{ color: "#8b90a0", fontSize: 13 }}>
                Waiting for the exam session to become active.
              </div>
            )}
          </div>

          <div
            style={{
              background: "#151925",
              border: "1px solid #2e3347",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: "#e8eaf0", marginBottom: 10 }}>
              Allowed websites
            </div>

            {allowedSites.length === 0 ? (
              <div style={{ color: "#8b90a0", fontSize: 13 }}>No allowed websites configured.</div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  {allowedSites.map((site, index) => (
                    <button
                      key={`${site}-${index}`}
                      onClick={() => setActiveTab(index)}
                      className="btn"
                      style={{
                        padding: "7px 10px",
                        fontSize: 12,
                        borderRadius: 8,
                        background: index === activeTab ? "#4f8ef7" : "#22263a",
                        color: "#fff",
                        border: "1px solid #2e3347",
                      }}
                    >
                      {safeHost(site)}
                    </button>
                  ))}
                </div>

                <div style={{ color: "#8b90a0", fontSize: 12, wordBreak: "break-all" }}>
                  {activeUrl || allowedSites[0]}
                </div>
              </>
            )}
          </div>
        </div>

        <div
          style={{
            background: "#1a1d27",
            border: "1px solid #2e3347",
            borderRadius: 14,
            padding: 22,
            overflow: "auto",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: "#e8eaf0", marginBottom: 14 }}>
            Waiting room
          </div>

          <div
            style={{
              background: "#22263a",
              borderRadius: 12,
              padding: 18,
              border: "1px solid #2e3347",
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 12, color: "#8b90a0", marginBottom: 6 }}>Countdown</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#e8eaf0" }}>
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </div>
          </div>

          <div style={{ fontSize: 13, color: "#8b90a0", lineHeight: 1.7, marginBottom: 18 }}>
            Keep this application open. Once the exam is running and your late-entry approval is valid, the app will move you into the active exam automatically.
          </div>

          <button
            onClick={returnToDashboardSafe}
            disabled={returning}
            className="btn btn-ghost"
            style={{ width: "100%", fontSize: 13, padding: "10px 14px" }}
          >
            {returning ? "Returning..." : "Back to Dashboard"}
          </button>
        </div>
      </div>
    </div>
  );
}