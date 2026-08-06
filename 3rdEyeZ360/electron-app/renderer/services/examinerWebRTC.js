import { useCallback, useEffect, useRef, useState } from "react";
const cfg = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
export default function useExaminerWebRTC(socket, examid, examinerid) {
  const peers = useRef(new Map()),
    pending = useRef(new Map()),
    [streams, setStreams] = useState({}),
    [states, setStates] = useState({});
  const closeCandidate = useCallback(
    (id, notify = true) => {
      const k = String(id);
      peers.current.get(k)?.close();
      peers.current.delete(k);
      pending.current.delete(k);
      setStreams((x) => {
        const n = { ...x };
        delete n[k];
        return n;
      });
      setStates((x) => ({ ...x, [k]: "closed" }));
      if (notify && socket && examid)
        socket.emit("webrtc_stop_stream", {
          examid,
          candidateid: id,
          examinerid,
        });
    },
    [socket, examid, examinerid],
  );
  const requestStream = useCallback(
    (candidateid, assessmentid) => {
      if (!socket || !examid || !candidateid) return;
      closeCandidate(candidateid, false);
      setStates((x) => ({ ...x, [String(candidateid)]: "requesting" }));
      socket.emit("webrtc_request_stream", {
        examid,
        assessmentid,
        candidateid,
        examinerid,
      });
    },
    [socket, examid, examinerid, closeCandidate],
  );
  useEffect(() => {
    if (!socket || !examid) return;
    const offer = async (p) => {
      if (String(p.examid ?? p.exam_id) !== String(examid) || !p.offer) return;
      const id = p.candidateid ?? p.candidate_id,
        k = String(id);
      closeCandidate(k, false);
      const pc = new RTCPeerConnection(cfg);
      peers.current.set(k, pc);
      setStates((x) => ({ ...x, [k]: "connecting" }));
      pc.ontrack = (e) =>
        setStreams((x) => ({
          ...x,
          [k]: e.streams?.[0] || new MediaStream([e.track]),
        }));
      pc.onicecandidate = (e) =>
        e.candidate &&
        socket.emit("webrtc_ice_candidate", {
          examid,
          candidateid: id,
          examinerid,
          target: "candidate",
          candidate: e.candidate.toJSON(),
        });
      pc.onconnectionstatechange = () =>
        setStates((x) => ({ ...x, [k]: pc.connectionState }));
      await pc.setRemoteDescription(p.offer);
      await pc.setLocalDescription(await pc.createAnswer());
      socket.emit("webrtc_answer", {
        examid,
        candidateid: id,
        examinerid,
        answer: pc.localDescription.toJSON(),
      });
      for (const c of pending.current.get(k) || []) await pc.addIceCandidate(c);
      pending.current.delete(k);
    };
    const ice = async (p) => {
      if (
        p.target !== "examiner" ||
        String(p.examid ?? p.exam_id) !== String(examid) ||
        !p.candidate
      )
        return;
      const k = String(p.candidateid ?? p.candidate_id),
        pc = peers.current.get(k);
      if (!pc?.remoteDescription) {
        pending.current.set(k, [
          ...(pending.current.get(k) || []),
          p.candidate,
        ]);
        return;
      }
      await pc.addIceCandidate(p.candidate);
    };
    const status = (p) => {
      if (String(p.examid ?? p.exam_id) === String(examid)) {
        const id = p.candidateid ?? p.candidate_id;
        if (id)
          setStates((x) => ({ ...x, [String(id)]: p.status || "unknown" }));
      }
    };
    socket.on("webrtc_offer", offer);
    socket.on("webrtc_ice_candidate", ice);
    socket.on("webrtc_camera_status", status);
    return () => {
      socket.off("webrtc_offer", offer);
      socket.off("webrtc_ice_candidate", ice);
      socket.off("webrtc_camera_status", status);
      peers.current.forEach((p) => p.close());
      peers.current.clear();
      pending.current.clear();
    };
  }, [socket, examid, examinerid, closeCandidate]);
  return { streams, states, requestStream, closeCandidate };
}
