import { getCameraStream, stopCameraStream } from "./cameraStream";

const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

let socket = null;
let identity = null;
let mediaStream = null;

const peers = new Map();
const pendingIce = new Map();
let cameraReadyTimer = null;

const log = (...args) => console.log("[Candidate WebRTC]", ...args);
const logError = (...args) => console.error("[Candidate WebRTC]", ...args);

const examinerKey = (payload = {}) =>
  String(payload.examinerid ?? payload.examiner_id ?? "examiner");

const value = (payload, compactName, snakeName) =>
  payload?.[compactName] ?? payload?.[snakeName];

const sameValue = (left, right) =>
  left !== undefined &&
  left !== null &&
  right !== undefined &&
  right !== null &&
  String(left) === String(right);

function matchesCurrentCandidate(payload = {}) {
  const payloadExamId = value(payload, "examid", "exam_id");
  const payloadCandidateId = value(payload, "candidateid", "candidate_id");
  const matches = Boolean(
    identity &&
      sameValue(payloadExamId, identity.examid) &&
      sameValue(payloadCandidateId, identity.candidateid),
  );

  if (!matches) {
    log("payload ignored because identity did not match", {
      payloadExamId,
      payloadCandidateId,
      identity,
    });
  }

  return matches;
}

function emit(eventName, payload) {
  if (!socket?.connected) {
    log("emit skipped because socket is disconnected", {
      eventName,
      socketId: socket?.id,
      connected: socket?.connected,
    });
    return false;
  }

  log("emitting", eventName, payload);
  socket.emit(eventName, payload);
  return true;
}

function closePeer(key, notify = false) {
  const peer = peers.get(key);

  if (peer) {
    log("closing peer", {
      key,
      connectionState: peer.connectionState,
      iceConnectionState: peer.iceConnectionState,
      signalingState: peer.signalingState,
    });

    peer.onicecandidate = null;
    peer.onconnectionstatechange = null;
    peer.oniceconnectionstatechange = null;

    try {
      peer.close();
    } catch (error) {
      logError("peer close failed", error);
    }
  }

  peers.delete(key);
  pendingIce.delete(key);

  if (notify && identity) {
    emit("webrtc_camera_status", {
      ...identity,
      examinerid: key,
      status: "closed",
    });
  }
}

function removeSocketListeners(targetSocket = socket) {
  if (!targetSocket) return;

  log("removing socket listeners", {
    socketId: targetSocket.id,
    connected: targetSocket.connected,
  });

  targetSocket.off("webrtc_request_stream", handleStreamRequest);
  targetSocket.off("webrtc_answer", handleAnswer);
  targetSocket.off("webrtc_ice_candidate", handleIceCandidate);
  targetSocket.off("webrtc_stop_stream", handleStopStream);
  targetSocket.off("connect", handleSocketConnect);
  targetSocket.off("disconnect", handleSocketDisconnect);
}

function addSocketListeners(targetSocket) {
  if (!targetSocket) return;

  removeSocketListeners(targetSocket);
  targetSocket.on("webrtc_request_stream", handleStreamRequest);
  targetSocket.on("webrtc_answer", handleAnswer);
  targetSocket.on("webrtc_ice_candidate", handleIceCandidate);
  targetSocket.on("webrtc_stop_stream", handleStopStream);
  targetSocket.on("connect", handleSocketConnect);
  targetSocket.on("disconnect", handleSocketDisconnect);

  log("socket listeners attached", {
    socketId: targetSocket.id,
    connected: targetSocket.connected,
    identity,
  });
}

function cameraIsLive() {
  const videoTracks = mediaStream?.getVideoTracks?.() || [];
  return Boolean(
    mediaStream?.active &&
      videoTracks.some((track) => track.readyState === "live"),
  );
}

function cameraSnapshot() {
  return {
    streamActive: mediaStream?.active,
    tracks: (mediaStream?.getTracks?.() || []).map((track) => ({
      kind: track.kind,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState,
      label: track.label,
    })),
  };
}

async function ensureCameraStream() {
  if (cameraIsLive()) {
    log("reusing live camera stream", cameraSnapshot());
    return mediaStream;
  }

  log("requesting camera stream");
  mediaStream = await getCameraStream();
  log("camera stream acquired", cameraSnapshot());
  return mediaStream;
}

function announceCameraReady() {
  if (!identity || !cameraIsLive()) {
    log("camera-ready announcement skipped", {
      identity,
      camera: cameraSnapshot(),
    });
    return false;
  }

  log("announcing camera ready", {
    socketId: socket?.id,
    connected: socket?.connected,
    identity,
    camera: cameraSnapshot(),
  });

  return emit("webrtc_camera_ready", {
    ...identity,
    camera: true,
  });
}

function stopCameraReadyAnnouncements() {
  if (cameraReadyTimer) {
    window.clearInterval(cameraReadyTimer);
    cameraReadyTimer = null;
  }
}

function startCameraReadyAnnouncements() {
  stopCameraReadyAnnouncements();
  announceCameraReady();

  cameraReadyTimer = window.setInterval(() => {
    if (socket?.connected && identity && cameraIsLive()) {
      announceCameraReady();
    }
  }, 3000);
}

function handleSocketConnect() {
  log("socket connected/reconnected", {
    socketId: socket?.id,
    identity,
  });
  startCameraReadyAnnouncements();
}

function handleSocketDisconnect(reason) {
  log("socket disconnected", {
    reason,
    socketId: socket?.id,
    identity,
  });
}

async function handleStreamRequest(payload = {}) {
  log("stream request received", payload);

  if (!matchesCurrentCandidate(payload) || !socket) {
    log("stream request rejected", {
      hasSocket: Boolean(socket),
      identity,
      payload,
    });
    return;
  }

  const key = examinerKey(payload);
  closePeer(key, false);

  try {
    const stream = await ensureCameraStream();
    const peer = new RTCPeerConnection(rtcConfig);
    peers.set(key, peer);

    for (const track of stream.getTracks()) {
      log("adding local track to peer", {
        key,
        kind: track.kind,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
      });
      peer.addTrack(track, stream);
    }

    peer.onicecandidate = (event) => {
      if (peers.get(key) !== peer) return;

      if (!event.candidate) {
        log("ICE gathering complete", { key });
        return;
      }

      log("sending ICE candidate", {
        key,
        candidateType: event.candidate.type,
        protocol: event.candidate.protocol,
      });

      emit("webrtc_ice_candidate", {
        ...identity,
        examinerid: value(payload, "examinerid", "examiner_id"),
        target: "examiner",
        candidate: event.candidate.toJSON(),
      });
    };

    peer.onconnectionstatechange = () => {
      if (peers.get(key) !== peer) return;

      log("peer connection state changed", {
        key,
        connectionState: peer.connectionState,
        iceConnectionState: peer.iceConnectionState,
        signalingState: peer.signalingState,
      });

      emit("webrtc_camera_status", {
        ...identity,
        examinerid: value(payload, "examinerid", "examiner_id"),
        status: peer.connectionState,
      });

      if (
        peer.connectionState === "failed" ||
        peer.connectionState === "closed"
      ) {
        closePeer(key, false);
      }
    };

    peer.oniceconnectionstatechange = () => {
      if (peers.get(key) !== peer) return;

      log("ICE connection state changed", {
        key,
        iceConnectionState: peer.iceConnectionState,
      });

      if (peer.iceConnectionState === "failed") {
        closePeer(key, false);
      }
    };

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    log("sending offer", {
      key,
      identity,
      examinerid: value(payload, "examinerid", "examiner_id"),
      signalingState: peer.signalingState,
      sdpLength: peer.localDescription?.sdp?.length,
    });

    emit("webrtc_offer", {
      ...identity,
      examinerid: value(payload, "examinerid", "examiner_id"),
      offer: peer.localDescription.toJSON(),
    });
  } catch (error) {
    logError("failed to create/send offer", error);
    closePeer(key, false);
  }
}

async function handleAnswer(payload = {}) {
  log("answer received", payload);

  if (!matchesCurrentCandidate(payload) || !payload.answer) {
    log("answer rejected", { identity, payload });
    return;
  }

  const key = examinerKey(payload);
  const peer = peers.get(key);

  if (!peer || peer.signalingState === "closed") {
    log("answer ignored because peer was unavailable", {
      key,
      peerExists: Boolean(peer),
      signalingState: peer?.signalingState,
    });
    return;
  }

  try {
    await peer.setRemoteDescription(payload.answer);
    log("remote answer applied", {
      key,
      signalingState: peer.signalingState,
      connectionState: peer.connectionState,
    });

    for (const candidate of pendingIce.get(key) || []) {
      await peer.addIceCandidate(candidate);
    }
    pendingIce.delete(key);
  } catch (error) {
    logError("failed to apply answer", error);
  }
}

async function handleIceCandidate(payload = {}) {
  log("ICE candidate received", payload);

  if (
    !matchesCurrentCandidate(payload) ||
    payload.target !== "candidate" ||
    !payload.candidate
  ) {
    log("ICE candidate rejected", { identity, payload });
    return;
  }

  const key = examinerKey(payload);
  const peer = peers.get(key);

  if (!peer || !peer.remoteDescription) {
    log("queueing ICE candidate", {
      key,
      peerExists: Boolean(peer),
      hasRemoteDescription: Boolean(peer?.remoteDescription),
    });
    pendingIce.set(key, [
      ...(pendingIce.get(key) || []),
      payload.candidate,
    ]);
    return;
  }

  try {
    await peer.addIceCandidate(payload.candidate);
    log("ICE candidate applied", { key });
  } catch (error) {
    logError("failed to apply ICE candidate", error);
  }
}

function handleStopStream(payload = {}) {
  log("stop-stream request received", payload);
  if (!matchesCurrentCandidate(payload)) return;
  closePeer(examinerKey(payload), false);
}

export async function startCandidateWebRTC(options = {}) {
  const nextSocket = options.socket;
  const nextExamId = options.examid;
  const nextCandidateId = options.candidateid;

  log("start/rebind requested", {
    socketId: nextSocket?.id,
    connected: nextSocket?.connected,
    examid: nextExamId,
    assessmentid: options.assessmentid,
    candidateid: nextCandidateId,
  });

  if (!nextSocket || !nextExamId || !nextCandidateId) {
    log("start/rebind aborted because required values were missing");
    return null;
  }

  const nextIdentity = {
    examid: nextExamId,
    assessmentid: options.assessmentid,
    candidateid: nextCandidateId,
  };

  const identityChanged =
    !identity ||
    String(identity.examid) !== String(nextIdentity.examid) ||
    String(identity.candidateid) !== String(nextIdentity.candidateid);

  if (socket && socket !== nextSocket) {
    log("moving listeners to a new socket", {
      oldSocketId: socket.id,
      newSocketId: nextSocket.id,
    });
    removeSocketListeners(socket);
  }

  socket = nextSocket;
  identity = nextIdentity;
  addSocketListeners(socket);

  if (identityChanged) {
    log("identity changed; closing old peers", {
      identity,
      peerCount: peers.size,
    });
    for (const key of [...peers.keys()]) {
      closePeer(key, false);
    }
  }

  try {
    mediaStream = await ensureCameraStream();
    log("started/rebound", {
      socketId: socket.id,
      connected: socket.connected,
      identity,
      camera: cameraSnapshot(),
    });
    startCameraReadyAnnouncements();
    return mediaStream;
  } catch (error) {
    logError("start/rebind failed", error);
    throw error;
  }
}

export function stopCandidateWebRTC() {
  stopCameraReadyAnnouncements();
  log("full shutdown requested", {
    identity,
    peerCount: peers.size,
    camera: cameraSnapshot(),
  });

  for (const key of [...peers.keys()]) {
    closePeer(key, false);
  }

  removeSocketListeners(socket);
  stopCameraStream();

  socket = null;
  identity = null;
  mediaStream = null;
  pendingIce.clear();
}
