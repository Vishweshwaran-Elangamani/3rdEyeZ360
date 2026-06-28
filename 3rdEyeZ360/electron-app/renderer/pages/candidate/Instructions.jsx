import React, { useMemo, useState } from "react";

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

export default function Instructions({
  exam,
  assessment,
  onStart,
  onBack,
  onLogout,
}) {
  const [agreed, setAgreed] = useState(false);

  const sites = useMemo(() => {
    if (Array.isArray(exam?.allowedwebsites)) return exam.allowedwebsites;
    if (Array.isArray(assessment?.allowedwebsites)) return assessment.allowedwebsites;
    return [];
  }, [exam, assessment]);

  const apps = useMemo(() => {
    if (Array.isArray(exam?.allowedapplications)) return exam.allowedapplications;
    if (Array.isArray(assessment?.allowedapplications)) return assessment.allowedapplications;
    return [];
  }, [exam, assessment]);

  const examName = exam?.name || assessment?.name || "Upcoming Exam";
  const examDate = exam?.date || assessment?.date || "-";
  const startTime = exam?.starttime || assessment?.starttime || "-";
  const endTime = exam?.endtime || assessment?.endtime || "-";
  const duration = exam?.durationminutes || assessment?.durationminutes || "-";
  const instructions = exam?.instructions || assessment?.instructions || "";
  const examId = exam?.examid || assessment?.examid || "-";
  const assessmentId = assessment?.assessmentid || exam?.assessmentid || "-";
  const examStatus = exam?.status || assessment?.status || "-";
  const violationThreshold =
    exam?.violationthreshold || assessment?.violationthreshold || "-";

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
                  <strong>Status:</strong> {examStatus}
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

            {instructions && (
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
                marginBottom: 24,
                fontSize: 14,
                color: "#e8eaf0",
              }}
            >
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{
                  width: 18,
                  height: 18,
                  cursor: "pointer",
                  marginTop: 2,
                  flexShrink: 0,
                }}
              />
              <span>I have read and understood all the instructions</span>
            </label>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={onBack}
                className="btn btn-ghost"
                style={{
                  flex: 1,
                  padding: "12px 0",
                  fontSize: 15,
                  border: "1px solid #3a4057",
                  borderRadius: 10,
                  background: "#22263a",
                  color: "#e8eaf0",
                  cursor: "pointer",
                }}
              >
                ← Back
              </button>

              <button
                onClick={() => {
                  if (!agreed) return;
                  onStart?.();
                }}
                disabled={!agreed}
                className="btn btn-primary"
                style={{
                  flex: 1.4,
                  padding: "12px 0",
                  fontSize: 15,
                  opacity: agreed ? 1 : 0.4,
                  cursor: agreed ? "pointer" : "not-allowed",
                }}
              >
                Launch Exam Workspace →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}