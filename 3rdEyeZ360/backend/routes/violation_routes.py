from fastapi import APIRouter, Depends, HTTPException

from config.database import get_db
from middleware.auth import require_role

router = APIRouter(prefix="/api/violations", tags=["Violations"])


def _serialize(document: dict) -> dict:
    return {k: str(v) if k == "_id" else v for k, v in document.items() if k != "_id"}


async def _ensure_exam_access(db, exam_id: str, current_user: dict):
    exam = await db.exams.find_one({"exam_id": exam_id})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    if current_user["role"] == "Examiner" and exam.get("examiner_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    return exam


@router.get("/{exam_id}/{candidate_id}")
async def get_violations(
    exam_id: str,
    candidate_id: str,
    current_user=Depends(require_role("Examiner", "Admin", "Candidate")),
):
    db = get_db()

    if current_user["role"] == "Candidate":
        if current_user["user_id"] != candidate_id:
            raise HTTPException(status_code=403, detail="Access denied")

        assessment = await db.assessments.find_one({
            "exam_id": exam_id,
            "candidate_id": candidate_id,
        })
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
    else:
        await _ensure_exam_access(db, exam_id, current_user)

    violations = (
        await db.violations.find({"exam_id": exam_id, "candidate_id": candidate_id})
        .sort("timestamp", -1)
        .to_list(None)
    )
    return [_serialize(v) for v in violations]


@router.get("/assessment/{assessment_id}")
async def get_violations_by_assessment(
    assessment_id: str,
    current_user=Depends(require_role("Examiner", "Admin", "Candidate")),
):
    db = get_db()

    assessment = await db.assessments.find_one({"assessment_id": assessment_id})
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    if current_user["role"] == "Candidate":
        if assessment.get("candidate_id") != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user["role"] == "Examiner":
        exam = await db.exams.find_one({"exam_id": assessment.get("exam_id")})
        if not exam or exam.get("examiner_id") != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Access denied")

    violations = (
        await db.violations.find({"assessment_id": assessment_id})
        .sort("timestamp", -1)
        .to_list(None)
    )
    return [_serialize(v) for v in violations]


@router.patch("/{violation_id}/review")
async def review_violation(
    violation_id: str,
    body: dict,
    current_user=Depends(require_role("Examiner", "Admin")),
):
    db = get_db()

    violation = await db.violations.find_one({"violation_id": violation_id})
    if not violation:
        raise HTTPException(status_code=404, detail="Violation not found")

    if current_user["role"] == "Examiner":
        exam = await db.exams.find_one({"exam_id": violation.get("exam_id")})
        if not exam or exam.get("examiner_id") != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Access denied")

    note = (body.get("note") or "").strip()
    status = (body.get("status") or "Reviewed").strip()

    await db.violations.update_one(
        {"violation_id": violation_id},
        {
            "$set": {
                "reviewed": True,
                "reviewed_by": current_user["user_id"],
                "review_note": note,
                "status": status,
            }
        },
    )
    return {"message": "Violation reviewed"}