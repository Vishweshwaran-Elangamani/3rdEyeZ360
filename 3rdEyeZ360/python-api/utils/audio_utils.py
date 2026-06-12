import base64
import numpy as np

def decode_audio(base64_string: str, sr=16000):
    audio_bytes = base64.b64decode(base64_string)
    audio_array = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    return audio_array, sr

def get_rms(audio_array) -> float:
    return float(np.sqrt(np.mean(audio_array**2)))

def has_speech(audio_array, rms_threshold=0.02) -> bool:
    return get_rms(audio_array) > rms_threshold