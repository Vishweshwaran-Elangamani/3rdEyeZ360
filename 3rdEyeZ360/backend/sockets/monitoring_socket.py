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