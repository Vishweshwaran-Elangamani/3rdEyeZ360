import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import useAuthStore from "../../store/authStore";
import { useSocket } from "../../hooks/useSocket";
import ChatWindow from "../../components/common/ChatWindow";
import CreateExam from "./CreateExam";
import AssignCandidates from "./AssignCandidates";

const API = "http://localhost:3000";

const STATUS_COLORS = {
  ACTIVE: "#34c97a",
  READY: "#4f8ef7",
  INTERRUPTED: "#f5a623",
  LOCKED: "#f75f5f",
  COMPLETED: "#8b90a0",
  TERMINATED: "#f75f5f",
  ASSIGNED: "#555a6e",
  AVAILABLE: "#7c5ce7",
  PAUSED: "#f5a623",
  REENTRYAPPROVED: "#34c97a",
  REENTRY_APPROVED: "#34c97a",
  LATEENTRYAPPROVED: "#34c97a",
  LATEENTRY_APPROVED: "#34c97a",
  REENTRYREJECTED: "#f75f5f",
  REENTRY_REJECTED: "#f75f5f",
  LATEENTRYREJECTED: "#f75f5f",
  LATEENTRY_REJECTED: "#f75f5f",
  PENDING: "#f5a623",
};

function normalizeExam(exam) {
  if (!exam) return null;
  return {
    ...exam,
    examid: exam.examid ?? exam.exam_id ?? null,
    name: exam.name ?? "Untitled Exam",
    status: exam.status ?? exam.examstatus ?? exam.exam_status ?? "Draft",
    date: exam.date ?? "—",
    starttime: exam.starttime ?? exam.start_time ?? "—",
    endtime: exam.endtime ?? exam.end_time ?? "—",
    durationminutes: exam.durationminutes ?? exam.duration_minutes ?? 0,
  };
}

function normalizeCandidate(c) {
  if (!c) return null;
  return {
    ...c,
    assessmentid: c.assessmentid ?? c.assessment_id ?? null,
    candidateid: c.candidateid ?? c.candidate_id ?? null,
    candidatename: c.candidatename ?? c.candidate_name ?? c.name ?? "Candidate",
    candidateemail: c.candidateemail ?? c.candidate_email ?? "",
    status: c.status ?? "ASSIGNED",
    violationcount: c.violationcount ?? c.violation_count ?? 0,
    warningcount: c.warningcount ?? c.warning_count ?? 0,
    riskscore: c.riskscore ?? c.risk_score ?? 0,
    credibilityscore: c.credibilityscore ?? c.credibility_score ?? 100,
    attendancestatus: c.attendancestatus ?? c.attendance_status ?? "",
  };
}

function normalizeRequest(r) {
  if (!r) return null;
  return {
    ...r,
    requestid: r.requestid ?? r.request_id ?? null,
    assessmentid: r.assessmentid ?? r.assessment_id ?? null,
    examid: r.examid ?? r.exam_id ?? null,
    candidateid: r.candidateid ?? r.candidate_id ?? null,
    candidatename: r.candidatename ?? r.candidate_name ?? r.name ?? null,
    status: String(r.status ?? "").toUpperCase(),
    type: String(r.type ?? r.requesttype ?? r.request_type ?? "").toUpperCase(),
    reason: r.reason ?? r.message ?? "",
    reviewreason: r.reviewreason ?? r.review_reason ?? "",
    createdat: r.createdat ?? r.created_at ?? null,
    reviewedat: r.reviewedat ?? r.reviewed_at ?? null,
  };
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ background: "#22263a", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, color: "#8b90a0", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function LogoutButton() {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const { refreshToken } = useAuthStore.getState();
      if (refreshToken) {
        try {
          await axios.post(`${API}/api/auth/logout`, { refreshtoken: refreshToken });
        } catch (e) {
          console.log("Logout API failed, clearing local session anyway", e);
        }
      }
    } finally {
      localStorage.removeItem("app-screen");
      localStorage.removeItem("auth-storage");
      localStorage.removeItem("exam-storage");
      useAuthStore.getState().clearAuth();
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="btn btn-ghost"
      style={{ padding: "7px 14px", fontSize: 13 }}
    >
      {loading ? "Signing out..." : "Logout"}
    </button>
  );
}

function statusPill(status) {
  const s = String(status || "").toUpperCase();

  if (s === "RUNNING") return { bg: "#0f2a1a", color: "#34c97a", label: "Running" };
  if (s === "DRAFT") return { bg: "#22263a", color: "#8b90a0", label: "Draft" };
  if (s === "PUBLISHED") return { bg: "#10243a", color: "#4f8ef7", label: "Published" };
  if (s === "COMPLETED") return { bg: "#22263a", color: "#c8cad0", label: "Completed" };
  if (s === "TERMINATED") return { bg: "#2a1010", color: "#f75f5f", label: "Terminated" };

  return { bg: "#22263a", color: "#c8cad0", label: status || "Unknown" };
}

function requestTypeLabel(type) {
  const t = String(type || "").toUpperCase();
  if (t === "REENTRY" || t === "RE-ENTRY") return "Re-entry";
  if (t === "LATEENTRY" || t === "LATE_ENTRY") return "Late entry";
  return t || "Request";
}

function requestStatusPill(status) {
  const s = String(status || "").toUpperCase();

  if (s === "PENDING") return { bg: "#2a2010", color: "#f5a623", label: "Pending" };
  if (s === "APPROVED") return { bg: "#0f2a1a", color: "#34c97a", label: "Approved" };
  if (s === "REJECTED") return { bg: "#2a1010", color: "#f75f5f", label: "Rejected" };

  return { bg: "#22263a", color: "#c8cad0", label: status || "Unknown" };
}

function MonitorTabButton({ active, label, count, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 34,
        padding: "0 14px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: active ? "#26314d" : "transparent",
        color: active ? "#e8eaf0" : "#98a0b8",
        border: active ? "1px solid #4f8ef7" : "1px solid transparent",
      }}
    >
      <span>{label}</span>
      {typeof count === "number" ? (
        <span
          style={{
            minWidth: 18,
            height: 18,
            padding: "0 6px",
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: count > 0 ? "#f5a623" : "#2a2f42",
            color: count > 0 ? "#17120a" : "#a5acc0",
            fontSize: 11,
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

export default function ExaminerDashboard() {
  const [monitorTab, setMonitorTab] = useState("grid");
  const [reentryRequests, setReentryRequests] = useState([]);
  const { user, accessToken } = useAuthStore();
  const socket = useSocket(accessToken);

  const [view, setView] = useState("list");
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [liveData, setLiveData] = useState({});
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [violations, setViolations] = useState([]);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [loadingExams, setLoadingExams] = useState(false);
  const [startingExam, setStartingExam] = useState(false);
  const [endingExam, setEndingExam] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [reviewingRequestId, setReviewingRequestId] = useState(null);

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken]
  );

  const selectedExamId = selectedExam?.examid ?? selectedExam?.exam_id ?? null;
  const normalizedExamStatus = String(selectedExam?.status || "").toUpperCase();
  const isExamRunning = normalizedExamStatus === "RUNNING";
  const isExamCompleted = normalizedExamStatus === "COMPLETED";

  const pendingRequestsCount = useMemo(
    () => reentryRequests.filter((r) => String(r.status).toUpperCase() === "PENDING").length,
    [reentryRequests]
  );

  const loadExams = useCallback(async () => {
    setLoadingExams(true);
    try {
      const res = await axios.get(`${API}/api/exams`, { headers });
      const rows = Array.isArray(res.data) ? res.data.map(normalizeExam) : [];
      setExams(rows);

      if (selectedExamId) {
        const latest = rows.find((x) => x.examid === selectedExamId);
        if (latest) setSelectedExam(latest);
      }
    } catch (e) {
      console.error("loadExams:", e.message);
    } finally {
      setLoadingExams(false);
    }
  }, [headers, selectedExamId]);

  const loadExamById = useCallback(
    async (examId) => {
      if (!examId) return null;

      try {
        const res = await axios.get(`${API}/api/exams/${examId}`, { headers });
        const normalized = normalizeExam(res.data);
        setSelectedExam(normalized);
        setExams((prev) => prev.map((e) => (e.examid === examId ? normalized : e)));
        return normalized;
      } catch (e) {
        console.error("loadExamById:", e.message);
        return null;
      }
    },
    [headers]
  );

  const loadCandidates = useCallback(
    async (examId) => {
      if (!examId) return;

      try {
        const res = await axios.get(`${API}/api/exams/${examId}/assessments`, { headers });
        setCandidates(Array.isArray(res.data) ? res.data.map(normalizeCandidate) : []);
      } catch (e) {
        console.error("loadCandidates:", e.message);
      }
    },
    [headers]
  );

  const loadViolations = useCallback(
    async (candidateId, examId) => {
      if (!candidateId || !examId) return;

      try {
        const res = await axios.get(`${API}/api/violations/${examId}/${candidateId}`, { headers });
        setViolations(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error("loadViolations:", e.message);
        setViolations([]);
      }
    },
    [headers]
  );

  const loadReentryRequests = useCallback(
    async (examIdArg) => {
      const examId = examIdArg ?? selectedExamId;
      if (!examId) {
        setReentryRequests([]);
        return [];
      }

      try {
        const res = await axios.get(`${API}/api/requests/exam/${examId}/pending`, {
          headers,
        });
        const rows = Array.isArray(res.data) ? res.data.map(normalizeRequest) : [];
        setReentryRequests(rows);
        return rows;
      } catch (e) {
        console.error("loadReentryRequests:", e.message);
        setReentryRequests([]);
        return [];
      }
    },
    [selectedExamId, headers]
  );

  useEffect(() => {
    loadExams();
  }, [loadExams, refreshTick]);

  useEffect(() => {
    if (view !== "monitor" || !selectedExamId) return;

    loadExamById(selectedExamId);
    loadCandidates(selectedExamId);
    loadReentryRequests(selectedExamId);

    const poll = setInterval(() => {
      loadExamById(selectedExamId);
      loadCandidates(selectedExamId);
      loadReentryRequests(selectedExamId);
    }, 5000);

    return () => clearInterval(poll);
  }, [view, selectedExamId, loadExamById, loadCandidates, loadReentryRequests]);

  useEffect(() => {
    if (!socket || view !== "monitor" || !selectedExamId) return;

    socket.emit("join_exam", { exam_id: selectedExamId, role: "Examiner" });

    const onCandidateUpdate = (data) => {
      const candidateId = data?.candidate_id ?? data?.candidateid;
      if (!candidateId) return;
      setLiveData((prev) => ({ ...prev, [candidateId]: data }));
      loadCandidates(selectedExamId);
    };

    const onViolationAlert = ({ candidate_id, candidateid, violation }) => {
      const candidateId = candidate_id ?? candidateid;
      if (!candidateId) return;

      setLiveData((prev) => ({
        ...prev,
        [candidateId]: {
          ...(prev[candidateId] || {}),
          latestViolation: violation,
        },
      }));
    };

    const onAssessmentUpdate = () => {
      loadCandidates(selectedExamId);
      loadReentryRequests(selectedExamId);
    };

    const onExamStarted = (payload) => {
      const startedId = payload?.exam_id ?? payload?.examid;
      if (startedId && startedId !== selectedExamId) return;

      setActionMsg("✅ Exam is now running");
      setTimeout(() => setActionMsg(""), 4000);
      loadExamById(selectedExamId);
      loadCandidates(selectedExamId);
      loadReentryRequests(selectedExamId);
      setRefreshTick((v) => v + 1);
    };

    socket.on("candidate_update", onCandidateUpdate);
    socket.on("violation_alert", onViolationAlert);
    socket.on("assessment_updated", onAssessmentUpdate);
    socket.on("exam_started", onExamStarted);

    return () => {
      socket.off("candidate_update", onCandidateUpdate);
      socket.off("violation_alert", onViolationAlert);
      socket.off("assessment_updated", onAssessmentUpdate);
      socket.off("exam_started", onExamStarted);
    };
  }, [socket, view, selectedExamId, loadCandidates, loadExamById, loadReentryRequests]);

  const openMonitor = async (exam) => {
    const normalized = normalizeExam(exam);

    setSelectedExam(normalized);
    setSelectedCandidate(null);
    setViolations([]);
    setLiveData({});
    setReentryRequests([]);
    setView("monitor");
    setMonitorTab("grid");

    const [requests] = await Promise.all([
      loadReentryRequests(normalized?.examid),
      loadExamById(normalized?.examid),
      loadCandidates(normalized?.examid),
    ]);

    const hasPendingRequests =
      Array.isArray(requests) &&
      requests.some((r) => String(r.status).toUpperCase() === "PENDING");

    setMonitorTab(hasPendingRequests ? "requests" : "grid");
  };

  const startExam = async () => {
    if (!selectedExamId || startingExam || isExamRunning || isExamCompleted) return;

    setStartingExam(true);
    try {
      await axios.patch(`${API}/api/exams/${selectedExamId}/start`, {}, { headers });

      if (socket) {
        socket.emit("start_exam", { exam_id: selectedExamId });
      }

      await Promise.all([
        loadExamById(selectedExamId),
        loadCandidates(selectedExamId),
        loadReentryRequests(selectedExamId),
      ]);
      setRefreshTick((v) => v + 1);

      setActionMsg("✅ Exam started successfully — status changed to Running");
      setTimeout(() => setActionMsg(""), 5000);
    } catch (e) {
      setActionMsg(`❌ Failed to start exam: ${e.response?.data?.detail || e.message}`);
      setTimeout(() => setActionMsg(""), 5000);
    } finally {
      setStartingExam(false);
    }
  };

  const endExam = async () => {
    if (!selectedExamId || endingExam || isExamCompleted) return;

    const confirmed = window.confirm(
      "End this exam for all candidates? Active and resumable assessments will be closed."
    );
    if (!confirmed) return;

    setEndingExam(true);
    try {
      await axios.patch(`${API}/api/exams/${selectedExamId}/end`, {}, { headers });

      await Promise.all([
        loadExamById(selectedExamId),
        loadCandidates(selectedExamId),
        loadReentryRequests(selectedExamId),
      ]);
      setRefreshTick((v) => v + 1);

      setActionMsg("🛑 Exam ended successfully");
      setTimeout(() => setActionMsg(""), 5000);
    } catch (e) {
      setActionMsg(`❌ Failed to end exam: ${e.response?.data?.detail || e.message}`);
      setTimeout(() => setActionMsg(""), 5000);
    } finally {
      setEndingExam(false);
    }
  };

  const doAction = async (assessmentId, action) => {
    if (!assessmentId) return;

    const reason = window.prompt(`Reason for "${action}" (required):`);
    if (!reason || !reason.trim()) return;

    try {
      await axios.post(
        `${API}/api/assessments/${assessmentId}/action`,
        { action, reason: reason.trim() },
        { headers }
      );

      if (socket) {
        socket.emit("examiner_control", {
          exam_id: selectedExamId,
          examid: selectedExamId,
          assessment_id: assessmentId,
          assessmentid: assessmentId,
          candidate_id: selectedCandidate?.candidateid,
          candidateid: selectedCandidate?.candidateid,
          action,
          status: action === "terminate" ? "TERMINATED" : undefined,
        });
      }

      setActionMsg(`✅ ${action} applied`);
      setTimeout(() => setActionMsg(""), 3000);

      await loadCandidates(selectedExamId);
      if (selectedCandidate?.candidateid) {
        await loadViolations(selectedCandidate.candidateid, selectedExamId);
      }
      await loadExamById(selectedExamId);
      await loadReentryRequests(selectedExamId);
    } catch (e) {
      setActionMsg(`❌ Action failed: ${e.response?.data?.detail || e.message}`);
      setTimeout(() => setActionMsg(""), 4000);
    }
  };

  const sendBroadcast = () => {
    if (!broadcastMsg.trim() || !socket || !selectedExamId) return;

    socket.emit("broadcast_message", {
      exam_id: selectedExamId,
      examiner_id: user?.user_id ?? user?.userid,
      message: broadcastMsg.trim(),
    });

    setBroadcastMsg("");
    setActionMsg("📢 Broadcast sent to all candidates");
    setTimeout(() => setActionMsg(""), 3000);
  };

  const goBack = () => {
    setView("list");
    setSelectedExam(null);
    setSelectedCandidate(null);
    setCandidates([]);
    setLiveData({});
    setViolations([]);
    setReentryRequests([]);
    setMonitorTab("grid");
    loadExams();
  };

  const handleReentryReview = async (request, approve) => {
    const requestId = request?.requestid;
    if (!requestId) return;

    const decision = approve ? "APPROVED" : "REJECTED";
    const rejectionReason = !approve
      ? window.prompt("Rejection reason:", "Not approved")
      : "";

    if (!approve && rejectionReason === null) return;

    setReviewingRequestId(requestId);

    try {
      await axios.patch(
        `${API}/api/requests/${requestId}/review`,
        {
          decision,
          reason: approve ? undefined : (rejectionReason || "Not approved").trim(),
        },
        { headers }
      );

      if (socket) {
        socket.emit("reentry_decision", {
          request_id: requestId,
          requestid: requestId,
          assessment_id: request?.assessmentid,
          assessmentid: request?.assessmentid,
          candidate_id: request?.candidateid,
          candidateid: request?.candidateid,
          approved: approve,
          exam_id: selectedExamId,
          examid: selectedExamId,
          decision,
          type: request?.type,
          next_status: approve
            ? request?.type === "LATEENTRY" || request?.type === "LATE_ENTRY"
              ? "LATEENTRY_APPROVED"
              : "REENTRY_APPROVED"
            : request?.type === "LATEENTRY" || request?.type === "LATE_ENTRY"
              ? "LATEENTRY_REJECTED"
              : "REENTRY_REJECTED",
        });
      }

      await Promise.all([
        loadReentryRequests(selectedExamId),
        loadCandidates(selectedExamId),
        loadExamById(selectedExamId),
      ]);

      setActionMsg(approve ? "✅ Request approved" : "❌ Request rejected");
      setTimeout(() => setActionMsg(""), 3000);
    } catch (err) {
      console.error(err);
      setActionMsg(`❌ ${err.response?.data?.detail || err.message}`);
      setTimeout(() => setActionMsg(""), 4000);
    } finally {
      setReviewingRequestId(null);
    }
  };

  if (view === "create") {
    return (
      <CreateExam
        onBack={() => setView("list")}
        onCreated={(newExam) => {
          const normalized = normalizeExam(newExam);
          setSelectedExam(normalized);
          loadExams();
          setView("assign");
        }}
      />
    );
  }

  if (view === "assign") {
    return (
      <AssignCandidates
        exam={selectedExam}
        onBack={() => {
          loadExams();
          if (selectedExamId) loadExamById(selectedExamId);
          setView("list");
        }}
      />
    );
  }

  if (view === "list") {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0f1117" }}>
        <div
          style={{
            height: 56,
            background: "#1a1d27",
            borderBottom: "1px solid #2e3347",
            display: "flex",
            alignItems: "center",
            padding: "0 24px",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 20 }}>👁️</span>
          <span style={{ fontWeight: 700, fontSize: 16 }}>3rdEyeZ360</span>
          <span style={{ fontSize: 12, color: "#8b90a0" }}>— {user?.role} Dashboard</span>

          <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#8b90a0" }}>{user?.name}</span>
            <LogoutButton />
            <button
              onClick={() => setView("create")}
              className="btn btn-primary"
              style={{ padding: "7px 18px", fontSize: 13 }}
            >
              + Create Exam
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Your Exams</h2>

          {loadingExams ? (
            <div style={{ textAlign: "center", color: "#8b90a0", padding: 60 }}>Loading exams...</div>
          ) : exams.length === 0 ? (
            <div style={{ textAlign: "center", color: "#8b90a0", padding: "60px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
              <p style={{ marginBottom: 16 }}>No exams yet.</p>
              <button
                onClick={() => setView("create")}
                className="btn btn-primary"
                style={{ padding: "10px 24px", fontSize: 14 }}
              >
                Create your first exam
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {exams.map((exam) => {
                const pill = statusPill(exam.status);
                return (
                  <div
                    key={exam.examid}
                    style={{
                      background: "#1a1d27",
                      border: "1px solid #2e3347",
                      borderRadius: 12,
                      padding: 20,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{exam.name}</div>

                    <div style={{ fontSize: 12, color: "#8b90a0" }}>
                      {exam.date} &nbsp;&nbsp; {exam.starttime} - {exam.endtime}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          background: pill.bg,
                          color: pill.color,
                          padding: "3px 10px",
                          borderRadius: 20,
                          fontSize: 12,
                        }}
                      >
                        {pill.label}
                      </span>
                      <span style={{ fontSize: 12, color: "#555a6e" }}>{exam.durationminutes} min</span>
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <button
                        onClick={() => openMonitor(exam)}
                        className="btn btn-primary"
                        style={{ flex: 1, fontSize: 13, padding: "7px 0" }}
                      >
                        Monitor
                      </button>
                      <button
                        onClick={() => {
                          setSelectedExam(exam);
                          setView("assign");
                        }}
                        className="btn btn-ghost"
                        style={{ flex: 1, fontSize: 13, padding: "7px 0" }}
                      >
                        Assign
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === "monitor") {
    const examPill = statusPill(selectedExam?.status);
    const activeCount = candidates.filter((c) => String(c.status).toUpperCase() === "ACTIVE").length;
    const interruptedCount = candidates.filter((c) => String(c.status).toUpperCase() === "INTERRUPTED").length;
    const lockedCount = candidates.filter((c) => String(c.status).toUpperCase() === "LOCKED").length;
    const avgCredibility =
      candidates.length > 0
        ? Math.round(
            candidates.reduce((sum, c) => sum + Number(c.credibilityscore || 0), 0) / candidates.length
          )
        : 0;

    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0f1117" }}>
        <div
          style={{
            minHeight: 52,
            background: "#1a1d27",
            borderBottom: "1px solid #2e3347",
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            gap: 12,
            flexShrink: 0,
            flexWrap: "wrap",
          }}
        >
          <button onClick={goBack} className="btn btn-ghost" style={{ padding: "5px 12px", fontSize: 12 }}>
            ← Back
          </button>

          <span style={{ fontWeight: 700, fontSize: 14 }}>{selectedExam?.name}</span>

          <span
            style={{
              background: examPill.bg,
              color: examPill.color,
              padding: "3px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {examPill.label}
          </span>

          <span style={{ fontSize: 12, color: "#8b90a0" }}>
            {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}
          </span>

          {actionMsg && (
            <span style={{ fontSize: 12, color: "#34c97a", marginLeft: 8 }}>{actionMsg}</span>
          )}

          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <LogoutButton />

            <input
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendBroadcast()}
              placeholder="Broadcast to all candidates..."
              style={{ width: 220, padding: "6px 10px", fontSize: 12 }}
            />

            <button onClick={sendBroadcast} className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }}>
              Send
            </button>

            <button
              onClick={startExam}
              disabled={startingExam || isExamRunning || isExamCompleted}
              className="btn btn-success"
              style={{
                padding: "6px 16px",
                fontSize: 12,
                opacity: startingExam || isExamRunning || isExamCompleted ? 0.6 : 1,
                cursor: startingExam || isExamRunning || isExamCompleted ? "not-allowed" : "pointer",
              }}
            >
              {startingExam
                ? "Starting..."
                : isExamCompleted
                  ? "Exam Completed"
                  : isExamRunning
                    ? "Exam Running"
                    : "Start Exam"}
            </button>

            <button
              onClick={endExam}
              disabled={endingExam || isExamCompleted}
              className="btn btn-danger"
              style={{
                padding: "6px 16px",
                fontSize: 12,
                opacity: endingExam || isExamCompleted ? 0.6 : 1,
                cursor: endingExam || isExamCompleted ? "not-allowed" : "pointer",
              }}
            >
              {endingExam ? "Ending..." : isExamCompleted ? "Exam Ended" : "End Exam"}
            </button>

            <button
              onClick={() => {
                setSelectedExam(selectedExam);
                setView("assign");
              }}
              className="btn btn-ghost"
              style={{ padding: "6px 12px", fontSize: 12 }}
            >
              Assign
            </button>

            <button
              onClick={() => {
                loadExamById(selectedExamId);
                loadCandidates(selectedExamId);
                loadReentryRequests(selectedExamId);
              }}
              className="btn btn-ghost"
              style={{ padding: "6px 12px", fontSize: 12 }}
            >
              Refresh
            </button>
          </div>
        </div>

        <div
          style={{
            padding: 16,
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 12,
            borderBottom: "1px solid #2e3347",
            background: "#121520",
            flexShrink: 0,
          }}
        >
          <StatBox label="Active" value={activeCount} color="#34c97a" />
          <StatBox label="Interrupted" value={interruptedCount} color="#f5a623" />
          <StatBox label="Locked" value={lockedCount} color="#f75f5f" />
          <StatBox label="Avg credibility" value={`${avgCredibility}%`} color="#4f8ef7" />
        </div>

        <div
          style={{
            minHeight: 48,
            background: "#1a1d27",
            borderBottom: "1px solid #2e3347",
            display: "flex",
            alignItems: "center",
            padding: "6px 16px",
            gap: 8,
            flexShrink: 0,
            flexWrap: "wrap",
          }}
        >
          <MonitorTabButton
            active={monitorTab === "grid"}
            label="🖥 Live Grid"
            onClick={() => setMonitorTab("grid")}
          />
          <MonitorTabButton
            active={monitorTab === "requests"}
            label="📬 Requests"
            count={pendingRequestsCount}
            onClick={() => setMonitorTab("requests")}
          />
        </div>

        {monitorTab === "requests" ? (
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {reentryRequests.length === 0 ? (
              <div style={{ color: "#8b90a0", textAlign: "center", padding: "60px 0" }}>
                No pending requests.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {reentryRequests.map((req) => {
                  const pill = requestStatusPill(req.status);
                  return (
                    <div
                      key={req.requestid}
                      style={{
                        background: "#1a1d27",
                        border: "1px solid #2e3347",
                        borderRadius: 12,
                        padding: 16,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#e8eaf0" }}>
                          {requestTypeLabel(req.type)} Request
                        </div>
                        <div
                          style={{
                            background: pill.bg,
                            color: pill.color,
                            padding: "3px 10px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {pill.label}
                        </div>
                      </div>

                      <div style={{ fontSize: 12, color: "#8b90a0", marginBottom: 10 }}>
                        {req.candidatename ? `${req.candidatename} • ` : ""}
                        Candidate {req.candidateid} • Assessment {req.assessmentid}
                      </div>

                      <div style={{ fontSize: 13, color: "#c8cad0", marginBottom: 12 }}>
                        {req.reason || "No reason provided"}
                      </div>

                      {req.createdat && (
                        <div style={{ fontSize: 11, color: "#8b90a0", marginBottom: 8 }}>
                          Requested at {new Date(req.createdat).toLocaleString()}
                        </div>
                      )}

                      {req.reviewedat && req.status !== "PENDING" && (
                        <div style={{ fontSize: 11, color: "#8b90a0", marginBottom: 8 }}>
                          Reviewed at {new Date(req.reviewedat).toLocaleString()}
                        </div>
                      )}

                      {req.reviewreason && req.status !== "PENDING" && (
                        <div style={{ fontSize: 12, color: "#c8cad0", marginBottom: 12 }}>
                          Review reason: {req.reviewreason}
                        </div>
                      )}

                      {req.status === "PENDING" ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => handleReentryReview(req, true)}
                            disabled={reviewingRequestId === req.requestid}
                            className="btn btn-success"
                            style={{ padding: "7px 14px", fontSize: 12 }}
                          >
                            {reviewingRequestId === req.requestid ? "Working..." : "Approve"}
                          </button>
                          <button
                            onClick={() => handleReentryReview(req, false)}
                            disabled={reviewingRequestId === req.requestid}
                            className="btn btn-danger"
                            style={{ padding: "7px 14px", fontSize: 12 }}
                          >
                            {reviewingRequestId === req.requestid ? "Working..." : "Reject"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 16,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 12,
                alignContent: "start",
              }}
            >
              {candidates.length === 0 ? (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "#8b90a0", padding: "60px 0", fontSize: 13 }}>
                  No candidates assigned yet.{" "}
                  <span onClick={() => setView("assign")} style={{ color: "#4f8ef7", cursor: "pointer" }}>
                    Assign candidates
                  </span>
                </div>
              ) : (
                candidates.map((c) => {
                  const candidateId = c.candidateid;
                  const live = liveData[candidateId] || {};
                  const color = STATUS_COLORS[String(c.status).toUpperCase()] || "#555a6e";
                  const isAlert = !!live.latestViolation;
                  const isActive = candidateId === selectedCandidate?.candidateid;

                  return (
                    <div
                      key={candidateId}
                      onClick={() => {
                        setSelectedCandidate(c);
                        loadViolations(candidateId, selectedExamId);
                      }}
                      style={{
                        background: isActive ? "#1e2235" : "#1a1d27",
                        border: `2px solid ${isAlert ? "#f75f5f" : isActive ? "#4f8ef7" : color}`,
                        borderRadius: 10,
                        padding: 14,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        outline: isActive ? "1px solid #4f8ef7" : "none",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span
                          style={{
                            fontSize: 10,
                            color: "#555a6e",
                            maxWidth: 120,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {candidateId}
                        </span>
                        <span
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: "50%",
                            background: color,
                            display: "inline-block",
                            flexShrink: 0,
                          }}
                        />
                      </div>

                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          marginBottom: 3,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {c.candidatename}
                      </div>

                      <div style={{ fontSize: 11, color, marginBottom: 8, fontWeight: 500 }}>{c.status}</div>

                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8b90a0" }}>
                        <span>⚠ {c.violationcount}</span>
                        <span>📊 {c.riskscore}</span>
                        <span>💯 {c.credibilityscore}</span>
                      </div>

                      {isAlert && (
                        <div
                          style={{
                            marginTop: 8,
                            fontSize: 10,
                            background: "#2a1010",
                            borderRadius: 5,
                            padding: "4px 8px",
                            color: "#f75f5f",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {live.latestViolation?.type || "Violation alert"}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div
              style={{
                width: 380,
                borderLeft: "1px solid #2e3347",
                background: "#131722",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {!selectedCandidate ? (
                <div style={{ padding: 20, color: "#8b90a0", fontSize: 13 }}>
                  Select a candidate to view details.
                </div>
              ) : (
                <>
                  <div style={{ padding: 18, borderBottom: "1px solid #2e3347" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                      {selectedCandidate.candidatename}
                    </div>
                    <div style={{ fontSize: 12, color: "#8b90a0", marginBottom: 10 }}>
                      {selectedCandidate.candidateid}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                      <StatBox
                        label="Status"
                        value={selectedCandidate.status}
                        color={STATUS_COLORS[String(selectedCandidate.status).toUpperCase()] || "#c8cad0"}
                      />
                      <StatBox label="Warnings" value={selectedCandidate.warningcount} color="#f5a623" />
                      <StatBox label="Violations" value={selectedCandidate.violationcount} color="#f75f5f" />
                      <StatBox label="Credibility" value={`${selectedCandidate.credibilityscore}%`} color="#4f8ef7" />
                    </div>
                  </div>

                  <div style={{ padding: 16, borderBottom: "1px solid #2e3347", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => doAction(selectedCandidate.assessmentid, "pause")}
                      className="btn btn-ghost"
                      style={{ padding: "7px 12px", fontSize: 12 }}
                    >
                      Pause
                    </button>
                    <button
                      onClick={() => doAction(selectedCandidate.assessmentid, "resume")}
                      className="btn btn-success"
                      style={{ padding: "7px 12px", fontSize: 12 }}
                    >
                      Resume
                    </button>
                    <button
                      onClick={() => doAction(selectedCandidate.assessmentid, "terminate")}
                      className="btn btn-danger"
                      style={{ padding: "7px 12px", fontSize: 12 }}
                    >
                      Terminate
                    </button>
                  </div>

                  <div style={{ padding: 16, borderBottom: "1px solid #2e3347" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Latest live data</div>
                    <div style={{ fontSize: 12, color: "#8b90a0", display: "grid", gap: 6 }}>
                      <div>Status: {liveData[selectedCandidate.candidateid]?.status || "—"}</div>
                      <div>Focus: {liveData[selectedCandidate.candidateid]?.focus ?? "—"}</div>
                      <div>Noise: {liveData[selectedCandidate.candidateid]?.noise_level ?? "—"}</div>
                      <div>Face count: {liveData[selectedCandidate.candidateid]?.face_count ?? "—"}</div>
                    </div>
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Violations</div>

                    {violations.length === 0 ? (
                      <div style={{ color: "#8b90a0", fontSize: 12 }}>No violations recorded.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 10 }}>
                        {violations.map((v, idx) => (
                          <div
                            key={v.violation_id ?? v.id ?? idx}
                            style={{
                              background: "#1a1d27",
                              border: "1px solid #2e3347",
                              borderRadius: 10,
                              padding: 12,
                            }}
                          >
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#f5a623", marginBottom: 6 }}>
                              {v.type ?? v.violation_type ?? "Violation"}
                            </div>
                            <div style={{ fontSize: 12, color: "#c8cad0", marginBottom: 6 }}>
                              {v.message ?? v.description ?? "No description"}
                            </div>
                            <div style={{ fontSize: 11, color: "#8b90a0" }}>
                              {v.timestamp ? new Date(v.timestamp).toLocaleString() : "Time unavailable"}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: "1px solid #2e3347", minHeight: 220 }}>
                    <ChatWindow
                      examId={selectedExamId}
                      currentUser={user}
                      selectedUserId={selectedCandidate.candidateid}
                      selectedUserName={selectedCandidate.candidatename}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}