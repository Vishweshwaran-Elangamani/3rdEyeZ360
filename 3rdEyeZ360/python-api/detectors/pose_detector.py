import mediapipe as mp
import cv2

mp_face_mesh = mp.solutions.face_mesh
mesh = mp_face_mesh.FaceMesh(static_image_mode=False, max_num_faces=1, min_detection_confidence=0.6)

def detect_pose(frame):
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = mesh.process(rgb)
    if not results.multi_face_landmarks:
        return {"detected": False, "detail": "no_face", "confidence": 0.0}
    landmarks = results.multi_face_landmarks[0].landmark
    nose = landmarks[1]
    if abs(nose.x - 0.5) > 0.12:
        direction = "looking_left" if nose.x < 0.5 else "looking_right"
        return {"detected": True, "detail": direction, "confidence": 0.85}
    if nose.y > 0.65:
        return {"detected": True, "detail": "looking_down", "confidence": 0.80}
    return {"detected": False, "detail": "ok", "confidence": 1.0}