let stream = null,
  promise = null;
export async function getCameraStream() {
  if (stream?.active) return stream;
  if (promise) return promise;
  if (!navigator.mediaDevices?.getUserMedia)
    throw new Error("Camera access is unavailable.");
  promise = navigator.mediaDevices
    .getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 360 },
        frameRate: { ideal: 15, max: 20 },
        facingMode: "user",
      },
      audio: false,
    })
    .then((s) => ((stream = s), s))
    .finally(() => (promise = null));
  return promise;
}
export function stopCameraStream() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  promise = null;
}
