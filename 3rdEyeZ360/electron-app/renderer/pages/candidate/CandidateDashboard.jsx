import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import useAuthStore from "../../store/authStore";

const API = "http://localhost:3000";

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

function getStatusChip(status, examStatus) {
  const normalized = String(status || "").toUpperCase();
  const normalizedExam = String(examStatus || "").toLowerCase();

  if (normalized === "COMPLETED") {
    return { label: "Completed", bg: "#0f2a1a", color: "#34c97a" };
  }

  if (normalized === "TERMINATED") {
    return { label: "Terminated", bg: "#2a1010", color: "#f75f5f" };
  }

  if (normalized === "ACTIVE" || normalizedExam === "running") {
    return { label: "Ready to Enter", bg: "#10243a", color: "#4f8ef7" };
  }

  if (normalized === "PAUSED") {
    return { label: "Paused", bg: "#2a2010", color: "#f5a623" };
  }

  if (normalized === "LOCKED") {
    return { label: "Locked", bg: "#2a1010", color: "#f75f5f" };
  }

  if (normalized === "ASSIGNED" || normalized === "AVAILABLE" || normalized === "READY") {
    return { label: "Assigned", bg: "#22263a", color: "#c8cad0" };
  }

  return { label: status || "Unknown", bg: "#22263a", color: "#c8cad0" };
}

function canEnterExam(exam) {
  const status = String(exam?.status || "").toUpperCase();
  const examStatus = String(exam?.examstatus || "").toLowerCase();

  if (status === "COMPLETED" || status === "TERMINATED") return false;
  if (status === "LOCKED") return false;

  return ["assigned", "running", "draft"].includes(examStatus) ||
    ["ASSIGNED", "AVAILABLE", "READY", "ACTIVE", "PAUSED"].includes(status);
}

export default function CandidateDashboard({ onEnterExam }) {
  const { user, accessToken } = useAuthStore();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${accessToken}`,
    }),
    [accessToken]
  );

  const loadAssessments = async () => {
    if (!accessToken) return;

    setLoading(true);
    setError("");

    try {
      const res = await axios.get(`${API}/api/exams/candidate/upcoming`, { headers });
      setAssessments(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("load candidate assessments:", e);
      setError(e?.response?.data?.detail || "Failed to load your assessments.");
      setAssessments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssessments();
  }, [accessToken]);

  const allottedCount = assessments.length;
  const completedCount = assessments.filter(
    (item) => String(item.status || "").toUpperCase() === "COMPLETED"
  ).length;
  const activeCount = assessments.filter((item) => canEnterExam(item)).length;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#0f1117",
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
          <span style={{ fontWeight: 700, fontSize: 15, color: "#e8eaf0" }}>
            3rdEyeZ360
          </span>
          <span style={{ fontSize: 12, color: "#8b90a0" }}>— Candidate Dashboard</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "#8b90a0" }}>{user?.name}</span>
          <LogoutButton />
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 24,
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#e8eaf0" }}>
            Welcome back
          </h2>
          <p style={{ fontSize: 14, color: "#8b90a0", margin: 0 }}>
            Choose an allotted assessment to enter the exam hall and begin your checks.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginBottom: 28,
          }}
        >
          <StatCard label="Assessments Allotted" value={allottedCount} color="#4f8ef7" />
          <StatCard label="Ready / Active" value={activeCount} color="#34c97a" />
          <StatCard label="Completed" value={completedCount} color="#f5a623" />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
            gap: 12,
          }}
        >
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#e8eaf0", margin: 0 }}>
            Your Assessments
          </h3>

          <button
            onClick={loadAssessments}
            className="btn btn-ghost"
            style={{ padding: "8px 14px", fontSize: 12 }}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div
            style={{
              textAlign: "center",
              color: "#8b90a0",
              padding: "60px 0",
              background: "#1a1d27",
              border: "1px solid #2e3347",
              borderRadius: 16,
            }}
          >
            Loading your assessments...
          </div>
        ) : error ? (
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
              textAlign: "center",
              color: "#8b90a0",
              padding: "60px 24px",
              background: "#1a1d27",
              border: "1px solid #2e3347",
              borderRadius: 16,
            }}
          >
            <div style={{ fontSize: 44, marginBottom: 14 }}>📝</div>
            <div style={{ fontSize: 16, color: "#e8eaf0", marginBottom: 8 }}>
              No assessments assigned yet
            </div>
            <div style={{ fontSize: 13 }}>
              Your allotted assessments will appear here once an examiner assigns them.
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 16,
            }}
          >
            {assessments.map((exam) => {
              const chip = getStatusChip(exam.status, exam.examstatus);
              const enterable = canEnterExam(exam);

              return (
                <div
                  key={exam.assessmentid}
                  style={{
                    background: "#1a1d27",
                    border: "1px solid #2e3347",
                    borderRadius: 16,
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
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
                        {exam.date} · {exam.starttime} – {exam.endtime}
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

                  {exam.description ? (
                    <div
                      style={{
                        fontSize: 13,
                        color: "#c8cad0",
                        lineHeight: 1.6,
                        minHeight: 42,
                      }}
                    >
                      {exam.description}
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: 13,
                        color: "#8b90a0",
                        lineHeight: 1.6,
                        minHeight: 42,
                      }}
                    >
                      No additional description provided for this assessment.
                    </div>
                  )}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        background: "#22263a",
                        borderRadius: 10,
                        padding: "10px 12px",
                      }}
                    >
                      <div style={{ fontSize: 11, color: "#8b90a0", marginBottom: 4 }}>
                        Duration
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#e8eaf0" }}>
                        {exam.durationminutes} mins
                      </div>
                    </div>

                    <div
                      style={{
                        background: "#22263a",
                        borderRadius: 10,
                        padding: "10px 12px",
                      }}
                    >
                      <div style={{ fontSize: 11, color: "#8b90a0", marginBottom: 4 }}>
                        Allowed Sites
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#e8eaf0" }}>
                        {Array.isArray(exam.allowedwebsites) ? exam.allowedwebsites.length : 0}
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
                      lineHeight: 1.6,
                    }}
                  >
                    Assessment ID: <span style={{ color: "#c8cad0" }}>{exam.assessmentid}</span>
                    <br />
                    Exam Status: <span style={{ color: "#c8cad0" }}>{exam.examstatus || "—"}</span>
                  </div>

                  <button
                    onClick={() => onEnterExam(exam)}
                    disabled={!enterable}
                    className="btn btn-primary"
                    style={{
                      width: "100%",
                      padding: "12px 0",
                      fontSize: 14,
                      opacity: enterable ? 1 : 0.45,
                      cursor: enterable ? "pointer" : "not-allowed",
                    }}
                  >
                    {enterable ? "Enter Exam Hall →" : "Not Available"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}