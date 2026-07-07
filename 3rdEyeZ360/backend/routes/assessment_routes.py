from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from config.database import getdb
from middleware.auth import requirerole

router = APIRouter(prefix="/api/assessments", tags=["Assessments"])


def serialize(document: dict) -> dict:
    return {k: str(v) if k == "_id" else v for k, v in document.items() if k != "_id"}


def get_assessment_query(assessment_id: str) -> dict:
    return {
        "$or": [
            {"assessmentid": assessment_id},
            {"assessment_id": assessment_id},
        ]
    }


def get_exam_query(exam_id: str) -> dict:
    return {
        "$or": [
            {"examid": exam_id},
            {"exam_id": exam_id},
        ]
    }


async def get_assessment_doc(db, assessment_id: str):
    return await db.assessments.find_one(get_assessment_query(assessment_id))


async def get_exam_doc(db, exam_id: str):
    return await db.exams.find_one(get_exam_query(exam_id))


def merge_exam_into_assessment(assessment: dict, exam: dict | None) -> dict:
    data = serialize(assessment)

    if not exam:
        data["allowedwebsites"] = data.get("allowedwebsites", []) or []
        data["allowedapplications"] = data.get("allowedapplications", []) or []
        data["exam_status"] = data.get("exam_status", "")
        data["examstatus"] = data.get("examstatus", "")
        return data

    exam_data = serialize(exam)

    data["name"] = data.get("name") or exam_data.get("name", "")
    data["description"] = data.get("description") or exam_data.get("description", "")
    data["date"] = data.get("date") or exam_data.get("date", "")
    data["start_time"] = data.get("start_time") or exam_data.get("start_time") or exam_data.get("starttime", "")
    data["starttime"] = data.get("starttime") or exam_data.get("starttime") or exam_data.get("start_time", "")
    data["end_time"] = data.get("end_time") or exam_data.get("end_time") or exam_data.get("endtime", "")
    data["endtime"] = data.get("endtime") or exam_data.get("endtime") or exam_data.get("end_time", "")
    data["duration_minutes"] = data.get("duration_minutes") or exam_data.get("duration_minutes") or exam_data.get("durationminutes", 0)
    data["durationminutes"] = data.get("durationminutes") or exam_data.get("durationminutes") or exam_data.get("duration_minutes", 0)
    data["violation_threshold"] = data.get("violation_threshold") or exam_data.get("violation_threshold") or exam_data.get("violationthreshold", 0)
    data["violationthreshold"] = data.get("violationthreshold") or exam_data.get("violationthreshold") or exam_data.get("violation_threshold", 0)
    data["instructions"] = data.get("instructions") or exam_data.get("instructions", "")

    data["allowed_websites"] = exam_data.get("allowed_websites") or exam_data.get("allowedwebsites") or []
    data["allowedwebsites"] = exam_data.get("allowedwebsites") or exam_data.get("allowed_websites") or []

    data["allowed_applications"] = exam_data.get("allowed_applications") or exam_data.get("allowedapplications") or []
    data["allowedapplications"] = exam_data.get("allowedapplications") or exam_data.get("allowed_applications") or []

    exam_status = exam_data.get("status") or exam_data.get("exam_status") or exam_data.get("examstatus") or ""
    data["exam_status"] = exam_status
    data["examstatus"] = exam_status

    return data


@router.get("/{assessment_id}")
async def get_assessment(
    assessment_id: str,
    current_user=Depends(requirerole("Candidate", "Examiner", "Admin"))
):
    db = getdb()

    assessment = await get_assessment_doc(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    current_user_id = current_user.get("userid") or current_user.get("user_id")
    candidate_id = assessment.get("candidateid") or assessment.get("candidate_id")
    examiner_id = assessment.get("examinerid") or assessment.get("examiner_id")

    if current_user["role"] == "Candidate" and candidate_id != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if current_user["role"] == "Examiner" and examiner_id != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    exam_id = assessment.get("examid") or assessment.get("exam_id")
    exam = await get_exam_doc(db, exam_id) if exam_id else None

    return merge_exam_into_assessment(assessment, exam)


@router.patch("/{assessment_id}/status")
async def update_assessment_status(
    assessment_id: str,
    body: dict,
    current_user=Depends(requirerole("Candidate", "Examiner", "Admin"))
):
    db = getdb()

    assessment = await get_assessment_doc(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    current_user_id = current_user.get("userid") or current_user.get("user_id")
    candidate_id = assessment.get("candidateid") or assessment.get("candidate_id")
    examiner_id = assessment.get("examinerid") or assessment.get("examiner_id")
    exam_id = assessment.get("examid") or assessment.get("exam_id")

    if current_user["role"] == "Candidate" and candidate_id != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if current_user["role"] == "Examiner" and examiner_id != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    new_status = str(body.get("status") or "").strip().upper()
    if not new_status:
        raise HTTPException(status_code=400, detail="status is required")

    exam = await get_exam_doc(db, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    exam_status = str(exam.get("status") or exam.get("examstatus") or "").upper()
    current_status = str(assessment.get("status") or "").upper()

    allowed_candidate_statuses = {"READY"}
    if current_user["role"] == "Candidate" and new_status not in allowed_candidate_statuses:
        raise HTTPException(status_code=403, detail="Candidate cannot set this status")

    if new_status == "READY":
        if exam_status == "RUNNING":
            raise HTTPException(
                status_code=400,
                detail="Exam already started. Candidate must request permission."
            )

        if current_status not in {"ASSIGNED", "AVAILABLE", "READY"}:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot move assessment from {current_status} to READY"
            )

    now = datetime.utcnow()
    update_doc = {
        "status": new_status,
        "updatedat": now,
        "updated_at": now,
    }

    if new_status == "READY" and not assessment.get("jointime") and not assessment.get("join_time"):
        update_doc["jointime"] = now
        update_doc["join_time"] = now

    await db.assessments.update_one(
        get_assessment_query(assessment_id),
        {"$set": update_doc}
    )

    updated = await get_assessment_doc(db, assessment_id)
    updated_exam = await get_exam_doc(db, exam_id) if exam_id else None

    return merge_exam_into_assessment(updated, updated_exam)