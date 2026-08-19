from utils.audio_utils import decode_audio, has_speech, get_rms


MIC_SILENT_RMS_THRESHOLD = 0.005
HIGH_NOISE_RMS_THRESHOLD = 0.08
LOW_SPEECH_RMS_THRESHOLD = 0.012


def _result(
    detected: bool,
    detail: str,
    confidence: float,
    message: str,
    candidate_action: str | None,
):
    return {
        "detected": detected,
        "detail": detail,
        "confidence": confidence,
        "category": "voice",
        "issue": None if detail == "ok" else detail,
        "message": message,
        "candidate_action": candidate_action,
        "typing_sensitive": False,
    }


def detect_audio(audio_chunk_b64: str):
    """
    Detects audio monitoring issues from a base64 audio chunk.

    Returns detail values:
      ok
      mic_silent
      background_speech
      high_noise

    Notes:
      - This detector intentionally returns detailed fields so Electron and backend
        can show clear candidate-facing correction messages.
      - It keeps the existing utils.audio_utils decode_audio, has_speech and get_rms flow.
    """
    try:
        audio, sr = decode_audio(audio_chunk_b64)
        rms = float(get_rms(audio) or 0.0)
        speech_detected = bool(has_speech(audio))

        print(
            "[AUDIO] Metrics",
            {
                "sample_rate": sr,
                "rms": round(rms, 6),
                "speech_detected": speech_detected,
            },
        )

        if rms < MIC_SILENT_RMS_THRESHOLD:
            return _result(
                True,
                "mic_silent",
                0.90,
                "Microphone input is very low. Please check your microphone.",
                "Check that your microphone is connected and working.",
            )

        # If speech is detected and volume is high, classify as high_noise.
        # Previous code returned loud_noise, but backend policy uses high_noise.
        if speech_detected and rms > HIGH_NOISE_RMS_THRESHOLD:
            return _result(
                True,
                "high_noise",
                0.85,
                "High background noise detected. Please reduce surrounding noise.",
                "Reduce surrounding noise.",
            )

        if speech_detected:
            confidence = 0.75
            if rms > LOW_SPEECH_RMS_THRESHOLD:
                confidence = 0.82

            return _result(
                True,
                "background_speech",
                confidence,
                "Background speech detected. Please stay in a quiet environment.",
                "Move to a quiet place or ask others to stop speaking.",
            )

        return _result(
            False,
            "ok",
            1.0,
            "Audio monitoring check passed.",
            None,
        )

    except Exception as error:
        print("[AUDIO] Detection failed:", error)
        return _result(
            False,
            "ok",
            0.0,
            "Audio monitoring check could not be completed.",
            None,
        )