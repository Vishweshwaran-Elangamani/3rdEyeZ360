from datetime import datetime
import socketio

from config.database import get_db
from middleware.auth import decode_token


sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)

connected_users = {}


def _utc_iso() -> str:
    return datetime.utcnow().isoformat()


@sio.event
async def connect(sid, environ, auth):
    token = (auth or {}).get("token", "")
    if not token:
        print("[Socket] Rejected - no token")
        return False

    try:
        user = await decode_token(token)
        connected_users[sid] = user
        print(f"[Socket] Connected: {user.get('email')} ({user.get('role')})")
    except Exception as e:
        print(f"[Socket] Auth failed: {e}")
        return False


@sio.event
async def disconnect(sid):
    user = connected_users.pop(sid, {})
    print(f"[Socket] Disconnected: {user.get('email', sid)}")


@sio.event
async def joinexam(sid, data):
    user = connected_users.get(sid)
    if not user:
        return

    examid = (data or {}).get("examid", "")
    if not examid:
        return

    db = get_db()
    await sio.enter_room(sid, f"exam_{examid}_all")

    if user.get("role") in ("Examiner", "Admin"):
        exam = await db.exams.find_one({"examid": examid})
        if user.get("role") == "Examiner" and (not exam or exam.get("examinerid") != user.get("userid")):
            return

        await sio.enter_room(sid, f"exam_{examid}_examiners")
        print(f"[Socket] Examiner joined exam_{examid}")
        return

    if user.get("role") == "Candidate":
        assessment = await db.assessments.find_one({
            "examid": examid,
            "candidateid": user.get("userid"),
        })
        if not assessment:
            return

        await sio.enter_room(sid, f"candidate_{user.get('userid')}")
        await sio.emit(
            "candidateupdate",
            {
                "candidateid": user.get("userid"),
                "online": True,
                "timestamp": _utc_iso(),
            },
            room=f"exam_{examid}_examiners",
        )
        print(f"[Socket] Candidate {user.get('userid')} joined exam_{examid}")


@sio.event
async def startexam(sid, data):
    user = connected_users.get(sid)
    if not user or user.get("role") not in ("Examiner", "Admin"):
        return

    examid = (data or {}).get("examid", "")
    if not examid:
        return

    db = get_db()
    exam = await db.exams.find_one({"examid": examid})
    if not exam:
        return

    if user.get("role") == "Examiner" and exam.get("examinerid") != user.get("userid"):
        return

    await sio.emit(
        "examstarted",
        {
            "examid": examid,
            "timestamp": _utc_iso(),
        },
        room=f"exam_{examid}_all",
    )

    await sio.emit(
        "assessmentupdated",
        {
            "examid": examid,
            "status": "Running",
            "timestamp": _utc_iso(),
        },
        room=f"exam_{examid}_examiners",
    )

    print(f"[Socket] Exam started for exam_{examid}")


@sio.event
async def examinercontrol(sid, data):
    user = connected_users.get(sid)
    if not user or user.get("role") not in ("Examiner", "Admin"):
        return

    examid = (data or {}).get("examid", "")
    candidateid = (data or {}).get("candidateid", "")
    action = (data or {}).get("action", "")

    if not examid or not candidateid or action not in ("pause", "resume", "terminate"):
        return

    db = get_db()
    exam = await db.exams.find_one({"examid": examid})
    if not exam:
        return

    if user.get("role") == "Examiner" and exam.get("examinerid") != user.get("userid"):
        return

    await sio.emit(
        "controlcommand",
        {"action": action, "examid": examid, "candidateid": candidateid},
        room=f"candidate_{candidateid}",
    )

    await sio.emit(
        "assessmentupdated",
        {
            "examid": examid,
            "candidateid": candidateid,
            "action": action,
            "timestamp": _utc_iso(),
        },
        room=f"exam_{examid}_examiners",
    )

    print(f"[Socket] Control '{action}' sent to candidate_{candidateid} in exam_{examid}")


@sio.event
async def broadcastmessage(sid, data):
    user = connected_users.get(sid)
    if not user or user.get("role") not in ("Examiner", "Admin"):
        return

    examid = (data or {}).get("examid", "")
    message = (data or {}).get("message", "").strip()

    if not examid or not message:
        return

    db = get_db()
    exam = await db.exams.find_one({"examid": examid})
    if not exam:
        return

    if user.get("role") == "Examiner" and exam.get("examinerid") != user.get("userid"):
        return

    payload = {
        "examid": examid,
        "message": message,
        "from": user.get("name") or user.get("email") or "Examiner",
        "timestamp": _utc_iso(),
    }

    await sio.emit("broadcastmessage", payload, room=f"exam_{examid}_all")
    print(f"[Socket] Broadcast sent in exam_{examid}")


@sio.event
async def reentrydecision(sid, data):
    user = connected_users.get(sid)
    if not user or user.get("role") not in ("Examiner", "Admin"):
        return

    examid = (data or {}).get("examid", "")
    assessmentid = (data or {}).get("assessmentid", "")
    approved = bool((data or {}).get("approved", False))

    if not examid or not assessmentid:
        return

    db = get_db()
    exam = await db.exams.find_one({"examid": examid})
    if not exam:
        return

    if user.get("role") == "Examiner" and exam.get("examinerid") != user.get("userid"):
        return

    assessment = await db.assessments.find_one({"assessmentid": assessmentid})
    if not assessment:
        return

    candidateid = assessment.get("candidateid")
    if not candidateid:
        return

    await sio.emit(
        "reentrydecision",
        {
            "assessmentid": assessmentid,
            "examid": examid,
            "approved": approved,
            "candidateid": candidateid,
            "timestamp": _utc_iso(),
        },
        room=f"candidate_{candidateid}",
    )

    await sio.emit(
        "assessmentupdated",
        {
            "assessmentid": assessmentid,
            "examid": examid,
            "candidateid": candidateid,
            "approved": approved,
            "timestamp": _utc_iso(),
        },
        room=f"exam_{examid}_examiners",
    )

    print(f"[Socket] Re-entry decision sent for assessment_{assessmentid}")


async def emit_violation_alert(examid, candidateid, violation):
    await sio.emit(
        "violationalert",
        {
            "candidateid": candidateid,
            "violation": violation,
            "timestamp": _utc_iso(),
        },
        room=f"exam_{examid}_examiners",
    )


async def emit_lock_candidate(candidateid, reason=None):
    await sio.emit(
        "youarelocked",
        {
            "locked": True,
            "reason": reason or "Assessment locked due to violations.",
            "timestamp": _utc_iso(),
        },
        room=f"candidate_{candidateid}",
    )


async def emit_assessment_update(examid, payload=None):
    data = {"examid": examid, "timestamp": _utc_iso()}
    if payload and isinstance(payload, dict):
        data.update(payload)

    await sio.emit("assessmentupdated", data, room=f"exam_{examid}_examiners")