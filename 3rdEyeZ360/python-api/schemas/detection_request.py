from pydantic import BaseModel


class FrameRequest(BaseModel):
    frame: str
    candidate_id: str | None = None
    exam_id: str | None = None


class AudioRequest(BaseModel):
    audio_chunk: str
    candidate_id: str | None = None
    exam_id: str | None = None
