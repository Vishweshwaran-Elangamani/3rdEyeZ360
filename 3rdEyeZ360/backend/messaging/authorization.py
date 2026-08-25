from fastapi import HTTPException

from .constants import PRIVATE


def pick(document: dict | None, *field_names: str):
    document = document or {}
    for field_name in field_names:
        value = document.get(field_name)
        if value is not None and str(value).strip() != "":
            return value
    return None


def get_user_id(user: dict) -> str:
    return str(pick(user, "userid", "user_id") or "")


def get_user_role(user: dict) -> str:
    return str(pick(user, "role") or "")


async def find_exam(db, exam_id: str):
    return await db.exams.find_one(
        {"$or": [{"examid": exam_id}, {"exam_id": exam_id}]}
    )


async def find_assessment(db, exam_id: str, candidate_id: str, assessment_id: str | None = None):
    conditions = [
        {
            "$or": [
                {"examid": exam_id, "candidateid": candidate_id},
                {"exam_id": exam_id, "candidate_id": candidate_id},
            ]
        }
    ]
    if assessment_id:
        conditions.append(
            {
                "$or": [
                    {"assessmentid": assessment_id},
                    {"assessment_id": assessment_id},
                ]
            }
        )
    return await db.assessments.find_one({"$and": conditions})


async def authorize_conversation(
    db,
    user: dict,
    exam_id: str,
    conversation_type: str,
    candidate_id: str | None,
    assessment_id: str | None = None,
) -> dict:
    user_id = get_user_id(user)
    role = get_user_role(user)
    conversation_type = str(conversation_type or "").upper()

    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    if not exam_id:
        raise HTTPException(status_code=400, detail="examid is required")

    exam = await find_exam(db, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    examiner_id = str(pick(exam, "examinerid", "examiner_id") or "")

    if role in {"Examiner", "Admin"}:
        if role == "Examiner" and examiner_id != user_id:
            raise HTTPException(status_code=403, detail="Exam access denied")
        if conversation_type == PRIVATE:
            if not candidate_id:
                raise HTTPException(
                    status_code=400,
                    detail="candidateid is required for private chat",
                )
            assessment = await find_assessment(
                db, exam_id, str(candidate_id), assessment_id
            )
            if not assessment:
                raise HTTPException(
                    status_code=403,
                    detail="Candidate is not assigned to this exam",
                )
            return {
                "exam": exam,
                "assessment": assessment,
                "candidateid": str(candidate_id),
                "examinerid": examiner_id,
            }
        return {
            "exam": exam,
            "assessment": None,
            "candidateid": None,
            "examinerid": examiner_id,
        }

    if role == "Candidate":
        assessment = await find_assessment(db, exam_id, user_id, assessment_id)
        if not assessment:
            raise HTTPException(
                status_code=403,
                detail="Candidate is not assigned to this exam",
            )
        if conversation_type == PRIVATE and candidate_id and str(candidate_id) != user_id:
            raise HTTPException(
                status_code=403,
                detail="Private conversation access denied",
            )
        return {
            "exam": exam,
            "assessment": assessment,
            "candidateid": user_id,
            "examinerid": examiner_id,
        }

    raise HTTPException(status_code=403, detail="Role cannot access exam chat")
