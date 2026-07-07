import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import useAuthStore from "../../store/authStore";

const API = "http://localhost:3000";
const POLL_INTERVAL = 6000;

function firstValue(...values) {
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
  return [
    "REENTRYAPPROVED",
    "REENTRY_APPROVED",
    "LATEENTRYAPPROVED",
    "LATEENTRY_APPROVED",
  ].includes(s);
}

function isPendingRequestStatus(status) {
  const s = toUpper(status);
  return [
    "REENTRYREQUESTED",
    "REENTRY_REQUESTED",
    "LATEENTRYREQUESTED",
    "LATEENTRY_REQUESTED",
    "PENDING",
  ].includes(s);
}

function isRejectedStatus(status) {
  const s = toUpper(status);
  return [
    "REENTRYREJECTED",
    "REENTRY_REJECTED",
    "LATEENTRYREJECTED",
    "LATEENTRY_REJECTED",
    "REJECTED",
  ].includes(s);
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

  if (assessmentStatus === "COMPLETED") {
    return { mode: "completed", cta: "Completed", disabled: true };
  }

  if (assessmentStatus === "TERMINATED") {
    return { mode: "terminated", cta: "Terminated", disabled: true };
  }

  if (assessmentStatus === "LOCKED") {
    return { mode: "locked", cta: "Locked", disabled: true };
  }

  if (isRejectedStatus(assessmentStatus)) {
    return {
      mode: "rejected",
      cta: "Permission Declined",
      disabled: true,
      helper: "Your request was declined by the examiner.",
    };
  }

  if (pendingRequest || isPendingRequestStatus(assessmentStatus)) {
    return {
      mode: "pending-request",
      cta: "Request Pending",
      disabled: true,
      helper: "Your request is pending examiner approval.",
    };
  }

  if (isApprovedStatus(assessmentStatus)) {
    return {
      mode: "enter",
      cta: "Enter Exam Hall",
      disabled: false,
      helper: "Permission granted. Continue to precheck and enter the exam.",
    };
  }

  if (["ACTIVE", "PAUSED"].includes(assessmentStatus)) {
    return {
      mode: "enter",
      cta: examRunning ? "Resume Exam" : "Enter Exam Hall",
      disabled: false,
      helper: "Your exam session is available.",
    };
  }

  if (["ASSIGNED", "AVAILABLE", "READY"].includes(assessmentStatus)) {
    if (examRunning) {
      return {
        mode: "request",
        cta: "Request Permission",
        disabled: false,
        helper: "The exam is already running. You must request permission before entry.",
      };
    }

    return {
      mode: "enter",
      cta: "Enter Exam Hall",
      disabled: false,
      helper: "You may enter early, complete precheck, read instructions, and wait inside the hall.",
    };
  }

  return {
    mode: "waiting",
    cta: "Not Available",
    disabled: true,
    helper: "This assessment is not available right now.",
  };
}

function getStatusChip(status, examStatus, pendingRequest) {
  const s = toUpper(status);
  const e = toUpper(examStatus);

  if (s === "COMPLETED") return { label: "Completed", bg: "#0f2a1a", color: "#34c97a" };
  if (s === "TERMINATED") return { label: "Terminated", bg: "#2a1010", color: "#f75f5f" };
  if (s === "LOCKED") return { label: "Locked", bg: "#2a1010", color: "#f75f5f" };
  if (pendingRequest || isPendingRequestStatus(s)) {
    return { label: "Permission Requested", bg: "#2a2010", color: "#f5a623" };
  }
  if (isApprovedStatus(s)) {
    return { label: "Permission Approved", bg: "#0f2a1a", color: "#34c97a" };
  }
  if (isRejectedStatus(s)) {
    return { label: "Permission Declined", bg: "#2a1010", color: "#f75f5f" };
  }
  if (e === "RUNNING" && ["ASSIGNED", "AVAILABLE", "READY"].includes(s)) {
    return { label: "Late Entry Required", bg: "#10243a", color: "#4f8ef7" };
  }
  if (["ASSIGNED", "AVAILABLE", "READY"].includes(s)) {
    return { label: "Assigned", bg: "#22263a", color: "#c8cad0" };
  }
  if (s === "ACTIVE") return { label: "Active", bg: "#0f2a1a", color: "#34c97a" };
  if (s === "PAUSED") return { label: "Paused", bg: "#2a2010", color: "#f5a623" };

  return { label: status || "Unknown", bg: "#22263a", color: "#c8cad0" };
}

function LogoutButton({ onLogout }) {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);

    try {
      if (typeof onLogout === "function") {
        await onLogout();
        return;
      }

      const { refreshToken, clearAuth } = useAuthStore.getState();

      if (refreshToken) {
        try {
          await axios.post(`${API}/api/auth/logout`, { refreshtoken: refreshToken });
        } catch (e) {
          console.log("Logout API failed, clearing local session anyway", e);
        }
      }

      clearAuth?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="btn btn-ghost"
      style={{ padding: "8px 14px", fontSize: 12 }}
    >
      {loading ? "Signing out..." : "Logout"}
    </button>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div
      style={{
        background: "#1a1d27",
        border: "1px solid #2e3347",
        borderRadius: 14,
        padding: 18,
      }}
    >
      <div style={{ fontSize: 12, color: "#8b90a0", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function RequestModal({
  open,
  exam,
  reason,
  onChangeReason,
  onClose,
  onSubmit,
  submitting,
  submitError,
}) {
  if (!open || !exam) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#171b25",
          border: "1px solid #2e3347",
          borderRadius: 16,
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "18px 20px", borderBottom: "1px solid #2e3347" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#e8eaf0", marginBottom: 6 }}>
            Request Permission
          </div>
          <div style={{ fontSize: 13, color: "#8b90a0", lineHeight: 1.6 }}>
            The exam has already started for <span style={{ color: "#c8cad0" }}>{exam.name}</span>.
            Enter your reason to request permission from the examiner.
          </div>
        </div>

        <div style={{ padding: 20 }}>
          <label style={{ display: "block", fontSize: 12, color: "#8b90a0", marginBottom: 8 }}>
            Reason
          </label>

          <textarea
            value={reason}
            onChange={(e) => onChangeReason(e.target.value)}
            placeholder="Example: I joined late due to a network issue."
            rows={5}
            style={{
              width: "100%",
              resize: "vertical",
              minHeight: 120,
              background: "#22263a",
              border: "1px solid #343a51",
              borderRadius: 12,
              color: "#e8eaf0",
              padding: 14,
              fontSize: 14,
              outline: "none",
            }}
          />

          {submitError ? (
            <div
              style={{
                marginTop: 12,
                background: "#2a1010",
                border: "1px solid #f75f5f",
                color: "#f3c2c2",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 13,
              }}
            >
              {submitError}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            padding: "16px 20px",
            borderTop: "1px solid #2e3347",
          }}
        >
          <button
            onClick={onClose}
            disabled={submitting}
            className="btn btn-ghost"
            style={{ padding: "10px 16px", fontSize: 13 }}
          >
            Cancel
          </button>

          <button
            onClick={onSubmit}
            disabled={submitting || !reason.trim()}
            className="btn btn-primary"
            style={{
              padding: "10px 16px",
              fontSize: 13,
              opacity: submitting || !reason.trim() ? 0.7 : 1,
            }}
          >
            {submitting ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CandidateDashboard({ onEnterExam, onLogout, onNoAssessments }) {
  const { user, accessToken } = useAuthStore();

  const [assessments, setAssessments] = useState([]);
  const [pendingRequestsByAssessment, setPendingRequestsByAssessment] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedExamForRequest, setSelectedExamForRequest] = useState(null);
  const [requestReason, setRequestReason] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [submitRequestError, setSubmitRequestError] = useState("");

  const firstLoadResolvedRef = useRef(false);
  const redirectedForEmptyRef = useRef(false);

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken]
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

        const rows = Array.isArray(res.data)
          ? res.data.map(normalizeItem).filter(Boolean).filter((item) => item.assessmentid || item.examid)
          : [];

        if (rows.length === 0) {
          setAssessments([]);
          setPendingRequestsByAssessment({});
          setLastUpdated(new Date());
          setLoading(false);
          setRefreshing(false);

          if (!redirectedForEmptyRef.current) {
            redirectedForEmptyRef.current = true;
            await onNoAssessments?.();
          }
          return;
        }

        redirectedForEmptyRef.current = false;
        setAssessments(rows);

        setPendingRequestsByAssessment((prev) => {
          const next = {};

          for (const item of rows) {
            const existing = prev[item.assessmentid];

            if (existing && isPendingRequestStatus(existing.status)) {
              next[item.assessmentid] = existing;
              continue;
            }

            if (isPendingRequestStatus(item.status)) {
              next[item.assessmentid] = normalizeRequest({
                requestid: `derived-${item.assessmentid}`,
                assessmentid: item.assessmentid,
                examid: item.examid,
                candidateid: item.candidateid ?? user?.userid ?? user?.user_id ?? null,
                type: getRequestType(item),
                status: "PENDING",
                reason: "",
              });
            }
          }

          return next;
        });

        setLastUpdated(new Date());
      } catch (e) {
        console.error("load candidate assessments", e);
        if (!silent) {
          setError(formatApiError(e, "Failed to load your assessments."));
        }
      } finally {
        firstLoadResolvedRef.current = true;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken, headers, onNoAssessments, user]
  );

  useEffect(() => {
    fetchAssessments(false);
  }, [fetchAssessments]);

  useEffect(() => {
    const poll = setInterval(() => fetchAssessments(true), POLL_INTERVAL);
    return () => clearInterval(poll);
  }, [fetchAssessments]);

  const allottedCount = assessments.length;

  const completedCount = assessments.filter(
    (a) => toUpper(a.status) === "COMPLETED"
  ).length;

  const activeCount = assessments.filter((a) => {
    const pending = pendingRequestsByAssessment[a.assessmentid];
    const mode = getCardState(a, pending).mode;
    return mode === "enter";
  }).length;

  const pendingCount = assessments.filter((a) => {
    const pending = pendingRequestsByAssessment[a.assessmentid];
    return !!pending || isPendingRequestStatus(a.status);
  }).length;

  const openRequestModal = (exam) => {
    setSelectedExamForRequest(exam);
    setRequestReason("");
    setSubmitRequestError("");
    setRequestModalOpen(true);
  };

  const closeRequestModal = () => {
    if (submittingRequest) return;
    setRequestModalOpen(false);
    setSelectedExamForRequest(null);
    setRequestReason("");
    setSubmitRequestError("");
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

    try {
      const requestType = getRequestType(selectedExamForRequest);

      const payload = {
        assessmentid: selectedExamForRequest.assessmentid,
        examid: selectedExamForRequest.examid,
        candidateid:
          selectedExamForRequest.candidateid ?? user?.userid ?? user?.user_id ?? null,
        type: requestType,
        reason,
      };

      const res = await axios.post(`${API}/api/requests`, payload, { headers });
      const createdRequest = normalizeRequest(res.data);

      setPendingRequestsByAssessment((prev) => ({
        ...prev,
        [selectedExamForRequest.assessmentid]:
          createdRequest ||
          normalizeRequest({
            requestid: `created-${selectedExamForRequest.assessmentid}`,
            assessmentid: selectedExamForRequest.assessmentid,
            examid: selectedExamForRequest.examid,
            candidateid:
              selectedExamForRequest.candidateid ?? user?.userid ?? user?.user_id ?? null,
            type: requestType,
            status: "PENDING",
            reason,
          }),
      }));

      await fetchAssessments(true);
      closeRequestModal();
    } catch (e) {
      setSubmitRequestError(formatApiError(e, "Failed to submit permission request."));
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
          background: "#0f1117",
          color: "#8b90a0",
          fontSize: 14,
        }}
      >
        Loading your assessments...
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#0f1117",
        overflow: "hidden",
      }}
    >
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
          <span style={{ fontSize: 12, color: "#8b90a0" }}>Candidate Dashboard</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "#8b90a0" }}>{user?.name}</span>
          <LogoutButton onLogout={onLogout} />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 24 }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#e8eaf0" }}>
            Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h2>
          <p style={{ fontSize: 14, color: "#8b90a0", margin: 0 }}>
            Enter before the exam starts to complete precheck and wait inside the hall. If you miss
            the start, request permission from the examiner.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            marginBottom: 28,
          }}
        >
          <StatCard label="Assessments Allotted" value={allottedCount} color="#4f8ef7" />
          <StatCard label="Ready to Enter" value={activeCount} color="#34c97a" />
          <StatCard label="Pending Requests" value={pendingCount} color="#f5a623" />
          <StatCard label="Completed" value={completedCount} color="#8b90a0" />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#e8eaf0", margin: 0 }}>
            Your Assessments
          </h3>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {lastUpdated ? (
              <span style={{ fontSize: 11, color: "#555a6e" }}>
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            ) : null}

            {refreshing ? (
              <span style={{ fontSize: 11, color: "#4f8ef7" }}>Refreshing...</span>
            ) : null}

            <button
              onClick={() => fetchAssessments(false)}
              disabled={loading || refreshing}
              className="btn btn-ghost"
              style={{ padding: "7px 14px", fontSize: 12 }}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        {error ? (
          <div
            style={{
              background: "#2a1010",
              border: "1px solid #f75f5f",
              color: "#f3c2c2",
              borderRadius: 12,
              padding: 16,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        ) : assessments.length === 0 ? (
          <div
            style={{
              background: "#161a24",
              border: "1px solid #2a3041",
              borderRadius: 12,
              padding: 18,
              color: "#9ea4b5",
              fontSize: 14,
            }}
          >
            No assessments available right now.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 16,
              alignItems: "start",
            }}
          >
            {assessments.map((exam) => {
              const pendingRequest = pendingRequestsByAssessment[exam.assessmentid] ?? null;
              const chip = getStatusChip(exam.status, exam.examstatus, pendingRequest);
              const cardState = getCardState(exam, pendingRequest);
              const enterable = cardState.mode === "enter";
              const runningNow = isExamRunningStatus(exam.examstatus);

              return (
                <div
                  key={exam.assessmentid ?? exam.examid}
                  style={{
                    background: "#1a1d27",
                    border: `1px solid ${enterable ? "#2a4060" : "#2e3347"}`,
                    borderRadius: 16,
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    minHeight: 0,
                    boxShadow: enterable
                      ? "0 0 0 1px #4f8ef744, 0 10px 30px rgba(0,0,0,0.22)"
                      : "0 10px 30px rgba(0,0,0,0.18)",
                    transition: "border-color 0.3s, box-shadow 0.3s",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 17,
                          fontWeight: 700,
                          color: "#e8eaf0",
                          marginBottom: 6,
                        }}
                      >
                        {exam.name}
                      </div>
                      <div style={{ fontSize: 12, color: "#8b90a0", lineHeight: 1.6 }}>
                        {exam.date} • {exam.starttime} - {exam.endtime}
                      </div>
                    </div>

                    <span
                      style={{
                        background: chip.bg,
                        color: chip.color,
                        padding: "4px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {chip.label}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      color: exam.description ? "#c8cad0" : "#8b90a0",
                      lineHeight: 1.6,
                      minHeight: 40,
                    }}
                  >
                    {exam.description || "No additional description provided for this assessment."}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div style={{ background: "#22263a", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontSize: 11, color: "#8b90a0", marginBottom: 4 }}>Duration</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#e8eaf0" }}>
                        {exam.durationminutes} mins
                      </div>
                    </div>

                    <div style={{ background: "#22263a", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontSize: 11, color: "#8b90a0", marginBottom: 4 }}>
                        Allowed Sites
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#e8eaf0" }}>
                        {exam.allowedwebsites.length}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#22263a",
                      borderRadius: 10,
                      padding: "10px 12px",
                      fontSize: 12,
                      color: "#8b90a0",
                      lineHeight: 1.8,
                    }}
                  >
                    Assessment ID <span style={{ color: "#c8cad0" }}>{exam.assessmentid ?? "—"}</span>
                    <br />
                    Assessment Status{" "}
                    <span style={{ color: chip.color, fontWeight: 600 }}>{exam.status || "UNKNOWN"}</span>
                    <br />
                    Exam Status{" "}
                    <span
                      style={{
                        color: runningNow ? "#34c97a" : "#c8cad0",
                        fontWeight: runningNow ? 700 : 400,
                      }}
                    >
                      {exam.examstatus || "UNKNOWN"}
                    </span>
                    {pendingRequest ? (
                      <>
                        <br />
                        Request Status <span style={{ color: "#f5a623", fontWeight: 700 }}>PENDING</span>
                      </>
                    ) : null}
                  </div>

                  {cardState.helper ? (
                    <div
                      style={{
                        background: "#161a24",
                        border: "1px solid #2a3041",
                        borderRadius: 10,
                        padding: "10px 12px",
                        fontSize: 12,
                        color: "#9ea4b5",
                        lineHeight: 1.6,
                      }}
                    >
                      {cardState.helper}
                    </div>
                  ) : null}

                  {cardState.mode === "enter" ? (
                    <button
                      onClick={() => onEnterExam?.(exam)}
                      className="btn btn-primary"
                      style={{ width: "100%", padding: "12px 0", fontSize: 14 }}
                    >
                      {cardState.cta}
                    </button>
                  ) : cardState.mode === "request" ? (
                    <button
                      onClick={() => openRequestModal(exam)}
                      className="btn btn-primary"
                      style={{ width: "100%", padding: "12px 0", fontSize: 14 }}
                    >
                      {cardState.cta}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="btn btn-ghost"
                      style={{
                        width: "100%",
                        padding: "12px 0",
                        fontSize: 13,
                        opacity: 0.5,
                        cursor: "not-allowed",
                      }}
                    >
                      {cardState.cta}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
      />
    </div>
  );
}