import { useCallback, useEffect, useRef, useState } from "react";

const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const RETRY_DELAY_MS = 1500;
const REQUEST_TIMEOUT_MS = 8000;

export default function useExaminerWebRTC(socket, examid, examinerid) {
  const peersRef = useRef(new Map());
  const pendingIceRef = useRef(new Map());
  const assessmentIdsRef = useRef(new Map());
  const requestTimersRef = useRef(new Map());
  const retryTimersRef = useRef(new Map());
  const requestStreamRef = useRef(null);

  const [streams, setStreams] = useState({});
  const [states, setStates] = useState({});

  const clearRequestTimer = useCallback((key) => {
    const timer = requestTimersRef.current.get(key);
    if (timer) window.clearTimeout(timer);
    requestTimersRef.current.delete(key);
  }, []);

  const clearRetryTimer = useCallback((key) => {
    const timer = retryTimersRef.current.get(key);
    if (timer) window.clearTimeout(timer);
    retryTimersRef.current.delete(key);
  }, []);

  const disposePeer = useCallback(
    (candidateId, options = {}) => {
      const {
        notify = false,
        removeStream = true,
        nextState = "closed",
      } = options;
      if (!candidateId) return;

      const key = String(candidateId);
      const peer = peersRef.current.get(key);

      clearRequestTimer(key);
      clearRetryTimer(key);

      if (peer) {
        try {
          peer.ontrack = null;
          peer.onicecandidate = null;
          peer.onconnectionstatechange = null;
          peer.oniceconnectionstatechange = null;
          peer.close();
        } catch (error) {
          console.log("Failed to close candidate peer connection", error);
        }
      }

      peersRef.current.delete(key);
      pendingIceRef.current.delete(key);

      if (removeStream) {
        setStreams((previous) => {
          if (!previous[key]) return previous;
          const next = { ...previous };
          delete next[key];
          return next;
        });
      }

      if (nextState) {
        setStates((previous) => ({ ...previous, [key]: nextState }));
      }

      if (notify && socket && examid) {
        socket.emit("webrtc_stop_stream", {
          examid,
          candidateid: candidateId,
          examinerid,
        });
      }
    },
    [socket, examid, examinerid, clearRequestTimer, clearRetryTimer],
  );

  const closeCandidate = useCallback(
    (candidateId, notify = true) => {
      disposePeer(candidateId, {
        notify,
        removeStream: true,
        nextState: "closed",
      });
    },
    [disposePeer],
  );

  const scheduleRetry = useCallback(
    (candidateId, assessmentId) => {
      if (!candidateId || !socket || !examid) return;
      const key = String(candidateId);
      clearRetryTimer(key);

      const timer = window.setTimeout(() => {
        retryTimersRef.current.delete(key);
        requestStreamRef.current?.(candidateId, assessmentId, true);
      }, RETRY_DELAY_MS);

      retryTimersRef.current.set(key, timer);
    },
    [socket, examid, clearRetryTimer],
  );

  const requestStream = useCallback(
    (candidateId, assessmentId, force = false) => {
      if (!socket || !examid || !candidateId) return false;

      const key = String(candidateId);
      if (assessmentId) assessmentIdsRef.current.set(key, assessmentId);

      const peer = peersRef.current.get(key);
      const currentState = peer?.connectionState;
      const currentStream = streams[key];
      const hasLiveVideo = Boolean(
        currentStream
          ?.getVideoTracks?.()
          .some((track) => track.readyState === "live"),
      );

      if (
        !force &&
        (hasLiveVideo ||
          ["new", "connecting", "connected"].includes(currentState) ||
          ["requesting", "connecting", "connected"].includes(states[key]))
      ) {
        return false;
      }

      disposePeer(candidateId, {
        notify: false,
        removeStream: force || !hasLiveVideo,
        nextState: null,
      });

      setStates((previous) => ({ ...previous, [key]: "requesting" }));

      socket.emit("webrtc_request_stream", {
        examid,
        assessmentid: assessmentId || assessmentIdsRef.current.get(key),
        candidateid: candidateId,
        examinerid,
      });

      clearRequestTimer(key);
      const timeout = window.setTimeout(() => {
        requestTimersRef.current.delete(key);
        const latestPeer = peersRef.current.get(key);
        const latestState = latestPeer?.connectionState;
        if (!["connected"].includes(latestState)) {
          setStates((previous) => ({ ...previous, [key]: "retrying" }));
          scheduleRetry(
            candidateId,
            assessmentId || assessmentIdsRef.current.get(key),
          );
        }
      }, REQUEST_TIMEOUT_MS);
      requestTimersRef.current.set(key, timeout);
      return true;
    },
    [
      socket,
      examid,
      examinerid,
      streams,
      states,
      disposePeer,
      clearRequestTimer,
      scheduleRetry,
    ],
  );

  requestStreamRef.current = requestStream;

  useEffect(() => {
    if (!socket || !examid) return undefined;

    const handleOffer = async (payload) => {
      const payloadExamId = payload?.examid ?? payload?.exam_id;
      if (String(payloadExamId) !== String(examid) || !payload?.offer) return;

      const candidateId = payload?.candidateid ?? payload?.candidate_id;
      const assessmentId = payload?.assessmentid ?? payload?.assessment_id;
      if (!candidateId) return;

      const key = String(candidateId);
      if (assessmentId) assessmentIdsRef.current.set(key, assessmentId);

      try {
        clearRequestTimer(key);
        clearRetryTimer(key);
        disposePeer(candidateId, {
          notify: false,
          removeStream: false,
          nextState: null,
        });

        const peer = new RTCPeerConnection(rtcConfig);
        peersRef.current.set(key, peer);
        setStates((previous) => ({ ...previous, [key]: "connecting" }));

        peer.ontrack = (event) => {
          if (peersRef.current.get(key) !== peer) return;
          const incomingStream =
            event.streams?.[0] || new MediaStream([event.track]);

          setStreams((previous) => ({ ...previous, [key]: incomingStream }));
          setStates((previous) => ({ ...previous, [key]: "connected" }));

          for (const track of incomingStream.getVideoTracks()) {
            track.onunmute = () => {
              if (peersRef.current.get(key) === peer) {
                setStates((previous) => ({
                  ...previous,
                  [key]: "connected",
                }));
              }
            };
            track.onended = () => {
              if (peersRef.current.get(key) === peer) {
                disposePeer(candidateId, {
                  notify: false,
                  removeStream: true,
                  nextState: "retrying",
                });
                scheduleRetry(
                  candidateId,
                  assessmentId || assessmentIdsRef.current.get(key),
                );
              }
            };
          }
        };

        peer.onicecandidate = (event) => {
          if (!event.candidate || peersRef.current.get(key) !== peer) return;
          socket.emit("webrtc_ice_candidate", {
            examid,
            assessmentid:
              assessmentId || assessmentIdsRef.current.get(key),
            candidateid: candidateId,
            examinerid,
            target: "candidate",
            candidate: event.candidate.toJSON(),
          });
        };

        peer.onconnectionstatechange = () => {
          if (peersRef.current.get(key) !== peer) return;
          const connectionState = peer.connectionState;

          if (connectionState === "connected") {
            clearRequestTimer(key);
            clearRetryTimer(key);
            setStates((previous) => ({
              ...previous,
              [key]: "connected",
            }));
            return;
          }

          if (connectionState === "failed" || connectionState === "closed") {
            disposePeer(candidateId, {
              notify: false,
              removeStream: true,
              nextState: "retrying",
            });
            scheduleRetry(
              candidateId,
              assessmentId || assessmentIdsRef.current.get(key),
            );
            return;
          }

          if (connectionState !== "disconnected") {
            setStates((previous) => ({
              ...previous,
              [key]: connectionState,
            }));
          }
        };

        peer.oniceconnectionstatechange = () => {
          if (peersRef.current.get(key) !== peer) return;
          if (["connected", "completed"].includes(peer.iceConnectionState)) {
            clearRequestTimer(key);
            clearRetryTimer(key);
            setStates((previous) => ({
              ...previous,
              [key]: "connected",
            }));
          }
        };

        await peer.setRemoteDescription(payload.offer);
        await peer.setLocalDescription(await peer.createAnswer());

        socket.emit("webrtc_answer", {
          examid,
          assessmentid: assessmentId || assessmentIdsRef.current.get(key),
          candidateid: candidateId,
          examinerid,
          answer: peer.localDescription.toJSON(),
        });

        for (const candidate of pendingIceRef.current.get(key) || []) {
          await peer.addIceCandidate(candidate);
        }
        pendingIceRef.current.delete(key);
      } catch (error) {
        console.log("Failed to process candidate WebRTC offer", error);
        disposePeer(candidateId, {
          notify: false,
          removeStream: true,
          nextState: "retrying",
        });
        scheduleRetry(
          candidateId,
          assessmentId || assessmentIdsRef.current.get(key),
        );
      }
    };

    const handleIce = async (payload) => {
      const payloadExamId = payload?.examid ?? payload?.exam_id;
      if (
        payload?.target !== "examiner" ||
        String(payloadExamId) !== String(examid) ||
        !payload?.candidate
      ) {
        return;
      }

      const candidateId = payload?.candidateid ?? payload?.candidate_id;
      if (!candidateId) return;
      const key = String(candidateId);
      const peer = peersRef.current.get(key);

      if (!peer || peer.signalingState === "closed" || !peer.remoteDescription) {
        pendingIceRef.current.set(key, [
          ...(pendingIceRef.current.get(key) || []),
          payload.candidate,
        ]);
        return;
      }

      try {
        await peer.addIceCandidate(payload.candidate);
      } catch (error) {
        console.log("Failed to process examiner ICE candidate", error);
      }
    };

    const handleStatus = (payload) => {
      const payloadExamId = payload?.examid ?? payload?.exam_id;
      if (String(payloadExamId) !== String(examid)) return;
      const candidateId = payload?.candidateid ?? payload?.candidate_id;
      const assessmentId = payload?.assessmentid ?? payload?.assessment_id;
      if (!candidateId) return;

      const key = String(candidateId);
      if (assessmentId) assessmentIdsRef.current.set(key, assessmentId);
      const nextStatus = payload?.status || "unknown";

      if (["failed", "closed"].includes(nextStatus)) {
        disposePeer(candidateId, {
          notify: false,
          removeStream: true,
          nextState: "retrying",
        });
        scheduleRetry(
          candidateId,
          assessmentId || assessmentIdsRef.current.get(key),
        );
        return;
      }

      if (nextStatus !== "disconnected") {
        setStates((previous) => ({ ...previous, [key]: nextStatus }));
      }
    };

    const handleCameraReady = (payload) => {
      const payloadExamId = payload?.examid ?? payload?.exam_id;
      if (String(payloadExamId) !== String(examid)) return;
      const candidateId = payload?.candidateid ?? payload?.candidate_id;
      const assessmentId = payload?.assessmentid ?? payload?.assessment_id;
      if (!candidateId) return;

      const key = String(candidateId);
      if (assessmentId) assessmentIdsRef.current.set(key, assessmentId);

      window.setTimeout(() => {
        requestStreamRef.current?.(
          candidateId,
          assessmentId || assessmentIdsRef.current.get(key),
          true,
        );
      }, 150);
    };

    socket.on("webrtc_offer", handleOffer);
    socket.on("webrtc_ice_candidate", handleIce);
    socket.on("webrtc_camera_status", handleStatus);
    socket.on("webrtc_camera_ready", handleCameraReady);

    return () => {
      socket.off("webrtc_offer", handleOffer);
      socket.off("webrtc_ice_candidate", handleIce);
      socket.off("webrtc_camera_status", handleStatus);
      socket.off("webrtc_camera_ready", handleCameraReady);

      for (const timer of requestTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      for (const timer of retryTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      requestTimersRef.current.clear();
      retryTimersRef.current.clear();

      for (const candidateId of [...peersRef.current.keys()]) {
        disposePeer(candidateId, {
          notify: false,
          removeStream: true,
          nextState: null,
        });
      }
      peersRef.current.clear();
      pendingIceRef.current.clear();
      assessmentIdsRef.current.clear();
    };
  }, [
    socket,
    examid,
    examinerid,
    disposePeer,
    scheduleRetry,
    clearRequestTimer,
    clearRetryTimer,
  ]);

  return {
    streams,
    states,
    requestStream,
    closeCandidate,
  };
}
