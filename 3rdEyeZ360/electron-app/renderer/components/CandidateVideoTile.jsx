import React, { useEffect, useRef } from "react";

export default function CandidateVideoTile({
  candidate,
  stream,
  connectionState,
  selected,
  onClick,
  theme,
}) {
  const videoRef = useRef(null);

  const isLive = Boolean(
    stream && ["connected", "completed"].includes(connectionState),
  );

  const borderColor = selected
    ? theme.accent
    : isLive
      ? theme.success
      : theme.borderStrong;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = stream || null;

    if (stream) {
      video.play().catch((error) => {
        console.log("Candidate video autoplay failed", error);
      });
    }

    return () => {
      if (video.srcObject === stream) {
        video.srcObject = null;
      }
    };
  }, [stream]);

  const candidateName = candidate?.candidatename || "Candidate";
  const candidateInitial = String(candidateName)
    .trim()
    .charAt(0)
    .toUpperCase();

  const statusText = (() => {
    if (isLive) return "Live";
    if (connectionState === "requesting") return "Connecting camera...";
    if (connectionState === "connecting") return "Connecting camera...";
    if (connectionState === "failed") return "Camera connection failed";
    if (connectionState === "disconnected") return "Camera disconnected";
    return "No camera signal";
  })();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open monitoring details for ${candidateName}`}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        minHeight: 150,
        padding: 0,
        overflow: "hidden",
        borderRadius: 16,
        border: `2px solid ${borderColor}`,
        background: "#080a12",
        cursor: "pointer",
        boxShadow: selected
          ? `0 0 0 3px ${theme.accent}25`
          : "none",
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        transition:
          "border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: stream ? "block" : "none",
          background: "#080a12",
        }}
      />

      {!stream ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            color: theme.textMuted,
            background:
              theme.name === "light"
                ? "linear-gradient(135deg, #eef1fb, #dfe5f5)"
                : "linear-gradient(135deg, #101421, #080a12)",
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: theme.accentGradientSoft,
              border: `1px solid ${theme.borderAccent}`,
              color: theme.accent,
              fontSize: 21,
              fontWeight: 800,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {candidateInitial}
          </div>

          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: theme.textMuted,
            }}
          >
            {statusText}
          </div>
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "34px 12px 11px",
          background:
            "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.84) 72%)",
          color: "#ffffff",
          textAlign: "left",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              flexShrink: 0,
              background: isLive ? "#3ecf8e" : "#74809b",
              boxShadow: isLive ? "0 0 8px #3ecf8e" : "none",
            }}
          />

          <span
            style={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: 13,
              fontWeight: 750,
              textShadow: "0 1px 3px rgba(0,0,0,0.85)",
            }}
          >
            {candidateName}
          </span>

          <span
            style={{
              marginLeft: "auto",
              flexShrink: 0,
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: 0.7,
              textTransform: "uppercase",
              color: isLive ? "#7ff0b8" : "rgba(255,255,255,0.65)",
            }}
          >
            {isLive ? "Live" : "Offline"}
          </span>
        </div>
      </div>
    </button>
  );
}
