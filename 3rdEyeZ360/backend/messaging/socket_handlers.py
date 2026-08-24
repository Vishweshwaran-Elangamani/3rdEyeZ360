from fastapi import HTTPException
from pydantic import ValidationError

from .authorization import authorize_conversation
from .constants import (
    SOCKET_CHAT_EDIT,
    SOCKET_CHAT_DELETE,
    SOCKET_CHAT_ERROR,
    SOCKET_CHAT_JOIN,
    SOCKET_CHAT_LEAVE,
    SOCKET_CHAT_SEND,
)
from .rooms import room_for
from .service import delete_message, edit_message, send_message


def error_text(error: Exception) -> str:
    if isinstance(error, HTTPException):
        return str(error.detail)
    return str(error)


def register_chat_socket_handlers(sio, get_db, connected_users: dict) -> None:
    @sio.on(SOCKET_CHAT_JOIN)
    async def chat_join(sid, payload):
        try:
            user = connected_users.get(sid)
            if not user:
                raise PermissionError("Authentication required")
            payload = payload or {}
            conversation_type = str(payload.get("conversationtype") or "").upper()
            exam_id = str(payload.get("examid") or "").strip()
            access = await authorize_conversation(
                db=get_db(),
                user=user,
                exam_id=exam_id,
                conversation_type=conversation_type,
                candidate_id=payload.get("candidateid"),
                assessment_id=payload.get("assessmentid"),
            )
            room = room_for(conversation_type, exam_id, access["candidateid"])
            await sio.enter_room(sid, room)
            return {"success": True, "room": room}
        except Exception as error:
            message = error_text(error)
            await sio.emit(SOCKET_CHAT_ERROR, {"error": message}, to=sid)
            return {"success": False, "error": message}

    @sio.on(SOCKET_CHAT_LEAVE)
    async def chat_leave(sid, payload):
        try:
            user = connected_users.get(sid)
            if not user:
                raise PermissionError("Authentication required")
            payload = payload or {}
            conversation_type = str(payload.get("conversationtype") or "").upper()
            exam_id = str(payload.get("examid") or "").strip()
            access = await authorize_conversation(
                db=get_db(),
                user=user,
                exam_id=exam_id,
                conversation_type=conversation_type,
                candidate_id=payload.get("candidateid"),
                assessment_id=payload.get("assessmentid"),
            )
            room = room_for(conversation_type, exam_id, access["candidateid"])
            await sio.leave_room(sid, room)
            return {"success": True}
        except Exception as error:
            return {"success": False, "error": error_text(error)}

    @sio.on(SOCKET_CHAT_SEND)
    async def chat_send_message(sid, payload):
        try:
            user = connected_users.get(sid)
            if not user:
                raise PermissionError("Authentication required")
            return await send_message(get_db(), user, payload or {})
        except ValidationError as error:
            return {"success": False, "status": "FAILED", "error": str(error)}
        except Exception as error:
            return {"success": False, "status": "FAILED", "error": error_text(error)}

    @sio.on(SOCKET_CHAT_EDIT)
    async def chat_edit_message(sid, payload):
        try:
            user = connected_users.get(sid)
            if not user:
                raise PermissionError("Authentication required")
            return await edit_message(get_db(), user, payload or {})
        except ValidationError as error:
            return {"success": False, "status": "FAILED", "error": str(error)}
        except Exception as error:
            return {"success": False, "status": "FAILED", "error": error_text(error)}

    @sio.on(SOCKET_CHAT_DELETE)
    async def chat_delete_message(sid, payload):
        try:
            user = connected_users.get(sid)
            if not user:
                raise PermissionError("Authentication required")
            return await delete_message(get_db(), user, payload or {})
        except ValidationError as error:
            return {"success": False, "status": "FAILED", "error": str(error)}
        except Exception as error:
            return {"success": False, "status": "FAILED", "error": error_text(error)}
