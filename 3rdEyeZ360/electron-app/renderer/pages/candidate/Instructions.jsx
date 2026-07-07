import React, { useMemo, useState, useRef, useEffect } from "react";

const RULES = [
  "👁️  Keep your face clearly visible in the camera at all times",
  "📵  No mobile phones or secondary devices on your desk",
  "👥  Ensure you are alone — no other person should be visible",
  "🔇  Stay in a quiet room — background voices will be flagged",
  "🖥️  Only the allowed exam websites will be accessible",
  "⚡  Keep your laptop charger connected throughout",
  "🚫  Do not attempt to close, minimize, or switch windows",
  "👀  Keep your eyes focused on the screen",
  "💬  Use the chat button if you need to contact the examiner",
  "⏳  You will receive friendly guidance before any violation is recorded",
];

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

function normalizeList(...sources) {
  const unique = new Set();

  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const item of source) {
      const value = String(item ?? "").trim();
      if (value) unique.add(value);
    }
  }

  return Array.from(unique);
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value) !== "") {
      return value;
    }
  }
  return "";
}

function getAssessmentStatus(source) {
  return String(source?.status ?? source?.assessmentstatus ?? "").toUpperCase();
}

function getExamStatus(source) {
  return String(
    source?.examstatus ?? source?.exam_status ?? source?.status_exam ?? source?.status ?? ""
  ).toUpperCase();
}

export default function Instructions({
  exam,
  assessment,
  onStart,
  onBack,
  onLogout,
}) {
  const [agreed, setAgreed] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");

  const launchAttemptRef = useRef(false);
  const launchTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (launchTimeoutRef.current) {
        clearTimeout(launchTimeoutRef.current);
      }
    };
  }, []);

  const sites = useMemo(() => {
    return normalizeList(
      exam?.allowedwebsites,
      exam?.allowed_websites,
      assessment?.allowedwebsites,
      assessment?.allowed_websites
    );
  }, [exam, assessment]);

  const apps = useMemo(() => {
    return normalizeList(
      exam?.allowedapplications,
      exam?.allowed_applications,
      assessment?.allowedapplications,
      assessment?.allowed_applications
    );
  }, [exam, assessment]);

  const examName = firstValue(exam?.name, assessment?.name, "Upcoming Exam");
  const examDate = firstValue(exam?.date, assessment?.date, "-");
  const startTime = firstValue(
    exam?.starttime,
    exam?.start_time,
    assessment?.starttime,
    assessment?.start_time,
    "-"
  );
  const endTime = firstValue(
    exam?.endtime,
    exam?.end_time,
    assessment?.endtime,
    assessment?.end_time,
    "-"
  );
  const duration = firstValue(
    exam?.durationminutes,
    exam?.duration_minutes,
    assessment?.durationminutes,
    assessment?.duration_minutes,
    "-"
  );
  const instructions = firstValue(exam?.instructions, assessment?.instructions, "");
  const examId = firstValue(exam?.examid, exam?.exam_id, assessment?.examid, assessment?.exam_id, "-");
  const assessmentId = firstValue(
    assessment?.assessmentid,
    assessment?.assessment_id,
    exam?.assessmentid,
    exam?.assessment_id,
    "-"
  );
  const assessmentStatus = getAssessmentStatus(assessment ?? exam) || "-";
  const examRuntimeStatus = getExamStatus(assessment ?? exam) || "-";
  const violationThreshold = firstValue(
    exam?.violationthreshold,
    exam?.violation_threshold,
    assessment?.violationthreshold,
    assessment?.violation_threshold,
    "-"
  );

  const canGoBack = typeof onBack === "function";

  const handleStart = async () => {
    if (!agreed || launching || launchAttemptRef.current) return;

    launchAttemptRef.current = true;
    setLaunching(true);
    setError("");

    if (launchTimeoutRef.current) {
      clearTimeout(launchTimeoutRef.current);
    }

    launchTimeoutRef.current = setTimeout(() => {
      setLaunching(false);
      launchAttemptRef.current = false;
      setError("The workspace is taking longer than expected to open. Please try again.");
    }, 12000);

    try {
      await onStart?.();
    } catch (e) {
      console.log("Instructions launch failed", e);

      if (launchTimeoutRef.current) {
        clearTimeout(launchTimeoutRef.current);
        launchTimeoutRef.current = null;
      }

      setError("Unable to launch the exam workspace right now. Please try again.");
      setLaunching(false);
      launchAttemptRef.current = false;
      return;
    }

    if (launchTimeoutRef.current) {
      clearTimeout(launchTimeoutRef.current);
      launchTimeoutRef.current = null;
    }

    setLaunching(false);
    launchAttemptRef.current = false;
  };

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
        </div>
        <LogoutButton onLogout={onLogout} />
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <div
          style={{
            background: "#1a1d27",
            border: "1px solid #2e3347",
            borderRadius: 16,
            width: "min(760px, 100%)",
            maxHeight: "calc(100vh - 96px)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
          }}
        >
          <div
            style={{
              padding: 32,
              overflowY: "auto",
              minHeight: 0,
            }}
          >
            <div
              style={{
                background: "#0f2a1a",
                border: "1px solid #34c97a",
                borderRadius: 10,
                padding: "14px 16px",
                marginBottom: 24,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>📋</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: "#e8eaf0" }}>
                    {examName}
                  </div>
                  <div style={{ fontSize: 12, color: "#8b90a0" }}>
                    {examDate} · {startTime} – {endTime} · {duration} mins
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 8,
                  fontSize: 12,
                  color: "#c8cad0",
                }}
              >
                <div>
                  <strong>Exam ID:</strong> {examId}
                </div>
                <div>
                  <strong>Assessment ID:</strong> {assessmentId}
                </div>
                <div>
                  <strong>Assessment Status:</strong> {assessmentStatus}
                </div>
                <div>
                  <strong>Exam Status:</strong> {examRuntimeStatus}
                </div>
                <div>
                  <strong>Violation Threshold:</strong> {violationThreshold}
                </div>
              </div>
            </div>

            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 16,
                color: "#e8eaf0",
              }}
            >
              Exam Instructions
            </h2>

            {instructions ? (
              <div
                style={{
                  background: "#22263a",
                  borderRadius: 8,
                  padding: "12px 16px",
                  fontSize: 13,
                  color: "#c8cad0",
                  marginBottom: 16,
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {instructions}
              </div>
            ) : (
              <div
                style={{
                  background: "#22263a",
                  border: "1px solid #2e3347",
                  borderRadius: 8,
                  padding: "12px 16px",
                  fontSize: 13,
                  color: "#aeb4c3",
                  marginBottom: 16,
                  lineHeight: 1.7,
                }}
              >
                No extra written instructions were provided for this exam.
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#e8eaf0",
                  marginBottom: 10,
                }}
              >
                Allowed exam websites
              </div>

              {sites.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  {sites.map((site, i) => (
                    <div
                      key={`${site}-${i}`}
                      style={{
                        background: "#10243a",
                        border: "1px solid #2d4f75",
                        color: "#8fc2ff",
                        borderRadius: 999,
                        padding: "6px 12px",
                        fontSize: 12,
                      }}
                    >
                      🌐 {site}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    background: "#2a2010",
                    border: "1px solid #5c4621",
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: 12,
                    color: "#d8b36a",
                  }}
                >
                  No allowed websites were configured for this exam.
                </div>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#e8eaf0",
                  marginBottom: 10,
                }}
              >
                Allowed applications
              </div>

              {apps.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  {apps.map((app, i) => (
                    <div
                      key={`${app}-${i}`}
                      style={{
                        background: "#1e2435",
                        border: "1px solid #3a4057",
                        color: "#d9deea",
                        borderRadius: 999,
                        padding: "6px 12px",
                        fontSize: 12,
                      }}
                    >
                      🧩 {app}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    background: "#22263a",
                    border: "1px solid #2e3347",
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: 12,
                    color: "#aeb4c3",
                  }}
                >
                  No specific applications were configured for this exam.
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginBottom: 24,
              }}
            >
              {RULES.map((rule, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 13,
                    color: "#c8cad0",
                    padding: "8px 12px",
                    background: "#22263a",
                    borderRadius: 6,
                    lineHeight: 1.5,
                  }}
                >
                  {rule}
                </div>
              ))}
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                cursor: "pointer",
                marginBottom: 14,
                fontSize: 14,
                color: "#e8eaf0",
              }}
            >
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                disabled={launching}
                style={{
                  width: 18,
                  height: 18,
                  cursor: launching ? "not-allowed" : "pointer",
                  marginTop: 2,
                  flexShrink: 0,
                }}
              />
              <span>I have read and understood all the instructions</span>
            </label>

            {error ? (
              <div
                style={{
                  marginBottom: 20,
                  background: "#2a1010",
                  border: "1px solid #f75f5f",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 13,
                  color: "#f3b0b0",
                }}
              >
                {error}
              </div>
            ) : null}

            {launching ? (
              <div
                style={{
                  marginBottom: 20,
                  background: "#10243a",
                  border: "1px solid #2d4f75",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 13,
                  color: "#8fc2ff",
                }}
              >
                Preparing your monitored exam workspace...
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => onBack?.()}
                disabled={!canGoBack || launching}
                className="btn btn-ghost"
                style={{
                  flex: 1,
                  padding: "12px 0",
                  fontSize: 15,
                  border: "1px solid #3a4057",
                  borderRadius: 10,
                  background: "#22263a",
                  color: "#e8eaf0",
                  cursor: !canGoBack || launching ? "not-allowed" : "pointer",
                  opacity: !canGoBack || launching ? 0.45 : 1,
                }}
              >
                ← Back
              </button>

              <button
                onClick={handleStart}
                disabled={!agreed || launching}
                className="btn btn-primary"
                style={{
                  flex: 1.4,
                  padding: "12px 0",
                  fontSize: 15,
                  opacity: agreed && !launching ? 1 : 0.4,
                  cursor: agreed && !launching ? "pointer" : "not-allowed",
                }}
              >
                {launching ? "Launching..." : "Launch Exam Workspace →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}