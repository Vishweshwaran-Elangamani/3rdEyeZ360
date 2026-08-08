from datetime import date, datetime
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
        user_id = user.get("userid") or user.get("user_id")
        if user_id:
            await sio.enter_room(sid, f"user_{user_id}")
            if user.get("role") == "Candidate":
                await sio.enter_room(sid, f"candidate_{user_id}")
            elif user.get("role") == "Examiner":
                await sio.enter_room(sid, f"examiner_{user_id}")
            elif user.get("role") == "Admin":
                await sio.enter_room(sid, "admins")
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
async def emit_exam_event(event, exam, examiner_id=None):
    payload = _normalized_socket_payload(exam)
    target_examiner = examiner_id or payload.get("examinerid") or payload.get("examiner_id")
    if target_examiner:
        await sio.emit(event, payload, room=f"examiner_{target_examiner}")
    await sio.emit(event, payload, room="admins")
    exam_id = payload.get("examid")
    if exam_id:
        await sio.emit(event, payload, room=f"exam_{exam_id}_all")

async def emit_assessment_event(event, assessment):
    payload = _normalized_socket_payload(assessment)
    exam_id = payload.get("examid")
    candidate_id = payload.get("candidateid")
    examiner_id = payload.get("examinerid") or payload.get("examiner_id")
    if exam_id:
        await sio.emit(event, payload, room=f"exam_{exam_id}_all")
        await sio.emit(event, payload, room=f"exam_{exam_id}_examiners")
    if candidate_id:
        await sio.emit(event, payload, room=f"candidate_{candidate_id}")
    if examiner_id:
        await sio.emit(event, payload, room=f"examiner_{examiner_id}")
    await sio.emit(event, payload, room="admins")

async def emit_request_event(event, request_payload, assessment=None):
    payload = _normalized_socket_payload(request_payload)
    if assessment:
        payload["assessment"] = _normalized_socket_payload(assessment)
    exam_id = payload.get("examid")
    candidate_id = payload.get("candidateid")
    if exam_id:
        await sio.emit(event, payload, room=f"exam_{exam_id}_examiners")
    if candidate_id:
        await sio.emit(event, payload, room=f"candidate_{candidate_id}")
    await sio.emit(event, payload, room="admins")

# ---------------- Compatibility aliases for renderer event names ----------------

def _json_safe(value):
    """Recursively convert database values into Socket.IO JSON-safe values."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(item) for item in value]
    return str(value)


def _normalized_socket_payload(data):
    payload = _json_safe(dict(data or {}))
    payload["examid"] = payload.get("examid") or payload.get("exam_id")
    payload["assessmentid"] = payload.get("assessmentid") or payload.get("assessment_id")
    payload["candidateid"] = payload.get("candidateid") or payload.get("candidate_id")
    return payload


@sio.on("join_exam")
async def join_exam(sid, data):
    await joinexam(sid, _normalized_socket_payload(data))


@sio.on("start_exam")
async def start_exam(sid, data):
    await startexam(sid, _normalized_socket_payload(data))


@sio.on("examiner_control")
async def examiner_control(sid, data):
    await examinercontrol(sid, _normalized_socket_payload(data))


@sio.on("broadcast_message")
async def broadcast_message(sid, data):
    await broadcastmessage(sid, _normalized_socket_payload(data))


@sio.on("reentry_decision")
async def reentry_decision(sid, data):
    await reentrydecision(sid, _normalized_socket_payload(data))

# ---------------- WebRTC live-camera signaling ----------------

def _socket_value(data, *keys):
    for key in keys:
        value = (data or {}).get(key)
        if value is not None and value != "":
            return value
    return None


async def _authorize_webrtc(sid, data):
    user = connected_users.get(sid)
    if not user:
        return None, None, None

    examid = _socket_value(data, "examid", "exam_id")
    candidateid = _socket_value(data, "candidateid", "candidate_id")
    if not examid or not candidateid:
        return None, None, None

    db = get_db()
    exam = await db.exams.find_one({
        "$or": [{"examid": examid}, {"exam_id": examid}]
    })
    assessment = await db.assessments.find_one({
        "$and": [
            {"$or": [{"examid": examid}, {"exam_id": examid}]},
            {"$or": [
                {"candidateid": candidateid},
                {"candidate_id": candidateid},
            ]},
        ]
    })
    if not exam or not assessment:
        return None, None, None

    role = user.get("role")
    userid = user.get("userid") or user.get("user_id")
    examinerid = exam.get("examinerid") or exam.get("examiner_id")

    if role == "Candidate" and str(userid) != str(candidateid):
        return None, None, None
    if role == "Examiner" and str(userid) != str(examinerid):
        return None, None, None
    if role not in ("Candidate", "Examiner", "Admin"):
        return None, None, None

    return user, examid, candidateid


@sio.on("webrtc_camera_ready")
@sio.on("webrtc_camera_ready")
async def webrtc_camera_ready(sid, data):
    user, examid, candidateid = await _authorize_webrtc(
        sid,
        data,
    )

    if not user or user.get("role") != "Candidate":
        return

    await sio.enter_room(
        sid,
        f"candidate_{candidateid}",
    )

    await sio.enter_room(
        sid,
        f"exam_{examid}_all",
    )

    payload = dict(data or {})

    payload.update(
        {
            "examid": examid,
            "candidateid": candidateid,
            "status": (
                "ready"
                if payload.get("camera")
                else "closed"
            ),
            "timestamp": _utc_iso(),
        }
    )

    await sio.emit(
        "webrtc_camera_ready",
        payload,
        room=f"exam_{examid}_examiners",
    )

    await sio.emit(
        "webrtc_camera_status",
        payload,
        room=f"exam_{examid}_examiners",
    )


@sio.on("webrtc_request_stream")
async def webrtc_request_stream(sid, data):
    user, examid, candidateid = await _authorize_webrtc(sid, data)
    if not user or user.get("role") not in ("Examiner", "Admin"):
        return

    await sio.enter_room(sid, f"exam_{examid}_examiners")
    payload = dict(data or {})
    payload.update({
        "examid": examid,
        "candidateid": candidateid,
        "examinerid": user.get("userid") or user.get("user_id"),
    })
    await sio.emit(
        "webrtc_request_stream",
        payload,
        room=f"candidate_{candidateid}",
    )


@sio.on("webrtc_offer")
async def webrtc_offer(sid, data):
    user, examid, candidateid = await _authorize_webrtc(sid, data)
    if not user or user.get("role") != "Candidate":
        return

    payload = dict(data or {})
    payload.update({"examid": examid, "candidateid": candidateid})
    await sio.emit(
        "webrtc_offer",
        payload,
        room=f"exam_{examid}_examiners",
    )


@sio.on("webrtc_answer")
async def webrtc_answer(sid, data):
    user, examid, candidateid = await _authorize_webrtc(sid, data)
    if not user or user.get("role") not in ("Examiner", "Admin"):
        return

    payload = dict(data or {})
    payload.update({
        "examid": examid,
        "candidateid": candidateid,
        "examinerid": user.get("userid") or user.get("user_id"),
    })
    await sio.emit(
        "webrtc_answer",
        payload,
        room=f"candidate_{candidateid}",
    )


@sio.on("webrtc_ice_candidate")
async def webrtc_ice_candidate(sid, data):
    user, examid, candidateid = await _authorize_webrtc(sid, data)
    if not user:
        return

    payload = dict(data or {})
    payload.update({"examid": examid, "candidateid": candidateid})
    target = payload.get("target")

    if user.get("role") == "Candidate" and target == "examiner":
        await sio.emit(
            "webrtc_ice_candidate",
            payload,
            room=f"exam_{examid}_examiners",
        )
    elif user.get("role") in ("Examiner", "Admin") and target == "candidate":
        payload["examinerid"] = user.get("userid") or user.get("user_id")
        await sio.emit(
            "webrtc_ice_candidate",
            payload,
            room=f"candidate_{candidateid}",
        )


@sio.on("webrtc_camera_status")
async def webrtc_camera_status(sid, data):
    user, examid, candidateid = await _authorize_webrtc(sid, data)
    if not user or user.get("role") != "Candidate":
        return

    payload = dict(data or {})
    payload.update({
        "examid": examid,
        "candidateid": candidateid,
        "timestamp": _utc_iso(),
    })
    await sio.emit(
        "webrtc_camera_status",
        payload,
        room=f"exam_{examid}_examiners",
    )


@sio.on("webrtc_stop_stream")
async def webrtc_stop_stream(sid, data):
    user, examid, candidateid = await _authorize_webrtc(sid, data)
    if not user or user.get("role") not in ("Examiner", "Admin"):
        return

    payload = dict(data or {})
    payload.update({
        "examid": examid,
        "candidateid": candidateid,
        "examinerid": user.get("userid") or user.get("user_id"),
    })
    await sio.emit(
        "webrtc_stop_stream",
        payload,
        room=f"candidate_{candidateid}",
    )
