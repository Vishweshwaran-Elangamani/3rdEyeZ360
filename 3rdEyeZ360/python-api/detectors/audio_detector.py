from utils.audio_utils import decode_audio, has_speech, get_rms

def detect_audio(audio_chunk_b64: str):
    try:
        audio, sr = decode_audio(audio_chunk_b64)
        rms = get_rms(audio)
        if rms < 0.005:
            return {"detected": True, "detail": "mic_silent", "confidence": 0.9}
        if has_speech(audio):
            if rms > 0.08:
                return {"detected": True, "detail": "loud_noise", "confidence": 0.85}
            return {"detected": True, "detail": "background_speech", "confidence": 0.75}
        return {"detected": False, "detail": "ok", "confidence": 1.0}
    except Exception:
        return {"detected": False, "detail": "ok", "confidence": 0.0}