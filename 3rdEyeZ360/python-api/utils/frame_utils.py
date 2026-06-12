import base64
import numpy as np
import cv2

def decode_frame(base64_string: str) -> np.ndarray:
    img_bytes = base64.b64decode(base64_string)
    np_arr = np.frombuffer(img_bytes, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    return frame

def resize_frame(frame: np.ndarray, width=640) -> np.ndarray:
    h, w = frame.shape[:2]
    ratio = width / w
    return cv2.resize(frame, (width, int(h * ratio)))