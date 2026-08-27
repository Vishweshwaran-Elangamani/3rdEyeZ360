from __future__ import annotations

from datetime import datetime
from fastapi import HTTPException

SINGLE_SESSION = "SINGLE_SESSION"
MULTI_SESSION = "MULTI_SESSION"
EXAM_TYPES = {SINGLE_SESSION, MULTI_SESSION}
MAX_TIMEFRAMES = 4


def normalize_exam_type(value) -> str:
    normalized = str(value or SINGLE_SESSION).strip().upper().replace("-", "_").replace(" ", "_")
    aliases = {
        "SINGLE": SINGLE_SESSION,
        "STANDARD": SINGLE_SESSION,
        "NON_FLEXIBLE": SINGLE_SESSION,
        "MULTI": MULTI_SESSION,
        "FLEXIBLE": MULTI_SESSION,
    }
    normalized = aliases.get(normalized, normalized)
    if normalized not in EXAM_TYPES:
        raise HTTPException(status_code=400, detail="exam_type must be SINGLE_SESSION or MULTI_SESSION")
    return normalized


def _timeframe_value(item: dict, *keys) -> str:
    for key in keys:
        value = item.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def validate_timeframes(value) -> list[dict]:
    if not isinstance(value, list):
        raise HTTPException(status_code=400, detail="timeframes must be a list")
    if not 1 <= len(value) <= MAX_TIMEFRAMES:
        raise HTTPException(status_code=400, detail="A multi-session exam requires 1 to 4 timeframes")

    normalized = []
    for index, raw in enumerate(value, start=1):
        if not isinstance(raw, dict):
            raise HTTPException(status_code=400, detail=f"Timeframe {index} is invalid")
        date = _timeframe_value(raw, "date")
        start_time = _timeframe_value(raw, "start_time", "starttime")
        end_time = _timeframe_value(raw, "end_time", "endtime")
        if not date or not start_time or not end_time:
            raise HTTPException(status_code=400, detail=f"Timeframe {index} requires date, start_time, and end_time")
        try:
            start = datetime.fromisoformat(f"{date}T{start_time}")
            end = datetime.fromisoformat(f"{date}T{end_time}")
        except ValueError as error:
            raise HTTPException(status_code=400, detail=f"Timeframe {index} has an invalid date or time") from error
        if end <= start:
            raise HTTPException(status_code=400, detail=f"Timeframe {index} end time must be after start time")
        normalized.append({
            "date": date,
            "start_time": start_time,
            "starttime": start_time,
            "end_time": end_time,
            "endtime": end_time,
            "_start": start,
            "_end": end,
        })

    normalized.sort(key=lambda item: item["_start"])
    for index, current in enumerate(normalized):
        if index and current["_start"] < normalized[index - 1]["_end"]:
            raise HTTPException(status_code=400, detail="Flexible timeframes cannot overlap")

    return [
        {key: val for key, val in item.items() if not key.startswith("_")}
        for item in normalized
    ]


def prepare_exam_schedule(body: dict) -> dict:
    exam_type = normalize_exam_type(body.get("exam_type", body.get("examtype")))
    if exam_type == SINGLE_SESSION:
        date = str(body.get("date") or "").strip()
        start_time = str(body.get("start_time") or body.get("starttime") or "").strip()
        end_time = str(body.get("end_time") or body.get("endtime") or "").strip()
        if not date or not start_time or not end_time:
            raise HTTPException(status_code=400, detail="Exam date, start_time, and end_time are required")
        return {
            "exam_type": exam_type,
            "examtype": exam_type,
            "is_flexible": False,
            "isflexible": False,
            "timeframes": [],
            "flexible_intervals": [],
            "flexibleintervals": [],
            "date": date,
            "start_time": start_time,
            "starttime": start_time,
            "end_time": end_time,
            "endtime": end_time,
        }

    frames = validate_timeframes(
        body.get("timeframes", body.get("flexible_intervals", body.get("flexibleintervals", [])))
    )
    first = frames[0]
    return {
        "exam_type": exam_type,
        "examtype": exam_type,
        "is_flexible": True,
        "isflexible": True,
        "timeframes": frames,
        "flexible_intervals": frames,
        "flexibleintervals": frames,
        # Preserve existing consumers by exposing the first announced timeframe.
        "date": first["date"],
        "start_time": first["start_time"],
        "starttime": first["start_time"],
        "end_time": first["end_time"],
        "endtime": first["end_time"],
    }

FINAL_ASSESSMENT_STATUSES = {"COMPLETED", "TERMINATED", "LOCKED"}


def exam_type_of(exam: dict) -> str:
    return normalize_exam_type((exam or {}).get("examtype", (exam or {}).get("exam_type", SINGLE_SESSION)))


def is_multi_session_exam(exam: dict) -> bool:
    return exam_type_of(exam) == MULTI_SESSION


def is_assessment_finalized(assessment: dict) -> bool:
    if bool((assessment or {}).get("isfinalized", (assessment or {}).get("is_finalized", False))):
        return True
    status = str(
        (assessment or {}).get("finalstatus")
        or (assessment or {}).get("final_status")
        or (assessment or {}).get("status")
        or (assessment or {}).get("assessmentstatus")
        or ""
    ).strip().upper()
    return status in FINAL_ASSESSMENT_STATUSES


def participated_in_current_session(assessment: dict, session_number: int) -> bool:
    if is_assessment_finalized(assessment):
        return True
    entered_session = int(
        (assessment or {}).get("enteredexamsession")
        or (assessment or {}).get("entered_exam_session")
        or 0
    )
    return bool(
        (assessment or {}).get("hasenteredexam", (assessment or {}).get("has_entered_exam", False))
        and entered_session == int(session_number or 0)
    )
