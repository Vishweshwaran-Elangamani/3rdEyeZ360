import React, { useEffect, useMemo, useRef, useState } from "react";

export default function CandidateVideoTile({
  candidate,
  stream,
  connectionState,
  selected,
  onClick,
  theme,
}) {
  const videoRef = useRef(null);
  const attachedStreamRef = useRef(null);
  const playAttemptRef = useRef(0);
  const retryTimerRef = useRef(null);
  const [videoPlaying, setVideoPlaying] = useState(false);

  const hasLiveVideoTrack = useMemo(
    () =>
      Boolean(
        stream
          ?.getVideoTracks?.()
          .some((track) => track.readyState === "live"),
      ),
    [stream],
  );

  const isLive =
    hasLiveVideoTrack &&
    videoPlaying &&
    connectionState !== "failed" &&
    connectionState !== "closed";

  const borderColor = selected
    ? theme.accent
    : isLive
      ? theme.success
      : theme.borderStrong;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    let disposed = false;
    const attemptId = ++playAttemptRef.current;

    const clearRetry = () => {
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const tryPlay = async () => {
      if (
        disposed ||
        attemptId !== playAttemptRef.current ||
        !video.srcObject ||
        !hasLiveVideoTrack
      ) {
        return;
      }

      try {
        await video.play();
        if (!disposed && attemptId === playAttemptRef.current) {
          setVideoPlaying(true);
        }
      } catch (error) {
        if (disposed || attemptId !== playAttemptRef.current) return;

        if (error?.name === "AbortError") {
          clearRetry();
          retryTimerRef.current = window.setTimeout(tryPlay, 150);
          return;
        }

        if (error?.name !== "NotAllowedError") {
          console.log("Candidate video playback failed", error);
        }
        setVideoPlaying(false);
      }
    };

    const handlePlaying = () => {
      if (!disposed && attemptId === playAttemptRef.current) {
        setVideoPlaying(true);
      }
    };

    const handlePause = () => {
      if (!disposed && attemptId === playAttemptRef.current) {
        setVideoPlaying(false);
      }
    };

    const handleEnded = () => {
      if (!disposed && attemptId === playAttemptRef.current) {
        setVideoPlaying(false);
      }
    };

    const handleLoadedMetadata = () => {
      void tryPlay();
    };

    video.addEventListener("playing", handlePlaying);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);

    if (stream && attachedStreamRef.current !== stream) {
      attachedStreamRef.current = stream;
      video.srcObject = stream;
      setVideoPlaying(false);
    } else if (!stream && attachedStreamRef.current !== null) {
      attachedStreamRef.current = null;
      video.srcObject = null;
      setVideoPlaying(false);
    }

    if (stream && video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      void tryPlay();
    }

    return () => {
      disposed = true;
      clearRetry();
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [stream, hasLiveVideoTrack]);

  useEffect(() => {
    return () => {
      playAttemptRef.current += 1;
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }

      const video = videoRef.current;
      if (video) {
        video.pause();
        video.srcObject = null;
      }
      attachedStreamRef.current = null;
    };
  }, []);

  const candidateName = candidate?.candidatename || "Candidate";
  const candidateInitial = String(candidateName)
    .trim()
    .charAt(0)
    .toUpperCase();

  const statusText = (() => {
    if (isLive) return "Live";
    if (hasLiveVideoTrack) return "Starting video...";
    if (
      connectionState === "requesting" ||
      connectionState === "connecting" ||
      connectionState === "retrying" ||
      connectionState === "new"
    ) {
      return "Connecting camera...";
    }
    if (connectionState === "failed") return "Camera connection failed";
    if (connectionState === "disconnected") return "Camera reconnecting...";
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
        backgroundColor: "#080a12",
        cursor: "pointer",
        boxShadow: selected ? `0 0 0 3px ${theme.accent}25` : "none",
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
        disablePictureInPicture
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: hasLiveVideoTrack ? "block" : "none",
          backgroundColor: "#080a12",
        }}
      />

      {!isLive ? (
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
              backgroundColor: isLive ? "#3ecf8e" : "#74809b",
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
