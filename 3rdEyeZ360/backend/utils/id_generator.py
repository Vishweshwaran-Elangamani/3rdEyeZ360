from config.database import getdb


async def generateuserid(role: str) -> str:
    db = getdb()

    prefix_map = {
        "Admin": "ADMN",
        "Examiner": "EXAM",
        "Candidate": "CAND"
    }

    prefix = prefix_map.get(role, "USER")
    count = await db.users.count_documents({"role": role})
    return f"{prefix}-{str(count + 1).zfill(4)}"


async def generateexamid() -> str:
    db = getdb()
    count = await db.exams.count_documents({})
    return f"EXM-{str(count + 1).zfill(4)}"


async def generateassessmentid() -> str:
    db = getdb()
    count = await db.assessments.count_documents({})
    return f"ASM-{str(count + 1).zfill(4)}"


async def generate_user_id(role: str) -> str:
    return await generateuserid(role)


async def generate_exam_id() -> str:
    return await generateexamid()


async def generate_assessment_id() -> str:
    return await generateassessmentid()