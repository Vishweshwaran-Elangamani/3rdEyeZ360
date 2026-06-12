from pydantic import BaseModel

class FrameRequest(BaseModel):
    frame: str
    candidate_id: str
    exam_id: str

class AudioRequest(BaseModel):
    audio_chunk: str
    candidate_id: str
    exam_id: str