import { getCameraStream, stopCameraStream } from "./cameraStream";
const cfg = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
let sock = null,
  id = null,
  media = null;
const peers = new Map(),
  ice = new Map();
const key = (p) => String(p.examinerid ?? p.examiner_id ?? "examiner");
const matches = (p) =>
  id &&
  String(p.examid ?? p.exam_id) === String(id.examid) &&
  String(p.candidateid ?? p.candidate_id) === String(id.candidateid);
function close(k) {
  peers.get(k)?.close();
  peers.delete(k);
  ice.delete(k);
}
async function request(p) {
  if (!matches(p) || !sock) return;
  const k = key(p);
  close(k);
  media = media?.active ? media : await getCameraStream();
  const pc = new RTCPeerConnection(cfg);
  peers.set(k, pc);
  media.getTracks().forEach((t) => pc.addTrack(t, media));
  pc.onicecandidate = (e) =>
    e.candidate &&
    sock.emit("webrtc_ice_candidate", {
      ...id,
      examinerid: p.examinerid ?? p.examiner_id,
      target: "examiner",
      candidate: e.candidate.toJSON(),
    });
  pc.onconnectionstatechange = () =>
    sock.emit("webrtc_camera_status", {
      ...id,
      examinerid: p.examinerid ?? p.examiner_id,
      status: pc.connectionState,
    });
  await pc.setLocalDescription(await pc.createOffer());
  sock.emit("webrtc_offer", {
    ...id,
    examinerid: p.examinerid ?? p.examiner_id,
    offer: pc.localDescription.toJSON(),
  });
}
async function answer(p) {
  if (!matches(p)) return;
  const pc = peers.get(key(p));
  if (!pc || !p.answer) return;
  await pc.setRemoteDescription(p.answer);
  for (const c of ice.get(key(p)) || []) await pc.addIceCandidate(c);
  ice.delete(key(p));
}
async function candidate(p) {
  if (!matches(p) || p.target !== "candidate" || !p.candidate) return;
  const k = key(p),
    pc = peers.get(k);
  if (!pc?.remoteDescription) {
    ice.set(k, [...(ice.get(k) || []), p.candidate]);
    return;
  }
  await pc.addIceCandidate(p.candidate);
}
function stop(p) {
  if (matches(p)) close(key(p));
}
export async function startCandidateWebRTC(x) {
  if (!x.socket || !x.examid || !x.candidateid) return;
  sock = x.socket;
  id = {
    examid: x.examid,
    assessmentid: x.assessmentid,
    candidateid: x.candidateid,
  };
  media = await getCameraStream();
  [
    ["webrtc_request_stream", request],
    ["webrtc_answer", answer],
    ["webrtc_ice_candidate", candidate],
    ["webrtc_stop_stream", stop],
  ].forEach(([e, h]) => {
    sock.off(e, h);
    sock.on(e, h);
  });
  sock.emit("webrtc_camera_ready", { ...id, camera: true });
  return media;
}
export function stopCandidateWebRTC() {
  for (const k of [...peers.keys()]) close(k);
  stopCameraStream();
  sock = null;
  id = null;
  media = null;
}
