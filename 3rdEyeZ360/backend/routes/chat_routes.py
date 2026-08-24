from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response

from config.database import get_db
from messaging.authorization import authorize_conversation
from messaging.history import get_history
from messaging.rooms import conversation_id_for
from middleware.auth import require_role
from services.chat_attachment_service import (
    MAX_FILES_PER_MESSAGE,
    read_chat_attachment,
    upload_chat_attachment,
)

router = APIRouter(prefix="/api/chat", tags=["Chat"])

chat_user = require_role(
    "Examiner",
    "Admin",
    "Candidate",
)


@router.get("/exams/{exam_id}/general")
async def general_chat_history(
    exam_id: str,
    limit: int = Query(default=50, ge=1, le=100),
    current_user: dict = Depends(chat_user),
):
    messages = await get_history(
        db=get_db(),
        user=current_user,
        exam_id=exam_id,
        conversation_type="GENERAL",
        limit=limit,
    )

    return {
        "conversationtype": "GENERAL",
        "examid": exam_id,
        "candidateid": None,
        "messages": messages,
        "count": len(messages),
    }


@router.get("/exams/{exam_id}/candidates/{candidate_id}")
async def private_chat_history(
    exam_id: str,
    candidate_id: str,
    assessment_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    current_user: dict = Depends(chat_user),
):
    messages = await get_history(
        db=get_db(),
        user=current_user,
        exam_id=exam_id,
        conversation_type="PRIVATE",
        candidate_id=candidate_id,
        assessment_id=assessment_id,
        limit=limit,
    )

    return {
        "conversationtype": "PRIVATE",
        "examid": exam_id,
        "assessmentid": assessment_id,
        "candidateid": candidate_id,
        "messages": messages,
        "count": len(messages),
    }


@router.post("/attachments")
async def upload_attachments(
    exam_id: str = Form(...),
    conversation_type: str = Form(...),
    candidate_id: str | None = Form(default=None),
    assessment_id: str | None = Form(default=None),
    files: list[UploadFile] = File(...),
    current_user: dict = Depends(chat_user),
):
    conversation_type = conversation_type.upper().strip()

    if len(files) > MAX_FILES_PER_MESSAGE:
        raise HTTPException(
            status_code=400,
            detail="A message can contain at most 5 attachments",
        )

    access = await authorize_conversation(
        db=get_db(),
        user=current_user,
        exam_id=exam_id,
        conversation_type=conversation_type,
        candidate_id=candidate_id,
        assessment_id=assessment_id,
    )

    authorized_candidate_id = access.get("candidateid")
    conversation_id = conversation_id_for(
        conversation_type,
        exam_id,
        authorized_candidate_id,
    )

    attachments = []
    for file in files:
        attachments.append(
            await upload_chat_attachment(
                file,
                exam_id,
                conversation_id,
            )
        )

    return {
        "success": True,
        "attachments": attachments,
    }


@router.get("/attachments/{attachment_id}")
async def download_attachment(
    attachment_id: str,
    current_user: dict = Depends(chat_user),
):
    db = get_db()

    message = await db["chat_messages"].find_one(
        {
            "attachments.attachmentid": attachment_id,
        },
        {
            "_id": 0,
        },
    )

    if not message or message.get("isdeleted"):
        raise HTTPException(
            status_code=404,
            detail="Attachment not found",
        )

    await authorize_conversation(
        db=db,
        user=current_user,
        exam_id=str(message["examid"]),
        conversation_type=str(message["conversationtype"]),
        candidate_id=message.get("candidateid"),
        assessment_id=message.get("assessmentid"),
    )

    attachment = next(
        (
            item
            for item in message.get("attachments", [])
            if item.get("attachmentid") == attachment_id
        ),
        None,
    )

    if not attachment:
        raise HTTPException(
            status_code=404,
            detail="Attachment not found",
        )

    content = await read_chat_attachment(
        str(attachment["objectname"])
    )

    safe_filename = str(
        attachment.get("filename") or "attachment"
    ).replace('"', "")

    content_type = str(
        attachment.get("contenttype")
        or "application/octet-stream"
    )

    return Response(
        content=content,
        media_type=content_type,
        headers={
            "Content-Disposition": (
                f'inline; filename="{safe_filename}"'
            ),
        },
    )


@router.get("/{exam_id}/{candidate_id}")
async def legacy_private_chat_history(
    exam_id: str,
    candidate_id: str,
    assessment_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    current_user: dict = Depends(chat_user),
):
    return await private_chat_history(
        exam_id=exam_id,
        candidate_id=candidate_id,
        assessment_id=assessment_id,
        limit=limit,
        current_user=current_user,
    )
