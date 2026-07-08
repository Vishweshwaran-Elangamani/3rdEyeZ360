import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import axios from "axios";
import useAuthStore from "../../store/authStore";

const API = "http://localhost:3000";
const POLL_INTERVAL = 3000;

const TERMINAL_ASSESSMENT_STATUSES = new Set(["TERMINATED", "LOCKED", "COMPLETED"]);
const TERMINAL_EXAM_STATUSES = new Set(["COMPLETED", "TERMINATED"]);

const APPROVED_ENTRY_STATUSES = new Set([
  "ASSIGNED",
  "READY",
  "ACTIVE",
  "PAUSED",
  "REENTRYAPPROVED",
  "REENTRY_APPROVED",
  "LATEENTRYAPPROVED",
  "LATEENTRY_APPROVED",
]);

const PENDING_ENTRY_STATUSES = new Set([
  "REENTRYREQUESTED",
  "REENTRY_REQUESTED",
  "LATEENTRYREQUESTED",
  "LATEENTRY_REQUESTED",
  "PENDING",
]);

const REJECTED_ENTRY_STATUSES = new Set([
  "REENTRYREJECTED",
  "REENTRY_REJECTED",
  "LATEENTRYREJECTED",
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

function toUpper(value) {
  return String(value ?? "").trim().toUpperCase();
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

  const examStatus = toUpper(
    pick(raw.examstatus, raw.exam_status, raw.examStatus, raw.runtime_status, raw.runtimestatus, raw.status)
  );

  return {
    ...raw,
    examid: pick(raw.examid, raw.exam_id),
    assessmentid: pick(raw.assessmentid, raw.assessment_id),
    candidateid: pick(raw.candidateid, raw.candidate_id),
    name: pick(raw.name, raw.examname, raw.exam_name, "Exam"),
    date: pick(raw.date, raw.examdate, raw.exam_date, "--"),
    starttime: pick(raw.starttime, raw.start_time, raw.examstarttime, raw.exam_start_time, "--:--"),
    endtime: pick(raw.endtime, raw.end_time, raw.examendtime, raw.exam_end_time, "--:--"),
    durationminutes: Number(pick(raw.durationminutes, raw.duration_minutes, 0)) || 0,
    allowedwebsites: normalizeSites(raw.allowedwebsites, raw.allowed_websites),
    allowedapplications: normalizeSites(raw.allowedapplications, raw.allowed_applications),
    status: examStatus,
    examstatus: examStatus,
  };
}

function normalizeAssessment(raw) {
  if (!raw) return null;

  const assessmentStatus = toUpper(
    pick(raw.assessmentstatus, raw.assessment_status, raw.assessmentStatus, raw.status, raw.finalstatus, raw.final_status)
  );

  const finalStatus = toUpper(pick(raw.finalstatus, raw.final_status));

  const examStatus = toUpper(
    pick(raw.examstatus, raw.exam_status, raw.examStatus, raw.status_exam, raw.runtime_status, raw.runtimestatus)
  );

  return {
    ...raw,
    assessmentid: pick(raw.assessmentid, raw.assessment_id),
    examid: pick(raw.examid, raw.exam_id),
    candidateid: pick(raw.candidateid, raw.candidate_id),
    name: pick(raw.name, raw.examname, raw.exam_name, "Upcoming Exam"),
    date: pick(raw.date, raw.examdate, raw.exam_date, "--"),
    starttime: pick(raw.starttime, raw.start_time, raw.examstarttime, raw.exam_start_time, "--:--"),
    endtime: pick(raw.endtime, raw.end_time, raw.examendtime, raw.exam_end_time, "--:--"),
    durationminutes: Number(pick(raw.durationminutes, raw.duration_minutes, 0)) || 0,
    allowedwebsites: normalizeSites(raw.allowedwebsites, raw.allowed_websites),
    allowedapplications: normalizeSites(raw.allowedapplications, raw.allowed_applications),
    status: assessmentStatus,
    assessmentstatus: assessmentStatus,
    finalstatus: finalStatus,
    examstatus: examStatus,
  };
}

function getExamStatus(exam) {
  return toUpper(pick(exam?.examstatus, exam?.status));
}

function getAssessmentStatus(assessment) {
  return toUpper(pick(assessment?.assessmentstatus, assessment?.status));
}

function getFinalStatus(assessment) {
  return toUpper(pick(assessment?.finalstatus));
}

function formatDateTime(date, time) {
  if (!date && !time) return "--";
  try {
    return new Date(`${date}T${time}:00`).toLocaleString();
  } catch {
    return `${date || "--"} ${time || "--:--"}`;
  }
}

function safeHost(url) {
  try {
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function statusChip(status) {
  const value = toUpper(status);
  if (APPROVED_ENTRY_STATUSES.has(value)) return { label: value, bg: "#0f2a1a", color: "#34c97a" };
  if (PENDING_ENTRY_STATUSES.has(value)) return { label: value, bg: "#2a2010", color: "#f5a623" };
  if (REJECTED_ENTRY_STATUSES.has(value)) return { label: value, bg: "#2a1010", color: "#f75f5f" };
  if (value === "RUNNING") return { label: value, bg: "#10243a", color: "#4f8ef7" };
  if (TERMINAL_ASSESSMENT_STATUSES.has(value) || TERMINAL_EXAM_STATUSES.has(value)) {
    return { label: value, bg: "#2a1010", color: "#f75f5f" };
  }
  return { label: value || "-", bg: "#22263a", color: "#c8cad0" };
}

function CheckItem({ label, value }) {
  const pill = statusChip(value);
  return (
    <div
      style={{
        background: "#1a1d27",
        border: "1px solid #2e3347",
        borderRadius: 12,
        padding: "12px 14px",
      }}
    >
      <div style={{ fontSize: 11, color: "#8b90a0", marginBottom: 6 }}>{label}</div>
      <span
        style={{
          background: pill.bg,
          color: pill.color,
          padding: "3px 10px",
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {pill.label}
      </span>
    </div>
  );
}

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
    <button onClick={handle} disabled={loading} className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 12 }}>
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

  const [now, setNow] = useState(new Date());
  const [checking, setChecking] = useState(true);
  const [liveExam, setLiveExam] = useState(normalizeExam(exam));
  const [liveAssessment, setLiveAssessment] = useState(normalizeAssessment(assessment));
  const [returning, setReturning] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [browserError, setBrowserError] = useState("");

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

  const mergedExamName = pick(liveAssessment?.name, liveExam?.name, assessment?.name, exam?.name, "Exam");
  const mergedDate = pick(liveAssessment?.date, liveExam?.date, assessment?.date, exam?.date, "--");
  const mergedStart = pick(liveAssessment?.starttime, liveExam?.starttime, assessment?.starttime, exam?.starttime, "--:--");
  const mergedEnd = pick(liveAssessment?.endtime, liveExam?.endtime, assessment?.endtime, exam?.endtime, "--:--");
  const mergedDuration =
    Number(pick(liveAssessment?.durationminutes, liveExam?.durationminutes, assessment?.durationminutes, exam?.durationminutes, 0)) || 0;

  const currentExamStatus = getExamStatus(liveExam || exam);
  const currentAssessmentStatus = getAssessmentStatus(liveAssessment || assessment);
  const currentFinalStatus = getFinalStatus(liveAssessment || assessment);

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
    if (!window.electronAPI) {
      setBrowserError("Electron API is not available.");
      return false;
    }

    if (!allowedSites.length) {
      setBrowserError("No allowed websites were found for this exam.");
      console.log("ensureBrowserVisible aborted: no allowed websites found");
      return false;
    }

    setBrowserError("");

    try {
      await window.electronAPI?.enableLockdown?.();
      await window.electronAPI?.setClosable?.(false);
      await window.electronAPI?.openBrowser?.({ allowedWebsites: allowedSites });
      await window.electronAPI?.navigateBrowser?.(allowedSites[0]);
      await window.electronAPI?.showBrowser?.();
      await window.electronAPI?.restoreBrowser?.();
      await window.electronAPI?.focusBrowser?.();
      return true;
    } catch (error) {
      console.log("ensureBrowserVisible failed", error);
      setBrowserError(error?.message || "Failed to launch the exam browser.");
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
        axios.get(`${API}/api/exams/${examId}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        assessmentId
          ? axios.get(`${API}/api/assessments/${assessmentId}`, { headers: { Authorization: `Bearer ${accessToken}` } })
          : Promise.resolve({ data: null }),
      ]);

      const latestExam = normalizeExam(examRes?.data);
      const latestAssessment = normalizeAssessment(assessmentRes?.data);

      if (latestExam) setLiveExam(latestExam);
      if (latestAssessment) setLiveAssessment(latestAssessment);

      const examStatus = getExamStatus(latestExam);
      const assessmentStatus = getAssessmentStatus(latestAssessment);
      const finalStatus = getFinalStatus(latestAssessment);

      const assessmentTerminal =
        TERMINAL_ASSESSMENT_STATUSES.has(assessmentStatus) || TERMINAL_ASSESSMENT_STATUSES.has(finalStatus);
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
        setActionMsg("Your permission request was declined by the examiner.");
        await returnToDashboardSafe();
        return;
      }

      if (examRunning && approvedToEnter && !launchedRef.current && !launchingRef.current) {
        launchingRef.current = true;
        setActionMsg("Permission granted. Launching the exam workspace.");
        const opened = await ensureBrowserVisible();
        if (opened) {
          launchedRef.current = true;
          launchingRef.current = false;
          onExamStart?.();
          return;
        }
        launchingRef.current = false;
        setActionMsg("Permission granted, but browser launch failed.");
        return;
      }

      if (examRunning && pendingApproval) {
        setActionMsg("Your request is pending examiner approval.");
        return;
      }

      if (examRunning && !approvedToEnter && !pendingApproval) {
        setActionMsg("The exam is running, but your entry is not approved yet.");
        return;
      }

      if (!examRunning && approvedToEnter) {
        setActionMsg("Permission approved. The exam has not started yet.");
        return;
      }

      setActionMsg("Stay visible on camera and wait for the exam to go live.");
    } catch (error) {
      console.log("Wait screen status check failed", error);
      setActionMsg(error?.response?.data?.detail || error?.message || "Failed to check exam status.");
    } finally {
      setChecking(false);
    }
  }, [
    examId,
    assessmentId,
    accessToken,
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

  useEffect(() => {
    return () => {
      if (!launchedRef.current) window.electronAPI?.closeBrowser?.();
    };
  }, []);

  const examRunning = currentExamStatus === "RUNNING";
  const approvedToEnter = APPROVED_ENTRY_STATUSES.has(currentAssessmentStatus);
  const pendingApproval = PENDING_ENTRY_STATUSES.has(currentAssessmentStatus);
  const rejectedRequest = REJECTED_ENTRY_STATUSES.has(currentAssessmentStatus);

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", color: "#e8eaf0", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          height: 56,
          background: "#1a1d27",
          borderBottom: "1px solid #2e3347",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 800, fontSize: 16 }}>3rdEyeZ360</span>
        <span style={{ color: "#8b90a0", fontSize: 12 }}>Candidate Waiting Hall</span>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          {typeof onReturnToDashboard === "function" ? (
            <button
              onClick={returnToDashboardSafe}
              disabled={returning}
              className="btn btn-ghost"
              style={{ padding: "8px 14px", fontSize: 12 }}
            >
              {returning ? "Returning..." : "Back to Dashboard"}
            </button>
          ) : null}
          {onLogout ? <LogoutButton onLogout={onLogout} /> : null}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div
            style={{
              background: "#1a1d27",
              border: "1px solid #2e3347",
              borderRadius: 16,
              padding: 24,
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{mergedExamName}</div>
            <div style={{ color: "#8b90a0", fontSize: 13, lineHeight: 1.7 }}>
              Please remain available while the system checks your exam and assessment state. When permission is granted
              and the exam is running, the secured exam browser will open automatically.
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
                marginTop: 20,
              }}
            >
              <div style={{ background: "#22263a", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: "#8b90a0", marginBottom: 4 }}>Exam ID</div>
                <div style={{ fontSize: 13, color: "#e8eaf0", fontWeight: 600 }}>{examId || "-"}</div>
              </div>

              <div style={{ background: "#22263a", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: "#8b90a0", marginBottom: 4 }}>Assessment ID</div>
                <div style={{ fontSize: 13, color: "#e8eaf0", fontWeight: 600 }}>{assessmentId || "-"}</div>
              </div>

              <div style={{ background: "#22263a", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: "#8b90a0", marginBottom: 4 }}>Scheduled start</div>
                <div style={{ fontSize: 13, color: "#e8eaf0", fontWeight: 600 }}>{formatDateTime(mergedDate, mergedStart)}</div>
              </div>

              <div style={{ background: "#22263a", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: "#8b90a0", marginBottom: 4 }}>Duration</div>
                <div style={{ fontSize: 13, color: "#e8eaf0", fontWeight: 600 }}>{mergedDuration} minutes</div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <CheckItem label="Assessment status" value={currentAssessmentStatus || "-"} />
            <CheckItem label="Exam status" value={currentExamStatus || "-"} />
            <CheckItem label="Final status" value={currentFinalStatus || "-"} />
            <CheckItem label="Current time" value={now.toLocaleTimeString()} />
          </div>

          <div
            style={{
              background: "#1a1d27",
              border: "1px solid #2e3347",
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Allowed websites</div>

            {allowedSites.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {allowedSites.map((site, index) => (
                  <div
                    key={`${site}-${index}`}
                    style={{
                      background: "#10243a",
                      border: "1px solid #2f4e77",
                      color: "#8fc2ff",
                      borderRadius: 20,
                      padding: "6px 12px",
                      fontSize: 12,
                    }}
                    title={site}
                  >
                    {safeHost(site)}
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  background: "#2a1010",
                  border: "1px solid #f75f5f",
                  borderRadius: 10,
                  padding: "12px 14px",
                  fontSize: 13,
                  color: "#f3c2c2",
                }}
              >
                No allowed websites are currently available in the payload.
              </div>
            )}
          </div>

          <div
            style={{
              background: "#1a1d27",
              border: "1px solid #2e3347",
              borderRadius: 16,
              padding: 20,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Live status</div>

            {checking ? <div style={{ fontSize: 12, color: "#8b90a0", marginBottom: 14 }}>Checking live exam status...</div> : null}

            {approvedToEnter && examRunning ? (
              <div
                style={{
                  background: "#0f2a1a",
                  border: "1px solid #34c97a",
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontSize: 13,
                  color: "#34c97a",
                  marginBottom: actionMsg ? 12 : 0,
                }}
              >
                Permission granted. Launching the exam workspace.
              </div>
            ) : null}

            {pendingApproval ? (
              <div
                style={{
                  background: "#2a2010",
                  border: "1px solid #f5a623",
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontSize: 13,
                  color: "#f5a623",
                  marginBottom: actionMsg ? 12 : 0,
                }}
              >
                Your request is pending examiner approval.
              </div>
            ) : null}

            {rejectedRequest ? (
              <div
                style={{
                  background: "#2a1010",
                  border: "1px solid #f75f5f",
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontSize: 13,
                  color: "#f75f5f",
                  marginBottom: actionMsg ? 12 : 0,
                }}
              >
                Your permission request was declined by the examiner.
              </div>
            ) : null}

            {!approvedToEnter && examRunning && !pendingApproval && !rejectedRequest ? (
              <div
                style={{
                  background: "#2a1010",
                  border: "1px solid #f75f5f",
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontSize: 13,
                  color: "#f75f5f",
                  marginBottom: actionMsg ? 12 : 0,
                }}
              >
                The exam is running, but your entry is not approved yet.
              </div>
            ) : null}

            {!examRunning && !rejectedRequest ? (
              <div
                style={{
                  background: "#0f2a1a",
                  border: "1px solid #34c97a",
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontSize: 13,
                  color: "#34c97a",
                  marginBottom: actionMsg ? 12 : 0,
                }}
              >
                Stay visible on camera and wait for the exam to go live.
              </div>
            ) : null}

            {actionMsg ? (
              <div style={{ fontSize: 13, color: "#c7ccda", lineHeight: 1.7, marginTop: 4 }}>{actionMsg}</div>
            ) : null}

            {browserError ? (
              <div
                style={{
                  marginTop: 14,
                  background: "#2a1010",
                  border: "1px solid #f75f5f",
                  borderRadius: 10,
                  padding: "12px 14px",
                  fontSize: 13,
                  color: "#f3c2c2",
                  lineHeight: 1.6,
                }}
              >
                {browserError}
              </div>
            ) : null}

            <div
              style={{
                marginTop: 18,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <div style={{ background: "#22263a", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: "#8b90a0", marginBottom: 4 }}>Exam end time</div>
                <div style={{ fontSize: 13, color: "#e8eaf0", fontWeight: 600 }}>{mergedEnd}</div>
              </div>

              <div style={{ background: "#22263a", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: "#8b90a0", marginBottom: 4 }}>Browser readiness</div>
                <div style={{ fontSize: 13, color: "#e8eaf0", fontWeight: 600 }}>
                  {allowedSites.length ? "Ready" : "Missing website config"}
                </div>
              </div>
            </div>

            {typeof onReturnToDashboard === "function" && rejectedRequest ? (
              <div style={{ marginTop: 14 }}>
                <button
                  onClick={returnToDashboardSafe}
                  disabled={returning}
                  className="btn btn-ghost"
                  style={{ padding: "10px 16px", fontSize: 13 }}
                >
                  {returning ? "Returning..." : "Back to Dashboard"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}