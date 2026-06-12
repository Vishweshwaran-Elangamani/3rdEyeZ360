from ultralytics import YOLO
import os

model = None

def load_model():
    global model
    model_path = os.getenv("YOLO_MODEL_PATH", "./models/yolov8n.pt")
    model = YOLO(model_path)

def detect_phone(frame):
    if model is None:
        load_model()
    results = model(frame, verbose=False)[0]
    for box in results.boxes:
        cls = int(box.cls[0])
        conf = float(box.conf[0])
        if cls == 67 and conf > 0.5:
            return {"detected": True, "detail": "phone_detected", "confidence": conf}
    return {"detected": False, "detail": "ok", "confidence": 1.0}