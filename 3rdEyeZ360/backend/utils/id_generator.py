from config.database import get_db


async def generate_user_id(role: str) -> str:
    db = get_db()

    prefix_map = {
        "Admin": "ADMN",
        "Examiner": "EXAM",
        "Candidate": "CAND",
    }

    prefix = prefix_map.get(role, "USER")
    count = await db.users.count_documents({"role": role})
    return f"{prefix}-{str(count + 1).zfill(4)}"


async def generate_exam_id() -> str:
    db = get_db()
    count = await db.exams.count_documents({})
    return f"EXM-{str(count + 1).zfill(4)}"


async def generate_assessment_id() -> str:
    db = get_db()
    count = await db.assessments.count_documents({})
    return f"ASM-{str(count + 1).zfill(4)}"


async def generateuserid(role: str) -> str:
    return await generate_user_id(role)


async def generateexamid() -> str:
    return await generate_exam_id()


async def generateassessmentid() -> str:
    return await generate_assessment_id()