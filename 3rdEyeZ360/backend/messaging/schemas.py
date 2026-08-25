from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from .config import settings
from .constants import (
    CHAT_MESSAGE_CREATED,
    CHAT_MESSAGE_EDITED,
    CHAT_MESSAGE_DELETED,
    EVENT_VERSION,
)

ConversationType = Literal["GENERAL", "PRIVATE"]
SenderRole = Literal["Candidate", "Examiner", "Admin"]


def clean_message(value: str) -> str:
    cleaned = str(value or "").strip()
    if not cleaned:
        raise ValueError("Message cannot be empty")
    if len(cleaned) > settings.maximum_message_length:
        raise ValueError(
            f"Message cannot exceed {settings.maximum_message_length} characters"
        )
    return cleaned


class ChatAttachment(BaseModel):
    attachmentid: str = Field(min_length=1, max_length=128)
    filename: str = Field(min_length=1, max_length=200)
    contenttype: str = Field(min_length=1, max_length=200)
    size: int = Field(gt=0, le=10 * 1024 * 1024)
    objectname: str = Field(min_length=1, max_length=600)
    downloadurl: str = Field(min_length=1, max_length=600)


class ChatReplyPreview(BaseModel):
    messageid: str = Field(min_length=1, max_length=128)
    sendername: str = Field(min_length=1, max_length=200)
    senderrole: SenderRole
    messagepreview: str = Field(min_length=1, max_length=240)

    @field_validator("messagepreview")
    @classmethod
    def clean_preview(cls, value: str) -> str:
        cleaned = " ".join(str(value or "").split())
        if not cleaned:
            raise ValueError("Reply preview cannot be empty")
        return cleaned[:240]


class ChatSendRequest(BaseModel):
    examid: str = Field(min_length=1)
    assessmentid: str | None = None
    candidateid: str | None = None
    conversationtype: ConversationType
    message: str = ""
    clientmessageid: str = Field(min_length=1, max_length=128)
    replyto: ChatReplyPreview | None = None
    attachments: list[ChatAttachment] = Field(default_factory=list, max_length=5)

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        cleaned = str(value or "").strip()
        if len(cleaned) > settings.maximum_message_length:
            raise ValueError(f"Message cannot exceed {settings.maximum_message_length} characters")
        return cleaned

    @model_validator(mode="after")
    def require_content(self):
        if not self.message and not self.attachments:
            raise ValueError("Message or attachment is required")
        return self


class ChatEditRequest(BaseModel):
    messageid: str = Field(min_length=1, max_length=128)
    message: str

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        return clean_message(value)


class ChatDeleteRequest(BaseModel):
    messageid: str = Field(min_length=1, max_length=128)


class ChatEvent(BaseModel):
    eventid: str
    eventtype: str = CHAT_MESSAGE_CREATED
    eventversion: int = EVENT_VERSION
    messageid: str
    clientmessageid: str
    conversationid: str
    conversationtype: ConversationType
    examid: str
    assessmentid: str | None = None
    candidateid: str | None = None
    examinerid: str
    senderid: str
    sendername: str
    senderrole: SenderRole
    message: str
    replyto: ChatReplyPreview | None = None
    attachments: list[ChatAttachment] = Field(default_factory=list)
    room: str
    createdat: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    editedat: datetime | None = None
    editedby: str | None = None
    isdeleted: bool = False
    deletedat: datetime | None = None
    deletedby: str | None = None


class ChatEditEvent(BaseModel):
    eventid: str
    eventtype: str = CHAT_MESSAGE_EDITED
    eventversion: int = EVENT_VERSION
    messageid: str
    conversationid: str
    conversationtype: ConversationType
    examid: str
    assessmentid: str | None = None
    candidateid: str | None = None
    examinerid: str
    message: str
    editedby: str
    editedat: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    room: str


class ChatDeleteEvent(BaseModel):
    eventid: str
    eventtype: str = CHAT_MESSAGE_DELETED
    eventversion: int = EVENT_VERSION
    messageid: str
    conversationid: str
    conversationtype: ConversationType
    examid: str
    assessmentid: str | None = None
    candidateid: str | None = None
    examinerid: str
    deletedby: str
    deletedat: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    room: str


class ChatAccepted(BaseModel):
    success: bool = True
    status: str = "ACCEPTED"
    messageid: str
    clientmessageid: str | None = None
