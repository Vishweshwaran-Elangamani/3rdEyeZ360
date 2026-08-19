from ultralytics import YOLO
import os


model = None

PHONE_CLASS_ID = 67
PHONE_CONFIDENCE_THRESHOLD = float(os.getenv("PHONE_CONFIDENCE_THRESHOLD", "0.5"))


def load_model():
    global model
    model_path = os.getenv("YOLO_MODEL_PATH", "./models/yolov8n.pt")
    print("[PHONE] Loading YOLO model", {"model_path": model_path})
    model = YOLO(model_path)


def _result(
    detected: bool,
    detail: str,
    confidence: float,
    message: str,
    candidate_action: str | None,
    box_count: int = 0,
):
    return {
        "detected": detected,
        "detail": detail,
        "confidence": confidence,
        "box_count": box_count,
        "category": "device",
        "issue": None if detail == "ok" else detail,
        "message": message,
        "candidate_action": candidate_action,
        "typing_sensitive": False,
    }


def detect_phone(frame):
    """
    Detects mobile phone visibility using YOLO.

    Returns:
        {
            "detected": bool,
            "detail": "phone_detected" | "ok" | "phone_error",
            "confidence": float,
            "category": "device",
            "issue": str | None,
            "message": str,
            "candidate_action": str | None,
            "typing_sensitive": False,
        }
    """
    global model

    try:
        if frame is None:
            print("[PHONE] Frame is None")
            return _result(
                False,
                "ok",
                0.0,
                "Phone monitoring check could not be completed because the camera frame was missing.",
                None,
            )

        if not hasattr(frame, "shape"):
            print("[PHONE] Invalid frame object")
            return _result(
                False,
                "ok",
                0.0,
                "Phone monitoring check could not be completed because the camera frame was invalid.",
                None,
            )

        if model is None:
            load_model()

        results = model(frame, verbose=False)[0]
        phone_candidates = []

        for box in results.boxes:
            cls = int(box.cls[0])
            conf = float(box.conf[0])

            if cls == PHONE_CLASS_ID:
                phone_candidates.append(conf)

            if cls == PHONE_CLASS_ID and conf >= PHONE_CONFIDENCE_THRESHOLD:
                print(
                    "[PHONE] Phone detected",
                    {
                        "class_id": cls,
                        "confidence": round(conf, 4),
                        "threshold": PHONE_CONFIDENCE_THRESHOLD,
                    },
                )
                return _result(
                    True,
                    "phone_detected",
                    round(conf, 4),
                    "Mobile phone detected. Please remove the phone from view.",
                    "Remove the phone from the camera view.",
                    box_count=len(phone_candidates),
                )

        print(
            "[PHONE] Phone OK",
            {
                "phone_candidates": len(phone_candidates),
                "threshold": PHONE_CONFIDENCE_THRESHOLD,
            },
        )
        return _result(
            False,
            "ok",
            1.0,
            "Phone monitoring check passed.",
            None,
            box_count=len(phone_candidates),
        )

    except Exception as error:
        print("[PHONE] Detector error:", error)
        return _result(
            False,
            "phone_error",
            0.0,
            "Phone detection could not be completed.",
            "Keep the camera view clear and continue the assessment.",
        )
