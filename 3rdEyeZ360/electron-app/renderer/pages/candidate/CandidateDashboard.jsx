import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import useAuthStore from "../../store/authStore";

const API = "http://localhost:3000";
const POLL_INTERVAL = 6000; // auto-refresh every 6s

// ─── Normalize mixed field names from backend ────────────────────────────────
function normalizeItem(raw) {
  if (!raw) return null;
  return {
    ...raw,
    assessmentid:    raw.assessmentid    ?? raw.assessment_id   ?? null,
    examid:          raw.examid          ?? raw.exam_id         ?? null,
    name:            raw.name            ?? "Upcoming Exam",
    description:     raw.description     ?? "",
    date:            raw.date            ?? "—",
    starttime:       raw.starttime       ?? raw.start_time      ?? "—",
    endtime:         raw.endtime         ?? raw.end_time        ?? "—",
    durationminutes: raw.durationminutes ?? raw.duration_minutes ?? 0,
    status:          raw.status          ?? "ASSIGNED",
    examstatus:      raw.examstatus      ?? raw.exam_status     ?? "Draft",
    allowedwebsites: Array.isArray(raw.allowedwebsites)
      ? raw.allowedwebsites
      : Array.isArray(raw.allowed_websites)
        ? raw.allowed_websites
        : [],
  };
}

// ─── Status chip ─────────────────────────────────────────────────────────────
function getStatusChip(status, examStatus) {
  const s = String(status    || "").toUpperCase();
  const e = String(examStatus || "").toLowerCase();

  if (s === "COMPLETED")  return { label: "Completed",      bg: "#0f2a1a", color: "#34c97a" };
  if (s === "TERMINATED") return { label: "Terminated",     bg: "#2a1010", color: "#f75f5f" };
  if (s === "LOCKED")     return { label: "Locked",         bg: "#2a1010", color: "#f75f5f" };
  if (s === "PAUSED")     return { label: "Paused",         bg: "#2a2010", color: "#f5a623" };

  // Approved re-entry / late entry
  if (["REENTRYAPPROVED","REENTRY_APPROVED","LATEENTRYAPPROVED","LATEENTRY_APPROVED"].includes(s)) {
    return { label: "Re-entry Approved", bg: "#0f2a1a", color: "#34c97a" };
  }

  // Assessment is active AND exam is running → ready to enter
  if ((s === "ACTIVE") || e === "running") {
    return { label: "Ready to Enter", bg: "#10243a", color: "#4f8ef7" };
  }

  if (["ASSIGNED","AVAILABLE","READY"].includes(s)) {
    return { label: "Assigned — Waiting", bg: "#22263a", color: "#c8cad0" };
  }

  return { label: status || "Unknown", bg: "#22263a", color: "#c8cad0" };
}

// ─── Entry gate ──────────────────────────────────────────────────────────────
function canEnterExam(exam) {
  const s = String(exam?.status    || "").toUpperCase();
  const e = String(exam?.examstatus || "").toLowerCase();

  // Hard blocks
  if (["COMPLETED","TERMINATED","LOCKED"].includes(s)) return false;

  // Re-entry / late entry approved
  if (["REENTRYAPPROVED","REENTRY_APPROVED","LATEENTRYAPPROVED","LATEENTRY_APPROVED"].includes(s)) {
    return true;
  }

  // Assessment is active (exam running)
  if (s === "ACTIVE") return true;

  // Paused — still allow re-entry (examiner can resume)
  if (s === "PAUSED") return true;

  // Assigned/Ready only when exam is actually running
  if (["ASSIGNED","AVAILABLE","READY"].includes(s) && e === "running") return true;

  return false;
}

// ─── Sub-components ──────────────────────────────────────────────────────────
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
    <div style={{ background: "#1a1d27", border: "1px solid #2e3347", borderRadius: 14, padding: 18 }}>
      <div style={{ fontSize: 12, color: "#8b90a0", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CandidateDashboard({ onEnterExam }) {
  const { user, accessToken } = useAuthStore();
  const [assessments, setAssessments]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [error, setError]               = useState("");
  const [lastUpdated, setLastUpdated]   = useState(null);

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken]
  );

  const fetchAssessments = useCallback(async (silent = false) => {
    if (!accessToken) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError("");

    try {
      const res = await axios.get(`${API}/api/exams/candidate/upcoming`, { headers });
      const normalized = Array.isArray(res.data) ? res.data.map(normalizeItem) : [];
      setAssessments(normalized);
      setLastUpdated(new Date());
    } catch (e) {
      console.error("load candidate assessments:", e);
      if (!silent) {
        setError(e?.response?.data?.detail || "Failed to load your assessments.");
        setAssessments([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, headers]);

  // Initial load
  useEffect(() => {
    fetchAssessments(false);
  }, [fetchAssessments]);

  // Auto-poll — so the "Enter Exam Hall" button lights up the moment an examiner starts the exam
  useEffect(() => {
    const poll = setInterval(() => fetchAssessments(true), POLL_INTERVAL);
    return () => clearInterval(poll);
  }, [fetchAssessments]);

  // Derived counts
  const allottedCount  = assessments.length;
  const completedCount = assessments.filter(a => String(a.status).toUpperCase() === "COMPLETED").length;
  const activeCount    = assessments.filter(a => canEnterExam(a)).length;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#0f1117" }}>
      {/* ── Header ── */}
      <div style={{
        height: 56, background: "#1a1d27", borderBottom: "1px solid #2e3347",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>👁️</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#e8eaf0" }}>3rdEyeZ360</span>
          <span style={{ fontSize: 12, color: "#8b90a0" }}>— Candidate Dashboard</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "#8b90a0" }}>{user?.name}</span>
          <LogoutButton />
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        {/* Welcome */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#e8eaf0" }}>
            Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h2>
          <p style={{ fontSize: 14, color: "#8b90a0", margin: 0 }}>
            Once the examiner starts your exam, the button below will automatically become active.
          </p>
        </div>

        {/* Stat cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16, marginBottom: 28,
        }}>
          <StatCard label="Assessments Allotted" value={allottedCount} color="#4f8ef7" />
          <StatCard label="Ready to Enter"        value={activeCount}    color="#34c97a" />
          <StatCard label="Completed"             value={completedCount} color="#f5a623" />
        </div>

        {/* Section header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 16, gap: 12,
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#e8eaf0", margin: 0 }}>
            Your Assessments
          </h3>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {lastUpdated && (
              <span style={{ fontSize: 11, color: "#555a6e" }}>
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            {refreshing && (
              <span style={{ fontSize: 11, color: "#4f8ef7" }}>Refreshing…</span>
            )}
            <button
              onClick={() => fetchAssessments(false)}
              disabled={loading || refreshing}
              className="btn btn-ghost"
              style={{ padding: "7px 14px", fontSize: 12 }}
            >
              {loading ? "Loading…" : "↻ Refresh"}
            </button>
          </div>
        </div>

        {/* States */}
        {loading ? (
          <div style={{
            textAlign: "center", color: "#8b90a0", padding: "60px 0",
            background: "#1a1d27", border: "1px solid #2e3347", borderRadius: 16,
          }}>
            Loading your assessments…
          </div>
        ) : error ? (
          <div style={{
            background: "#2a1010", border: "1px solid #f75f5f",
            color: "#f3c2c2", borderRadius: 12, padding: 16, fontSize: 14,
          }}>
            {error}
          </div>
        ) : assessments.length === 0 ? (
          <div style={{
            textAlign: "center", color: "#8b90a0", padding: "60px 24px",
            background: "#1a1d27", border: "1px solid #2e3347", borderRadius: 16,
          }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>📝</div>
            <div style={{ fontSize: 16, color: "#e8eaf0", marginBottom: 8 }}>
              No assessments assigned yet
            </div>
            <div style={{ fontSize: 13 }}>
              Your allotted assessments will appear here once an examiner assigns them.
            </div>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}>
            {assessments.map((exam) => {
              const chip      = getStatusChip(exam.status, exam.examstatus);
              const enterable = canEnterExam(exam);

              return (
                <div
                  key={exam.assessmentid}
                  style={{
                    background: "#1a1d27",
                    border: `1px solid ${enterable ? "#2a4060" : "#2e3347"}`,
                    borderRadius: 16, padding: 20,
                    display: "flex", flexDirection: "column", gap: 14,
                    boxShadow: enterable
                      ? "0 0 0 1px #4f8ef744, 0 10px 30px rgba(0,0,0,0.22)"
                      : "0 10px 30px rgba(0,0,0,0.18)",
                    transition: "border-color 0.3s, box-shadow 0.3s",
                  }}
                >
                  {/* Title + chip */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: "#e8eaf0", marginBottom: 6 }}>
                        {exam.name}
                      </div>
                      <div style={{ fontSize: 12, color: "#8b90a0", lineHeight: 1.6 }}>
                        {exam.date} · {exam.starttime} – {exam.endtime}
                      </div>
                    </div>
                    <span style={{
                      background: chip.bg, color: chip.color,
                      padding: "4px 10px", borderRadius: 999,
                      fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
                    }}>
                      {chip.label}
                    </span>
                  </div>

                  {/* Description */}
                  <div style={{
                    fontSize: 13,
                    color: exam.description ? "#c8cad0" : "#8b90a0",
                    lineHeight: 1.6, minHeight: 40,
                  }}>
                    {exam.description || "No additional description provided for this assessment."}
                  </div>

                  {/* Meta grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div style={{ background: "#22263a", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontSize: 11, color: "#8b90a0", marginBottom: 4 }}>Duration</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#e8eaf0" }}>
                        {exam.durationminutes} mins
                      </div>
                    </div>
                    <div style={{ background: "#22263a", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontSize: 11, color: "#8b90a0", marginBottom: 4 }}>Allowed Sites</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#e8eaf0" }}>
                        {exam.allowedwebsites.length}
                      </div>
                    </div>
                  </div>

                  {/* IDs / statuses */}
                  <div style={{
                    background: "#22263a", borderRadius: 10, padding: "10px 12px",
                    fontSize: 12, color: "#8b90a0", lineHeight: 1.8,
                  }}>
                    Assessment ID: <span style={{ color: "#c8cad0" }}>{exam.assessmentid}</span>
                    <br />
                    Assessment Status:{" "}
                    <span style={{ color: chip.color, fontWeight: 600 }}>{exam.status}</span>
                    <br />
                    Exam Status:{" "}
                    <span style={{
                      color: String(exam.examstatus).toLowerCase() === "running" ? "#34c97a" : "#c8cad0",
                      fontWeight: String(exam.examstatus).toLowerCase() === "running" ? 700 : 400,
                    }}>
                      {exam.examstatus || "—"}
                    </span>
                  </div>

                  {/* CTA */}
                  {enterable ? (
                    <button
                      onClick={() => onEnterExam(exam)}
                      className="btn btn-primary"
                      style={{ width: "100%", padding: "12px 0", fontSize: 14 }}
                    >
                      Enter Exam Hall →
                    </button>
                  ) : (
                    <button
                      disabled
                      className="btn btn-ghost"
                      style={{
                        width: "100%", padding: "12px 0", fontSize: 13,
                        opacity: 0.4, cursor: "not-allowed",
                      }}
                    >
                      {String(exam.status).toUpperCase() === "COMPLETED"
                        ? "✅ Completed"
                        : String(exam.status).toUpperCase() === "TERMINATED"
                          ? "🛑 Terminated"
                          : String(exam.status).toUpperCase() === "LOCKED"
                            ? "🔒 Locked"
                            : "⏳ Waiting for Exam to Start"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}