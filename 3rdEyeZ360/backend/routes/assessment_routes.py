from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from config.database import getdb
from middleware.auth import requirerole

router = APIRouter(prefix="/api/assessments", tags=["Assessments"])


def _serialize(document: dict) -> dict:
    return {k: str(v) if k == "_id" else v for k, v in (document or {}).items() if k != "_id"}


def _normalize_status(value, default="") -> str:
    return str(value or default).strip().upper().replace(" ", "").replace("-", "_")


def _assessment_query(assessment_id: str) -> dict:
    return {
        "$or": [
            {"assessmentid": assessment_id},
            {"assessment_id": assessment_id},
        ]
    }


def _exam_query(exam_id: str) -> dict:
    return {
        "$or": [
            {"examid": exam_id},
            {"exam_id": exam_id},
        ]
    }


async def _get_assessment_doc(db, assessment_id: str):
    return await db.assessments.find_one(_assessment_query(assessment_id))


async def _get_exam_doc(db, exam_id: str):
    return await db.exams.find_one(_exam_query(exam_id))


def _merge_exam_into_assessment(assessment: dict, exam: dict | None) -> dict:
    assessment = assessment or {}
    data = _serialize(assessment)

    assessment_id = assessment.get("assessmentid") or assessment.get("assessment_id")
    exam_id = assessment.get("examid") or assessment.get("exam_id")
    candidate_id = assessment.get("candidateid") or assessment.get("candidate_id")
    examiner_id = assessment.get("examinerid") or assessment.get("examiner_id")

    status = _normalize_status(assessment.get("status") or assessment.get("assessmentstatus"))
    final_status = _normalize_status(assessment.get("finalstatus") or assessment.get("final_status"))

    data["assessmentid"] = assessment_id
    data["assessment_id"] = assessment_id
    data["examid"] = exam_id
    data["exam_id"] = exam_id
    data["candidateid"] = candidate_id
    data["candidate_id"] = candidate_id
    data["examinerid"] = examiner_id
    data["examiner_id"] = examiner_id

    data["status"] = status
    data["assessmentstatus"] = status
    data["assessment_status"] = status
    data["finalstatus"] = final_status
    data["final_status"] = final_status

    if not exam:
        data["allowedwebsites"] = assessment.get("allowedwebsites", assessment.get("allowed_websites", [])) or []
        data["allowed_websites"] = data["allowedwebsites"]
        data["allowedapplications"] = assessment.get("allowedapplications", assessment.get("allowed_applications", [])) or []
        data["allowed_applications"] = data["allowedapplications"]
        exam_status = _normalize_status(
            assessment.get("examstatus") or assessment.get("exam_status") or assessment.get("statusexam")
        )
        data["examstatus"] = exam_status
        data["exam_status"] = exam_status
        return data

    exam_data = _serialize(exam)
    exam_status = _normalize_status(exam.get("status") or exam.get("examstatus"))

    data["name"] = assessment.get("name") or exam_data.get("name") or exam_data.get("examname") or ""
    data["description"] = assessment.get("description") or exam_data.get("description") or exam_data.get("examdescription") or ""
    data["date"] = assessment.get("date") or exam_data.get("date") or exam_data.get("examdate") or ""
    data["start_time"] = assessment.get("start_time") or assessment.get("starttime") or exam_data.get("start_time") or exam_data.get("starttime") or ""
    data["starttime"] = data["start_time"]
    data["end_time"] = assessment.get("end_time") or assessment.get("endtime") or exam_data.get("end_time") or exam_data.get("endtime") or ""
    data["endtime"] = data["end_time"]
    data["duration_minutes"] = assessment.get("duration_minutes", assessment.get("durationminutes", exam_data.get("duration_minutes", exam_data.get("durationminutes", 0))))
    data["durationminutes"] = data["duration_minutes"]
    data["violation_threshold"] = assessment.get("violation_threshold", assessment.get("violationthreshold", exam_data.get("violation_threshold", exam_data.get("violationthreshold", 10))))
    data["violationthreshold"] = data["violation_threshold"]
    data["instructions"] = assessment.get("instructions") or exam_data.get("instructions") or ""

    allowed_websites = (
        assessment.get("allowedwebsites")
        or assessment.get("allowed_websites")
        or exam_data.get("allowedwebsites")
        or exam_data.get("allowed_websites")
        or []
    )
    allowed_applications = (
        assessment.get("allowedapplications")
        or assessment.get("allowed_applications")
        or exam_data.get("allowedapplications")
        or exam_data.get("allowed_applications")
        or []
    )

    data["allowedwebsites"] = allowed_websites
    data["allowed_websites"] = allowed_websites
    data["allowedapplications"] = allowed_applications
    data["allowed_applications"] = allowed_applications
    data["examstatus"] = exam_status
    data["exam_status"] = exam_status

    return data


@router.get("/{assessment_id}")
async def get_assessment(
    assessment_id: str,
    current_user=Depends(requirerole("Candidate", "Examiner", "Admin"))
):
    db = getdb()

    assessment = await _get_assessment_doc(db, assessment_id)
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
    exam = await _get_exam_doc(db, exam_id) if exam_id else None

    return _merge_exam_into_assessment(assessment, exam)


@router.patch("/{assessment_id}/status")
async def update_assessment_status(
    assessment_id: str,
    body: dict,
    current_user=Depends(requirerole("Candidate", "Examiner", "Admin"))
):
    db = getdb()

    assessment = await _get_assessment_doc(db, assessment_id)
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

    new_status = _normalize_status(body.get("status"))
    if not new_status:
        raise HTTPException(status_code=400, detail="status is required")

    exam = await _get_exam_doc(db, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    exam_status = _normalize_status(exam.get("status") or exam.get("examstatus"))
    current_status = _normalize_status(assessment.get("status") or assessment.get("assessmentstatus"))

    if current_user["role"] == "Candidate":
        if new_status != "READY":
            raise HTTPException(status_code=403, detail="Candidate cannot set this status")

        if exam_status == "RUNNING":
            raise HTTPException(
                status_code=400,
                detail="Exam already started. Candidate must request permission."
            )

        if current_status not in {"ASSIGNED", "AVAILABLE", "READY"}:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot move assessment from {current_status or 'UNKNOWN'} to READY"
            )

    now = datetime.utcnow()
    update_doc = {
        "status": new_status,
        "assessmentstatus": new_status,
        "updatedat": now,
        "updated_at": now,
    }

    if new_status == "READY" and not (assessment.get("jointime") or assessment.get("join_time")):
        update_doc["jointime"] = now
        update_doc["join_time"] = now

    await db.assessments.update_one(
        _assessment_query(assessment_id),
        {"$set": update_doc}
    )

    updated = await _get_assessment_doc(db, assessment_id)
    updated_exam = await _get_exam_doc(db, exam_id) if exam_id else None

    return _merge_exam_into_assessment(updated, updated_exam)


@router.post("/{assessment_id}/action")
async def assessment_action(
    assessment_id: str,
    body: dict,
    current_user=Depends(requirerole("Examiner", "Admin"))
):
    db = getdb()

    assessment = await _get_assessment_doc(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    current_user_id = current_user.get("userid") or current_user.get("user_id")
    examiner_id = assessment.get("examinerid") or assessment.get("examiner_id")
    exam_id = assessment.get("examid") or assessment.get("exam_id")

    if current_user["role"] == "Examiner" and examiner_id != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    action = str(body.get("action") or "").strip().lower()
    reason = str(body.get("reason") or "").strip()

    if action not in {"pause", "resume", "terminate"}:
        raise HTTPException(status_code=400, detail="Invalid action")

    exam = await _get_exam_doc(db, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    exam_status = _normalize_status(exam.get("status") or exam.get("examstatus"))
    current_status = _normalize_status(assessment.get("status") or assessment.get("assessmentstatus"))

    now = datetime.utcnow()
    update_doc = {
        "updatedat": now,
        "updated_at": now,
        "lastaction": action,
        "lastactionby": current_user_id,
    }

    if reason:
        update_doc["actionreason"] = reason

    if action == "terminate":
        update_doc["status"] = "TERMINATED"
        update_doc["assessmentstatus"] = "TERMINATED"
        update_doc["finalstatus"] = "TERMINATED"
        update_doc["final_status"] = "TERMINATED"
        update_doc["exittime"] = now
        update_doc["exit_time"] = now

    elif action == "pause":
        if current_status in {"TERMINATED", "COMPLETED", "LOCKED"}:
            raise HTTPException(status_code=400, detail=f"Cannot pause assessment in {current_status}")
        update_doc["status"] = "PAUSED"
        update_doc["assessmentstatus"] = "PAUSED"

    elif action == "resume":
        if exam_status != "RUNNING":
            raise HTTPException(status_code=400, detail="Exam must be RUNNING to resume assessment")
        if current_status in {"TERMINATED", "COMPLETED", "LOCKED"}:
            raise HTTPException(status_code=400, detail=f"Cannot resume assessment in {current_status}")
        update_doc["status"] = "ACTIVE"
        update_doc["assessmentstatus"] = "ACTIVE"
        if not (assessment.get("activetime") or assessment.get("active_time")):
            update_doc["activetime"] = now
            update_doc["active_time"] = now

    await db.assessments.update_one(
        _assessment_query(assessment_id),
        {"$set": update_doc}
    )

    updated = await _get_assessment_doc(db, assessment_id)
    updated_exam = await _get_exam_doc(db, exam_id) if exam_id else None

    return {
        "message": f"Assessment action '{action}' applied",
        "assessment": _merge_exam_into_assessment(updated, updated_exam),
    }