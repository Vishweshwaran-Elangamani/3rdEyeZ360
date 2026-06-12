import socketio
from config.database import get_db
from middleware.auth import decode_token
import uuid
from datetime import datetime

sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=False,
    engineio_logger=False
)

# Track sid → user info
connected_users = {}


@sio.event
async def connect(sid, environ, auth):
    token = (auth or {}).get("token", "")
    if not token:
        print(f"[Socket] Rejected connection — no token")
        return False
    try:
        user = decode_token(token)
        connected_users[sid] = user
        print(f"[Socket] Connected: {user.get('email')} ({user.get('role')}) sid={sid}")
    except Exception as e:
        print(f"[Socket] Auth failed: {e}")
        return False


@sio.event
async def disconnect(sid):
    user = connected_users.pop(sid, {})
    print(f"[Socket] Disconnected: {user.get('email', sid)}")


@sio.event
async def join_exam(sid, data):
    exam_id      = data.get("exam_id", "")
    role         = data.get("role", "")
    candidate_id = data.get("candidate_id", "")

    # All users in this exam
    await sio.enter_room(sid, f"exam_{exam_id}_all")

    if role == "Examiner" or role == "Admin":
        await sio.enter_room(sid, f"exam_{exam_id}_examiners")
        print(f"[Socket] Examiner joined exam_{exam_id}")

    if role == "Candidate" and candidate_id:
        await sio.enter_room(sid, f"candidate_{candidate_id}")
        # Notify examiners this candidate is online
        await sio.emit("candidate_update", {
            "candidate_id": candidate_id,
            "online": True,
            "timestamp": datetime.utcnow().isoformat()
        }, room=f"exam_{exam_id}_examiners")
        print(f"[Socket] Candidate {candidate_id} joined exam_{exam_id}")


@sio.event
async def start_exam(sid, data):
    exam_id = data.get("exam_id", "")
    if not exam_id:
        return
    # Notify ALL candidates in this exam to start
    await sio.emit("exam_started", {
        "exam_id": exam_id,
        "started_at": datetime.utcnow().isoformat()
    }, room=f"exam_{exam_id}_all")
    print(f"[Socket] Exam {exam_id} started — all candidates notified")


@sio.event
async def examiner_control(sid, data):
    exam_id      = data.get("exam_id", "")
    candidate_id = data.get("candidate_id", "")
    action       = data.get("action", "")

    if not candidate_id or not action:
        return

    # Send control command directly to that candidate
    await sio.emit("control_command", {
        "action":    action,
        "exam_id":   exam_id,
        "timestamp": datetime.utcnow().isoformat()
    }, room=f"candidate_{candidate_id}")

    # Confirm to examiner
    await sio.emit("action_confirmed", {
        "candidate_id": candidate_id,
        "action": action
    }, room=sid)

    print(f"[Socket] Examiner control: {action} → candidate {candidate_id}")


@sio.event
async def send_message(sid, data):
    exam_id      = data.get("exam_id", "")
    candidate_id = data.get("candidate_id", "")
    sender_id    = data.get("sender_id", "")
    sender_role  = data.get("sender_role", "")
    message      = data.get("message", "").strip()

    if not message:
        return

    db = get_db()
    msg_doc = {
        "message_id":    str(uuid.uuid4()),
        "exam_id":       exam_id,
        "candidate_id":  candidate_id,
        "sender_id":     sender_id,
        "sender_role":   sender_role,
        "message":       message,
        "sent_at":       datetime.utcnow().isoformat()
    }
    await db.chats.insert_one(msg_doc)
    msg_doc.pop("_id", None)

    # Send to candidate room + examiner room
    await sio.emit("receive_message", msg_doc, room=f"candidate_{candidate_id}")
    await sio.emit("receive_message", msg_doc, room=f"exam_{exam_id}_examiners")
    print(f"[Socket] Message: {sender_role} → candidate {candidate_id}")


@sio.event
async def broadcast_message(sid, data):
    exam_id     = data.get("exam_id", "")
    examiner_id = data.get("examiner_id", "")
    message     = data.get("message", "").strip()

    if not message or not exam_id:
        return

    payload = {
        "exam_id":     exam_id,
        "examiner_id": examiner_id,
        "message":     message,
        "timestamp":   datetime.utcnow().isoformat()
    }
    # Send to all candidates in this exam
    await sio.emit("receive_broadcast", payload, room=f"exam_{exam_id}_all")
    print(f"[Socket] Broadcast to exam {exam_id}: {message}")


@sio.event
async def candidate_interrupted(sid, data):
    """Called when candidate's app crashes or closes unexpectedly."""
    exam_id      = data.get("exam_id", "")
    candidate_id = data.get("candidate_id", "")
    if not candidate_id:
        return

    db = get_db()
    await db.assessments.update_one(
        {"candidate_id": candidate_id, "exam_id": exam_id, "status": "ACTIVE"},
        {"$set": {"status": "INTERRUPTED", "interrupted_at": datetime.utcnow().isoformat()}}
    )
    await sio.emit("candidate_update", {
        "candidate_id": candidate_id,
        "status":       "INTERRUPTED",
        "timestamp":    datetime.utcnow().isoformat()
    }, room=f"exam_{exam_id}_examiners")
    print(f"[Socket] Candidate {candidate_id} interrupted")

@sio.event
async def reentry_decision(sid, data):
    assessment_id = data.get("assessment_id")
    approved      = data.get("approved")
    exam_id       = data.get("exam_id")

    db = get_db()
    assessment = await db.assessments.find_one({"assessment_id": assessment_id})
    if not assessment:
        return
    candidate_id = assessment.get("candidate_id")

    event = "reentry_approved" if approved else "reentry_rejected"
    await sio.emit(event, {
        "assessment_id": assessment_id,
        "reason": "Approved by examiner" if approved else "Rejected by examiner"
    }, room=f"candidate_{candidate_id}")

    await sio.emit("candidate_update", {
        "candidate_id": candidate_id,
        "status": "ACTIVE" if approved else "INTERRUPTED",
        "timestamp": datetime.utcnow().isoformat()
    }, room=f"exam_{exam_id}_examiners")