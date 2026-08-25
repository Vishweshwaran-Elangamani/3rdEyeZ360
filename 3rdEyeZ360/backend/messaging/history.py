from .authorization import authorize_conversation
from .repository import ChatRepository
from .rooms import conversation_id_for


async def get_history(
    db,
    user: dict,
    exam_id: str,
    conversation_type: str,
    candidate_id: str | None = None,
    assessment_id: str | None = None,
    limit: int = 50,
) -> list[dict]:
    conversation_type = str(conversation_type or "").strip().upper()
    access = await authorize_conversation(
        db=db,
        user=user,
        exam_id=exam_id,
        conversation_type=conversation_type,
        candidate_id=candidate_id,
        assessment_id=assessment_id,
    )
    effective_candidate_id = access["candidateid"]
    conversation_id = conversation_id_for(
        conversation_type=conversation_type,
        exam_id=exam_id,
        candidate_id=effective_candidate_id,
    )
    repository = ChatRepository(db)
    return await repository.history(
        conversation_id=conversation_id,
        limit=limit,
    )
