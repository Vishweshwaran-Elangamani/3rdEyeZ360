import asyncio
import io
import os
import re
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from config.minio_client import get_minio

BUCKET = os.getenv("MINIO_BUCKET", "assessment-evidence")
MAX_FILE_SIZE = 10 * 1024 * 1024
MAX_FILES_PER_MESSAGE = 5

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".webp", ".pdf", ".txt", ".csv", ".docx", ".xlsx"
}


def _safe_filename(filename: str) -> str:
    original = Path(filename or "attachment").name
    stem = re.sub(r"[^A-Za-z0-9._-]+", "_", original).strip("._")
    return (stem or "attachment")[:180]


def _validate(filename: str, content_type: str, size: int) -> None:
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS or content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail=f"Unsupported attachment type: {filename}")
    if size <= 0:
        raise HTTPException(status_code=400, detail=f"Attachment is empty: {filename}")
    if size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"Attachment exceeds 10 MB: {filename}")


async def upload_chat_attachment(
    file: UploadFile,
    exam_id: str,
    conversation_id: str,
) -> dict:
    data = await file.read(MAX_FILE_SIZE + 1)
    safe_name = _safe_filename(file.filename or "attachment")
    content_type = str(file.content_type or "application/octet-stream").lower()
    _validate(safe_name, content_type, len(data))

    attachment_id = f"ATT-{uuid4().hex[:12].upper()}"
    object_name = f"chat/{exam_id}/{conversation_id}/{attachment_id}/{safe_name}"
    minio = get_minio()

    await asyncio.to_thread(
        minio.put_object,
        BUCKET,
        object_name,
        io.BytesIO(data),
        len(data),
        content_type=content_type,
    )

    return {
        "attachmentid": attachment_id,
        "filename": safe_name,
        "contenttype": content_type,
        "size": len(data),
        "objectname": object_name,
        "downloadurl": f"/api/chat/attachments/{attachment_id}",
    }


async def read_chat_attachment(
    object_name: str,
) -> bytes:
    minio = get_minio()

    def read_object() -> bytes:
        response = minio.get_object(
            BUCKET,
            object_name,
        )

        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

    return await asyncio.to_thread(read_object)
