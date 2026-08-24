from .constants import GENERAL, PRIVATE


def general_room(exam_id: str) -> str:
    return f"chat:exam:{exam_id}:general"


def private_room(exam_id: str, candidate_id: str) -> str:
    return f"chat:exam:{exam_id}:candidate:{candidate_id}"


def general_conversation_id(exam_id: str) -> str:
    return f"{exam_id}:GENERAL"


def private_conversation_id(exam_id: str, candidate_id: str) -> str:
    return f"{exam_id}:PRIVATE:{candidate_id}"


def room_for(conversation_type: str, exam_id: str, candidate_id: str | None = None) -> str:
    conversation_type = str(conversation_type or "").upper()
    if conversation_type == GENERAL:
        return general_room(exam_id)
    if conversation_type == PRIVATE and candidate_id:
        return private_room(exam_id, candidate_id)
    raise ValueError("A private conversation requires candidateid")


def conversation_id_for(conversation_type: str, exam_id: str, candidate_id: str | None = None) -> str:
    conversation_type = str(conversation_type or "").upper()
    if conversation_type == GENERAL:
        return general_conversation_id(exam_id)
    if conversation_type == PRIVATE and candidate_id:
        return private_conversation_id(exam_id, candidate_id)
    raise ValueError("A private conversation requires candidateid")
