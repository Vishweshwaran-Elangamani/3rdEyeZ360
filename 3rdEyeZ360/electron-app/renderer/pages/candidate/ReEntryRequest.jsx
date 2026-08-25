import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import useAuthStore from "../../store/authStore";
import useSocket from "../../hooks/useSocket";

const API = "http://localhost:3000";

function pick(...values) {
  return values.find(
    (value) => value !== undefined && value !== null && String(value).trim() !== "",
  );
}

export default function ReEntryRequest({ assessment, exam, onApproved }) {
  const { accessToken } = useAuthStore();
  const socket = useSocket(accessToken);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const assessmentId = useMemo(
    () => pick(assessment?.assessmentid, assessment?.assessment_id),
    [assessment],
  );
  const examId = useMemo(
    () => pick(assessment?.examid, assessment?.exam_id, exam?.examid, exam?.exam_id),
    [assessment, exam],
  );
  const candidateId = useMemo(
    () => pick(assessment?.candidateid, assessment?.candidate_id),
    [assessment],
  );

  useEffect(() => {
    if (!socket || !assessmentId) return undefined;

    const matchesAssessment = (payload = {}) => {
      const payloadAssessmentId = pick(
        payload?.assessmentid,
        payload?.assessment_id,
        payload?.assessment?.assessmentid,
        payload?.assessment?.assessment_id,
      );
      return String(payloadAssessmentId || "") === String(assessmentId);
    };

    const statusOf = (payload = {}) =>
      String(
        pick(
          payload?.status,
          payload?.next_status,
          payload?.assessment?.status,
          payload?.assessment?.assessmentstatus,
          payload?.assessment?.assessment_status,
        ) || "",
      )
        .trim()
        .toUpperCase()
        .replace(/[\s_-]+/g, "");

    const handleApproved = (payload = {}) => {
      if (!matchesAssessment(payload)) return;
      const status = statusOf(payload);
      if (
        payload?.approved === true ||
        ["APPROVED", "REENTRYAPPROVED", "LATEENTRYAPPROVED", "ACTIVE"].includes(status)
      ) {
        setError("");
        onApproved?.();
      }
    };

    const handleRejected = (payload = {}) => {
      if (!matchesAssessment(payload)) return;
      const status = statusOf(payload);
      if (
        payload?.approved === false ||
        ["REJECTED", "REENTRYREJECTED", "LATEENTRYREJECTED"].includes(status)
      ) {
        setSubmitted(false);
        setError(
          `Re-entry rejected: ${
            pick(payload?.reason, payload?.reviewreason, payload?.review_reason) ||
            "Contact your examiner"
          }`,
        );
      }
    };

    const joinExamRoom = () => {
      if (!socket.connected || !examId) return;
      socket.emit("join_exam", {
        examid: examId,
        assessmentid: assessmentId,
        candidateid: candidateId,
        role: "Candidate",
      });
    };

    const handleReviewed = (payload) => {
      handleApproved(payload);
      handleRejected(payload);
    };

    socket.on("connect", joinExamRoom);
    socket.on("reentry_approved", handleApproved);
    socket.on("reentry_rejected", handleRejected);
    socket.on("request_reviewed", handleReviewed);
    socket.on("assessment_updated", handleReviewed);
    joinExamRoom();

    return () => {
      socket.off("connect", joinExamRoom);
      socket.off("reentry_approved", handleApproved);
      socket.off("reentry_rejected", handleRejected);
      socket.off("request_reviewed", handleReviewed);
      socket.off("assessment_updated", handleReviewed);
    };
  }, [socket, assessmentId, examId, candidateId, onApproved]);

  const submit = async () => {
    if (!reason.trim()) {
      setError("Please explain why you need to re-enter");
      return;
    }
    if (!assessmentId) {
      setError("Assessment ID is unavailable");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await axios.post(
        `${API}/api/assessments/${assessmentId}/reentry`,
        { reason: reason.trim() },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reentry-request">
      <div className="reentry-icon">⚠️</div>
      <h3>Assessment Interrupted</h3>
      <p>
        Your assessment was interrupted. To re-enter, please provide a reason and
        wait for your examiner to approve.
      </p>

      {error ? <div className="reentry-error">{error}</div> : null}

      {!submitted ? (
        <>
          <label>Reason for interruption *</label>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            placeholder="e.g. My laptop battery died and I had to restart..."
            style={{
              width: "100%",
              background: "#22263a",
              border: "1px solid #2e3347",
              borderRadius: 8,
              padding: "10px 12px",
              color: "#e8eaf0",
              fontSize: 14,
              resize: "none",
              outline: "none",
              fontFamily: "Inter, sans-serif",
              lineHeight: 1.6,
              boxSizing: "border-box",
            }}
          />
          <button type="button" onClick={submit} disabled={loading}>
            {loading ? "Submitting..." : "Request Re-entry"}
          </button>
        </>
      ) : (
        <div className="reentry-pending">
          <div>⏳</div>
          <strong>Request Submitted</strong>
          <p>
            Waiting for examiner approval. Please stay at your desk and keep your
            camera visible.
          </p>
        </div>
      )}
    </div>
  );
}
