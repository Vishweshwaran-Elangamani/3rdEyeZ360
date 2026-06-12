import mediapipe as mp
import cv2

mp_face = mp.solutions.face_detection
detector = mp_face.FaceDetection(model_selection=0, min_detection_confidence=0.6)

def detect_faces(frame):
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = detector.process(rgb)
    if not results.detections:
        return {"detected": True, "count": 0, "detail": "face_missing", "confidence": 0.99}
    count = len(results.detections)
    if count > 1:
        return {"detected": True, "count": count, "detail": "multiple_faces", "confidence": 0.95}
    return {"detected": False, "count": 1, "detail": "ok", "confidence": 1.0}