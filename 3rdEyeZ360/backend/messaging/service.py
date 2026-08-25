from uuid import uuid4

from fastapi import HTTPException

from .authorization import authorize_conversation, pick
from .config import settings
from .constants import PRIVATE
from .producer import chat_producer
from .rooms import conversation_id_for, room_for
from .schemas import (
    ChatAccepted,
    ChatDeleteEvent,
    ChatDeleteRequest,
    ChatEditEvent,
    ChatEditRequest,
    ChatEvent,
    ChatReplyPreview,
    ChatSendRequest,
)


async def _validated_reply(db, request: ChatSendRequest, conversation_id: str):
    if request.replyto is None:
        return None

    original = await db[settings.message_collection].find_one(
        {
            "messageid": request.replyto.messageid,
            "conversationid": conversation_id,
        },
        {"_id": 0},
    )

    if not original:
        raise HTTPException(
            status_code=404,
            detail="The message being replied to was not found",
        )

    preview = " ".join(str(original.get("message") or "").split())

    return ChatReplyPreview(
        messageid=str(original["messageid"]),
        sendername=str(original.get("sendername") or "Unknown"),
        senderrole=str(original.get("senderrole") or "Candidate"),
        messagepreview=(preview or "Message unavailable")[:240],
    )


async def build_event(db, user: dict, request: ChatSendRequest) -> ChatEvent:
    authorization = await authorize_conversation(
        db=db,
        user=user,
        exam_id=request.examid,
        conversation_type=request.conversationtype,
        candidate_id=request.candidateid,
        assessment_id=request.assessmentid,
    )

    role = str(pick(user, "role") or "")
    sender_id = str(pick(user, "userid", "user_id") or "")
    sender_name = str(
        pick(user, "name", "displayname", "display_name", "email") or sender_id
    )
    candidate_id = authorization["candidateid"]
    assessment = authorization.get("assessment") or {}
    assessment_id = request.assessmentid or pick(
        assessment,
        "assessmentid",
        "assessment_id",
    )
    conversation_id = conversation_id_for(
        request.conversationtype,
        request.examid,
        candidate_id,
    )
    reply_to = await _validated_reply(db, request, conversation_id)

    return ChatEvent(
        eventid=f"EVT-{uuid4().hex[:12].upper()}",
        messageid=f"MSG-{uuid4().hex[:12].upper()}",
        clientmessageid=request.clientmessageid,
        conversationid=conversation_id,
        conversationtype=request.conversationtype,
        examid=request.examid,
        assessmentid=str(assessment_id) if assessment_id else None,
        candidateid=candidate_id if request.conversationtype == PRIVATE else None,
        examinerid=authorization["examinerid"],
        senderid=sender_id,
        sendername=sender_name,
        senderrole=role,
        message=request.message,
        replyto=reply_to,
        attachments=request.attachments,
        room=room_for(
            request.conversationtype,
            request.examid,
            candidate_id,
        ),
    )


async def send_message(db, user: dict, payload: dict) -> dict:
    request = ChatSendRequest.model_validate(payload)
    event = await build_event(db, user, request)
    await chat_producer.publish(event)

    return ChatAccepted(
        messageid=event.messageid,
        clientmessageid=event.clientmessageid,
    ).model_dump()


async def edit_message(db, user: dict, payload: dict) -> dict:
    request = ChatEditRequest.model_validate(payload)
    sender_id = str(pick(user, "userid", "user_id") or "")

    original = await db[settings.message_collection].find_one(
        {"messageid": request.messageid},
        {"_id": 0},
    )

    if not original:
        raise HTTPException(status_code=404, detail="Chat message not found")

    if str(original.get("senderid") or "") != sender_id:
        raise HTTPException(
            status_code=403,
            detail="You can edit only your own messages",
        )

    if str(original.get("message") or "") == request.message:
        raise HTTPException(
            status_code=400,
            detail="The edited message is unchanged",
        )

    await authorize_conversation(
        db=db,
        user=user,
        exam_id=str(original["examid"]),
        conversation_type=str(original["conversationtype"]),
        candidate_id=original.get("candidateid"),
        assessment_id=original.get("assessmentid"),
    )

    event = ChatEditEvent(
        eventid=f"EVT-{uuid4().hex[:12].upper()}",
        messageid=request.messageid,
        conversationid=str(original["conversationid"]),
        conversationtype=str(original["conversationtype"]),
        examid=str(original["examid"]),
        assessmentid=original.get("assessmentid"),
        candidateid=original.get("candidateid"),
        examinerid=str(original["examinerid"]),
        message=request.message,
        editedby=sender_id,
        room=str(original["room"]),
    )

    await chat_producer.publish(event)

    return ChatAccepted(
        messageid=event.messageid,
        clientmessageid=None,
    ).model_dump()


async def delete_message(db, user: dict, payload: dict) -> dict:
    request = ChatDeleteRequest.model_validate(payload)
    sender_id = str(pick(user, "userid", "user_id") or "")

    original = await db[settings.message_collection].find_one(
        {"messageid": request.messageid},
        {"_id": 0},
    )

    if not original:
        raise HTTPException(status_code=404, detail="Chat message not found")

    if str(original.get("senderid") or "") != sender_id:
        raise HTTPException(
            status_code=403,
            detail="You can delete only your own messages",
        )

    if bool(original.get("isdeleted")):
        raise HTTPException(status_code=400, detail="Message is already deleted")

    await authorize_conversation(
        db=db,
        user=user,
        exam_id=str(original["examid"]),
        conversation_type=str(original["conversationtype"]),
        candidate_id=original.get("candidateid"),
        assessment_id=original.get("assessmentid"),
    )

    event = ChatDeleteEvent(
        eventid=f"EVT-{uuid4().hex[:12].upper()}",
        messageid=request.messageid,
        conversationid=str(original["conversationid"]),
        conversationtype=str(original["conversationtype"]),
        examid=str(original["examid"]),
        assessmentid=original.get("assessmentid"),
        candidateid=original.get("candidateid"),
        examinerid=str(original["examinerid"]),
        deletedby=sender_id,
        room=str(original["room"]),
    )

    await chat_producer.publish(event)

    return ChatAccepted(
        messageid=event.messageid,
        clientmessageid=None,
    ).model_dump()
