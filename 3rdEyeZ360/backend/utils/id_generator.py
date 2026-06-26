from config.database import get_db
import uuid


async def _generate_unique_id(collection_name: str, field_name: str, prefix: str) -> str:
    db = get_db()

    for _ in range(20):
        candidate_id = f"{prefix}-{uuid.uuid4().hex[:8].upper()}"
        exists = await db[collection_name].find_one({field_name: candidate_id})
        if not exists:
            return candidate_id

    raise RuntimeError(f"Failed to generate unique ID for {collection_name}.{field_name}")


async def generate_user_id(role: str) -> str:
    prefix_map = {
        "Admin": "ADMN",
        "Examiner": "EXAM",
        "Candidate": "CAND",
    }
    prefix = prefix_map.get(role, "USER")
    return await _generate_unique_id("users", "user_id", prefix)


async def generate_exam_id() -> str:
    return await _generate_unique_id("exams", "exam_id", "EXM")


async def generate_assessment_id() -> str:
    return await _generate_unique_id("assessments", "assessment_id", "ASM")


async def generateuserid(role: str) -> str:
    return await generate_user_id(role)


async def generateexamid() -> str:
    return await generate_exam_id()


async def generateassessmentid() -> str:
    return await generate_assessment_id()