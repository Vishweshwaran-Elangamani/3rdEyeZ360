from utils.audio_utils import decode_audio, has_speech, get_rms


# Microphone is considered silent below this RMS value.
MIC_SILENT_RMS_THRESHOLD = 0.005

# These thresholds remain available for when noise detection is enabled again.
HIGH_NOISE_RMS_THRESHOLD = 0.08
LOW_SPEECH_RMS_THRESHOLD = 0.012

# Temporary testing switch.
#
# True:
#   - Background speech is ignored.
#   - High noise is ignored.
#   - Both return "ok".
#   - No noise toast, warning, violation, or count is created.
#
# False:
#   - Normal background speech and high-noise detection is enabled.
IGNORE_BACKGROUND_NOISE = True


def _result(
    detected: bool,
    detail: str,
    confidence: float,
    message: str,
    candidate_action: str | None,
):
    """
    Creates a standard audio detection response.
    """

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


def _ok_result(
    message: str = "Audio monitoring check passed.",
    confidence: float = 1.0,
):
    """
    Creates a normal audio result.

    Results returned through this function will not be treated
    as warnings or violations by Electron and the backend.
    """

    return _result(
        detected=False,
        detail="ok",
        confidence=confidence,
        message=message,
        candidate_action=None,
    )


def detect_audio(audio_chunk_b64: str):
    """
    Detects audio-monitoring conditions from a Base64 audio chunk.

    Possible detail values:
      - ok
      - mic_silent
      - background_speech
      - high_noise

    Current testing behaviour:
      - mic_silent remains enabled.
      - background_speech is ignored.
      - high_noise is ignored.

    To restore normal background-noise detection, change:

        IGNORE_BACKGROUND_NOISE = False
    """

    try:
        # Convert the Base64 audio chunk into audio samples.
        audio, sample_rate = decode_audio(audio_chunk_b64)

        # Calculate the audio energy/volume.
        rms = float(get_rms(audio) or 0.0)

        # Check whether speech activity exists.
        speech_detected = bool(has_speech(audio))

        print(
            "[AUDIO] Metrics",
            {
                "sample_rate": sample_rate,
                "rms": round(rms, 6),
                "speech_detected": speech_detected,
                "ignore_background_noise": IGNORE_BACKGROUND_NOISE,
            },
        )

        # Keep microphone-silence detection active.
        if rms < MIC_SILENT_RMS_THRESHOLD:
            print(
                "[AUDIO] Microphone silence detected",
                {
                    "rms": round(rms, 6),
                    "threshold": MIC_SILENT_RMS_THRESHOLD,
                },
            )

            return _result(
                detected=True,
                detail="mic_silent",
                confidence=0.90,
                message=(
                    "Microphone input is very low. "
                    "Please check your microphone."
                ),
                candidate_action=(
                    "Check that your microphone is connected and working."
                ),
            )

        # High-volume speech or surrounding noise.
        if speech_detected and rms > HIGH_NOISE_RMS_THRESHOLD:
            if IGNORE_BACKGROUND_NOISE:
                print(
                    "[AUDIO] High background noise ignored for testing",
                    {
                        "rms": round(rms, 6),
                        "threshold": HIGH_NOISE_RMS_THRESHOLD,
                    },
                )

                return _ok_result(
                    message="High background noise was ignored during testing.",
                    confidence=1.0,
                )

            return _result(
                detected=True,
                detail="high_noise",
                confidence=0.85,
                message=(
                    "High background noise detected. "
                    "Please reduce surrounding noise."
                ),
                candidate_action="Reduce surrounding noise.",
            )

        # Speech detected at low or medium volume.
        if speech_detected:
            if IGNORE_BACKGROUND_NOISE:
                print(
                    "[AUDIO] Background speech ignored for testing",
                    {
                        "rms": round(rms, 6),
                    },
                )

                return _ok_result(
                    message="Background speech was ignored during testing.",
                    confidence=1.0,
                )

            confidence = 0.75

            if rms > LOW_SPEECH_RMS_THRESHOLD:
                confidence = 0.82

            return _result(
                detected=True,
                detail="background_speech",
                confidence=confidence,
                message=(
                    "Background speech detected. "
                    "Please stay in a quiet environment."
                ),
                candidate_action=(
                    "Move to a quiet place or ask others to stop speaking."
                ),
            )

        # Microphone is working and no speech/noise issue was detected.
        return _ok_result()

    except Exception as error:
        print(
            "[AUDIO] Detection failed",
            {
                "error": str(error),
            },
        )

        # Fail safely. An audio-processing error must not create
        # an incorrect candidate warning or violation.
        return _ok_result(
            message="Audio monitoring check could not be completed.",
            confidence=0.0,
        )