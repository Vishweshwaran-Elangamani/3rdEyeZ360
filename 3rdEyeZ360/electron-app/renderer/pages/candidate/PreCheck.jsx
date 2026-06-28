import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

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

function CheckItem({ label, status }) {
  const hint =
    status === false
      ? label === "Camera & Microphone"
        ? "Allow camera and microphone access"
        : label === "Internet Connection"
        ? "Check backend/server connection"
        : "Keep your face visible in the frame"
      : "";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        background: "#22263a",
        borderRadius: 8,
        border: `1px solid ${
          status === true ? "#34c97a" : status === false ? "#f75f5f" : "#2e3347"
        }`,
      }}
    >
      <span style={{ fontSize: 20 }}>
        {status === null ? "⏳" : status ? "✅" : "❌"}
      </span>

      <span style={{ fontSize: 14, color: "#e8eaf0" }}>{label}</span>

      {status === false && (
        <span
          style={{
            fontSize: 12,
            color: "#f75f5f",
            marginLeft: "auto",
            textAlign: "right",
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}

export default function PreCheck({ exam, onPass, onLogout }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const hasAutoStartedRef = useRef(false);

  const [checks, setChecks] = useState({
    camera: null,
    face: null,
    internet: null,
  });
  const [running, setRunning] = useState(false);

  const examView = useMemo(
    () => ({
      name: exam?.name || "Upcoming Exam",
      assessmentid: exam?.assessmentid || "-",
      examid: exam?.examid || "-",
      durationminutes: exam?.durationminutes || "-",
      date: exam?.date || "-",
      starttime: exam?.starttime || "-",
      endtime: exam?.endtime || "-",
      status: exam?.status || "-",
      examstatus: exam?.examstatus || "-",
      allowedwebsites: Array.isArray(exam?.allowedwebsites) ? exam.allowedwebsites : [],
      allowedapplications: Array.isArray(exam?.allowedapplications)
        ? exam.allowedapplications
        : [],
    }),
    [exam]
  );

  const stopMedia = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startChecks = useCallback(async () => {
    if (running) return;

    setRunning(true);
    setChecks({
      camera: null,
      face: null,
      internet: null,
    });

    const next = {
      camera: false,
      face: false,
      internet: false,
    };

    try {
      const res = await fetch("http://localhost:3000/health");
      next.internet = !!res.ok;
    } catch {
      next.internet = false;
    }
    setChecks((prev) => ({ ...prev, internet: next.internet }));

    try {
      stopMedia();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      next.camera = true;
      setChecks((prev) => ({ ...prev, camera: true }));

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const video = videoRef.current;
      const canSeeVideo =
        video &&
        typeof video.videoWidth === "number" &&
        typeof video.videoHeight === "number" &&
        video.videoWidth > 0 &&
        video.videoHeight > 0;

      next.face = !!canSeeVideo;
      setChecks((prev) => ({ ...prev, face: next.face }));
    } catch {
      next.camera = false;
      next.face = false;
      setChecks((prev) => ({ ...prev, camera: false, face: false }));
    } finally {
      setRunning(false);
    }
  }, [running, stopMedia]);

  useEffect(() => {
    if (hasAutoStartedRef.current) return;
    hasAutoStartedRef.current = true;
    startChecks();

    return () => {
      stopMedia();
    };
  }, [startChecks, stopMedia]);

  const allPassed = Object.values(checks).every((v) => v === true);

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
          <span style={{ fontWeight: 700, fontSize: 15, color: "#e8eaf0" }}>
            3rdEyeZ360
          </span>
        </div>
        <LogoutButton onLogout={onLogout} />
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 20,
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            background: "#1a1d27",
            border: "1px solid #2e3347",
            borderRadius: 16,
            padding: 40,
            width: "min(560px, 100%)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 6,
              color: "#e8eaf0",
            }}
          >
            System Check
          </h2>

          <p style={{ color: "#8b90a0", fontSize: 13, marginBottom: 18 }}>
            We need to verify your setup before the exam starts.
          </p>

          {exam && (
            <div
              style={{
                background: "#22263a",
                border: "1px solid #2e3347",
                borderRadius: 10,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  color: "#e8eaf0",
                  fontWeight: 700,
                  fontSize: 15,
                  marginBottom: 10,
                }}
              >
                {examView.name}
              </div>

              <div style={{ fontSize: 13, color: "#c7ccda", lineHeight: 1.7 }}>
                <div>
                  <strong>Assessment ID:</strong> {examView.assessmentid}
                </div>
                <div>
                  <strong>Exam ID:</strong> {examView.examid}
                </div>
                <div>
                  <strong>Duration:</strong> {examView.durationminutes} minutes
                </div>
                <div>
                  <strong>Date:</strong> {examView.date}
                </div>
                <div>
                  <strong>Time:</strong> {examView.starttime} - {examView.endtime}
                </div>
                <div>
                  <strong>Assessment Status:</strong> {examView.status}
                </div>
                <div>
                  <strong>Exam Status:</strong> {examView.examstatus}
                </div>
                <div>
                  <strong>Allowed Websites:</strong>{" "}
                  {examView.allowedwebsites.length > 0
                    ? examView.allowedwebsites.join(", ")
                    : "None"}
                </div>
                <div>
                  <strong>Allowed Applications:</strong>{" "}
                  {examView.allowedapplications.length > 0
                    ? examView.allowedapplications.join(", ")
                    : "None"}
                </div>
              </div>
            </div>
          )}

          <div
            style={{
              width: "100%",
              aspectRatio: "16/9",
              background: "#0f1117",
              borderRadius: 10,
              overflow: "hidden",
              marginBottom: 20,
              border: "1px solid #2e3347",
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 24,
            }}
          >
            <CheckItem label="Camera & Microphone" status={checks.camera} />
            <CheckItem label="Face Visible" status={checks.face} />
            <CheckItem label="Internet Connection" status={checks.internet} />
          </div>

          {running && (
            <p
              style={{
                color: "#8b90a0",
                fontSize: 13,
                textAlign: "center",
                marginBottom: 16,
              }}
            >
              Running checks...
            </p>
          )}

          {!running && !allPassed && (
            <button
              onClick={startChecks}
              className="btn btn-ghost"
              style={{ width: "100%", marginBottom: 12 }}
            >
              Retry Checks
            </button>
          )}

          <button
            onClick={onPass}
            disabled={!allPassed}
            className="btn btn-primary"
            style={{
              width: "100%",
              padding: "12px 0",
              fontSize: 15,
              opacity: allPassed ? 1 : 0.4,
              cursor: allPassed ? "pointer" : "not-allowed",
            }}
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}