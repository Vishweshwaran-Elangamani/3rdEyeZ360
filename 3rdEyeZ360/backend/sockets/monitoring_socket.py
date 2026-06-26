from datetime import datetime
import uuid

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
        user = decode_token(token)
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
async def join_exam(sid, data):
    user = connected_users.get(sid)
    if not user:
        return

    exam_id = (data or {}).get("exam_id", "")
    if not exam_id:
        return

    db = get_db()
    await sio.enter_room(sid, f"exam_{exam_id}_all")

    if user["role"] in ("Examiner", "Admin"):
        exam = await db.exams.find_one({"exam_id": exam_id})
        if user["role"] == "Examiner" and (not exam or exam.get("examiner_id") != user["user_id"]):
            return
        await sio.enter_room(sid, f"exam_{exam_id}_examiners")
        print(f"[Socket] Examiner joined exam_{exam_id}")
        return

    if user["role"] == "Candidate":
        assessment = await db.assessments.find_one({
            "exam_id": exam_id,
            "candidate_id": user["user_id"],
        })
        if not assessment:
            return

        await sio.enter_room(sid, f"candidate_{user['user_id']}")
        await sio.emit(
            "candidate_update",
            {
                "candidate_id": user["user_id"],
                "online": True,
                "timestamp": _utc_iso(),
            },
            room=f"exam_{exam_id}_examiners",
        )
        print(f"[Socket] Candidate {user['user_id']} joined exam_{exam_id}")


@sio.event
async def start_exam(sid, data):
    user = connected_users.get(sid)
    if not user or user["role"] not in ("Examiner", "Admin"):
        return

    exam_id = (data or {}).get("exam_id", "")
    if not exam_id:
        return

    db = get_db()
    if user["role"] == "Examiner":
        exam = await db.exams.find_one({"exam_id": exam_id})
        if not exam or exam.get("examiner_id") != user["user_id"]:
            return

    await sio.emit(
        "exam_started",
        {
            "exam_id": exam_id,
            "started_at": _utc_iso(),
        },
        room=f"exam_{exam_id}_all",
    )
    print(f"[Socket] Exam {exam_id} started")


@sio.event
async def examiner_control(sid, data):
    user = connected_users.get(sid)
    if not user or user["role"] not in ("Examiner", "Admin"):
        return

    exam_id = (data or {}).get("exam_id", "")
    candidate_id = (data or {}).get("candidate_id", "")
    action = (data or {}).get("action", "").strip()

    if not exam_id or not candidate_id or not action:
        return

    db = get_db()
    if user["role"] == "Examiner":
        exam = await db.exams.find_one({"exam_id": exam_id})
        if not exam or exam.get("examiner_id") != user["user_id"]:
            return

    assessment = await db.assessments.find_one({"exam_id": exam_id, "candidate_id": candidate_id})
    if not assessment:
        return

    await sio.emit(
        "control_command",
        {
            "action": action,
            "exam_id": exam_id,
            "timestamp": _utc_iso(),
        },
        room=f"candidate_{candidate_id}",
    )

    await sio.emit(
        "action_confirmed",
        {
            "candidate_id": candidate_id,
            "action": action,
        },
        room=sid,
    )

    print(f"[Socket] Control: {action} -> candidate {candidate_id}")


@sio.event
async def send_message(sid, data):
    user = connected_users.get(sid)
    if not user:
        return

    exam_id = (data or {}).get("exam_id", "")
    candidate_id = (data or {}).get("candidate_id", "")
    message = ((data or {}).get("message", "") or "").strip()

    if not exam_id or not candidate_id or not message:
        return

    db = get_db()

    if user["role"] == "Candidate":
        if candidate_id != user["user_id"]:
            return
        assessment = await db.assessments.find_one({
            "exam_id": exam_id,
            "candidate_id": user["user_id"],
        })
        if not assessment:
            return
    elif user["role"] == "Examiner":
        exam = await db.exams.find_one({"exam_id": exam_id})
        if not exam or exam.get("examiner_id") != user["user_id"]:
            return
    elif user["role"] != "Admin":
        return

    now = datetime.utcnow()
    msg_doc = {
        "message_id": f"MSG-{uuid.uuid4().hex[:8].upper()}",
        "exam_id": exam_id,
        "candidate_id": candidate_id,
        "sender_id": user["user_id"],
        "sender_role": user["role"],
        "message": message,
        "is_broadcast": False,
        "sent_at": now,
    }
    await db.chats.insert_one(msg_doc)

    emit_doc = {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in msg_doc.items()}

    await sio.emit("receive_message", emit_doc, room=f"candidate_{candidate_id}")
    await sio.emit("receive_message", emit_doc, room=f"exam_{exam_id}_examiners")


@sio.event
async def broadcast_message(sid, data):
    user = connected_users.get(sid)
    if not user or user["role"] not in ("Examiner", "Admin"):
        return

    exam_id = (data or {}).get("exam_id", "")
    message = ((data or {}).get("message", "") or "").strip()

    if not message or not exam_id:
        return

    db = get_db()
    if user["role"] == "Examiner":
        exam = await db.exams.find_one({"exam_id": exam_id})
        if not exam or exam.get("examiner_id") != user["user_id"]:
            return

    await sio.emit(
        "receive_broadcast",
        {
            "exam_id": exam_id,
            "examiner_id": user["user_id"],
            "message": message,
            "timestamp": _utc_iso(),
        },
        room=f"exam_{exam_id}_all",
    )
    print(f"[Socket] Broadcast to exam {exam_id}: {message}")


@sio.event
async def reentry_decision(sid, data):
    user = connected_users.get(sid)
    if not user or user["role"] not in ("Examiner", "Admin"):
        return

    assessment_id = (data or {}).get("assessment_id", "")
    approved = bool((data or {}).get("approved", False))
    exam_id = (data or {}).get("exam_id", "")

    db = get_db()
    assessment = await db.assessments.find_one({"assessment_id": assessment_id})
    if not assessment:
        return

    if not exam_id:
        exam_id = assessment.get("exam_id", "")

    if user["role"] == "Examiner":
        exam = await db.exams.find_one({"exam_id": exam_id})
        if not exam or exam.get("examiner_id") != user["user_id"]:
            return

    candidate_id = assessment.get("candidate_id")
    event = "reentry_approved" if approved else "reentry_rejected"

    await sio.emit(
        event,
        {
            "assessment_id": assessment_id,
            "reason": "Approved by examiner" if approved else "Rejected by examiner",
        },
        room=f"candidate_{candidate_id}",
    )

    await sio.emit(
        "candidate_update",
        {
            "candidate_id": candidate_id,
            "status": "ACTIVE" if approved else "INTERRUPTED",
            "timestamp": _utc_iso(),
        },
        room=f"exam_{exam_id}_examiners",
    )


@sio.event
async def candidate_interrupted(sid, data):
    user = connected_users.get(sid)
    if not user or user["role"] != "Candidate":
        return

    exam_id = (data or {}).get("exam_id", "")
    candidate_id = (data or {}).get("candidate_id", "")

    if candidate_id != user["user_id"] or not exam_id:
        return

    db = get_db()
    await db.assessments.update_one(
        {"candidate_id": candidate_id, "exam_id": exam_id, "status": "ACTIVE"},
        {
            "$set": {
                "status": "INTERRUPTED",
                "interrupted_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        },
    )

    await sio.emit(
        "candidate_update",
        {
            "candidate_id": candidate_id,
            "status": "INTERRUPTED",
            "timestamp": _utc_iso(),
        },
        room=f"exam_{exam_id}_examiners",
    )
    print(f"[Socket] Candidate {candidate_id} interrupted")