from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool

from config.database import get_db
from middleware.auth import require_role
from services.evidence_service import get_evidence_base64

router = APIRouter(prefix="/api/violations", tags=["Violations"])


def _serialize(document: dict | None) -> dict:
    return {
        key: str(value) if key == "_id" else value
        for key, value in (document or {}).items()
        if key != "_id"
    }


def _user_id(current_user: dict):
    return current_user.get("user_id") or current_user.get("userid")


def _role(current_user: dict) -> str:
    return str(current_user.get("role") or "").strip()


def _exam_query(exam_id: str) -> dict:
    return {
        "$or": [
            {"exam_id": exam_id},
            {"examid": exam_id},
        ]
    }


def _candidate_exam_query(exam_id: str, candidate_id: str) -> dict:
    return {
        "$and": [
            _exam_query(exam_id),
            {
                "$or": [
                    {"candidate_id": candidate_id},
                    {"candidateid": candidate_id},
                ]
            },
        ]
    }


def _assessment_query(assessment_id: str) -> dict:
    return {
        "$or": [
            {"assessment_id": assessment_id},
            {"assessmentid": assessment_id},
        ]
    }


def _violation_query(violation_id: str) -> dict:
    return {
        "$or": [
            {"violation_id": violation_id},
            {"violationid": violation_id},
        ]
    }


def _created_sort():
    return [
        ("createdat", -1),
        ("created_at", -1),
        ("timestamp", -1),
    ]


def _assessment_value(assessment: dict, *keys, default=None):
    for key in keys:
        value = assessment.get(key)
        if value is not None:
            return value
    return default


async def _find_exam(db, exam_id: str):
    return await db.exams.find_one(_exam_query(exam_id))


async def _find_assessment(db, assessment_id: str):
    return await db.assessments.find_one(_assessment_query(assessment_id))


async def _ensure_exam_access(db, exam_id: str, current_user: dict):
    exam = await _find_exam(db, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    if _role(current_user) == "Examiner":
        examiner_id = exam.get("examiner_id") or exam.get("examinerid")
        if str(examiner_id) != str(_user_id(current_user)):
            raise HTTPException(status_code=403, detail="Access denied")

    return exam


async def _ensure_assessment_access(
    db,
    assessment: dict,
    current_user: dict,
):
    role = _role(current_user)
    current_user_id = _user_id(current_user)
    candidate_id = assessment.get("candidate_id") or assessment.get("candidateid")
    examiner_id = assessment.get("examiner_id") or assessment.get("examinerid")

    if role == "Candidate" and str(candidate_id) != str(current_user_id):
        raise HTTPException(status_code=403, detail="Access denied")

    if role == "Examiner" and str(examiner_id) != str(current_user_id):
        exam_id = assessment.get("exam_id") or assessment.get("examid")
        exam = await _find_exam(db, exam_id)
        exam_examiner_id = (exam or {}).get("examiner_id") or (exam or {}).get(
            "examinerid"
        )
        if str(exam_examiner_id) != str(current_user_id):
            raise HTTPException(status_code=403, detail="Access denied")


async def _ensure_candidate_exam_access(
    db,
    exam_id: str,
    candidate_id: str,
    current_user: dict,
):
    if _role(current_user) == "Candidate":
        if str(_user_id(current_user)) != str(candidate_id):
            raise HTTPException(status_code=403, detail="Access denied")

        assessment = await db.assessments.find_one(
            _candidate_exam_query(exam_id, candidate_id)
        )
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")

        return assessment

    await _ensure_exam_access(db, exam_id, current_user)
    return await db.assessments.find_one(
        _candidate_exam_query(exam_id, candidate_id)
    )


def _normalize_warning(document: dict) -> dict:
    data = _serialize(document)
    warning_id = data.get("warningid") or data.get("warning_id")
    created_at = data.get("createdat") or data.get("created_at") or data.get(
        "timestamp"
    )

    data.update(
        {
            "warningid": warning_id,
            "warning_id": warning_id,
            "eventtype": "WARNING",
            "event_type": "WARNING",
            "timestamp": created_at,
            "createdat": created_at,
            "created_at": created_at,
            "evidenceavailable": False,
            "evidence_available": False,
        }
    )
    return data


def _normalize_violation(document: dict) -> dict:
    data = _serialize(document)
    violation_id = data.get("violationid") or data.get("violation_id")
    created_at = data.get("createdat") or data.get("created_at") or data.get(
        "timestamp"
    )
    evidence_object = (
        data.get("evidenceobject")
        or data.get("evidence_object")
        or data.get("screenshotpath")
        or data.get("screenshot_path")
    )
    evidence_available = bool(
        data.get("evidenceavailable")
        or data.get("evidence_available")
        or evidence_object
    )

    data.update(
        {
            "violationid": violation_id,
            "violation_id": violation_id,
            "eventtype": "VIOLATION",
            "event_type": "VIOLATION",
            "timestamp": created_at,
            "createdat": created_at,
            "created_at": created_at,
            "evidenceavailable": evidence_available,
            "evidence_available": evidence_available,
            "evidenceobject": evidence_object,
            "evidence_object": evidence_object,
        }
    )
    return data


@router.get("/assessment/{assessment_id}")
async def get_violations_by_assessment(
    assessment_id: str,
    current_user=Depends(require_role("Examiner", "Admin", "Candidate")),
):
    db = get_db()
    assessment = await _find_assessment(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    await _ensure_assessment_access(db, assessment, current_user)

    violations = (
        await db.violations.find(_assessment_query(assessment_id))
        .sort(_created_sort())
        .to_list(None)
    )

    return [_normalize_violation(item) for item in violations]


@router.get("/{violation_id}/evidence")
async def get_violation_evidence(
    violation_id: str,
    current_user=Depends(require_role("Examiner", "Admin")),
):
    db = get_db()
    violation = await db.violations.find_one(_violation_query(violation_id))
    if not violation:
        raise HTTPException(status_code=404, detail="Violation not found")

    exam_id = violation.get("exam_id") or violation.get("examid")
    if not exam_id:
        raise HTTPException(
            status_code=400,
            detail="Violation does not contain an exam ID",
        )

    await _ensure_exam_access(db, exam_id, current_user)

    evidence_object = (
        violation.get("evidenceobject")
        or violation.get("evidence_object")
        or violation.get("screenshotpath")
        or violation.get("screenshot_path")
    )
    if not evidence_object:
        raise HTTPException(
            status_code=404,
            detail="Evidence is not available for this violation",
        )

    try:
        evidence_content = await run_in_threadpool(
            get_evidence_base64,
            evidence_object,
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        print("[Violation Evidence] Evidence loading failed:", error)
        raise HTTPException(
            status_code=500,
            detail="Evidence image could not be loaded",
        ) from error

    data = _normalize_violation(violation)
    content_type = (
        evidence_content.get("contenttype")
        or evidence_content.get("content_type")
        or data.get("evidencemimetype")
        or data.get("evidence_mime_type")
        or "image/jpeg"
    )
    data_url = evidence_content.get("dataurl") or evidence_content.get("data_url")
    image_base64 = evidence_content.get("imagebase64") or evidence_content.get(
        "image_base64"
    )

    if not data_url:
        raise HTTPException(
            status_code=500,
            detail="Evidence image data is empty",
        )

    return {
        "violationid": data.get("violationid"),
        "violation_id": data.get("violation_id"),
        "examid": data.get("examid") or data.get("exam_id"),
        "exam_id": data.get("exam_id") or data.get("examid"),
        "candidateid": data.get("candidateid") or data.get("candidate_id"),
        "candidate_id": data.get("candidate_id") or data.get("candidateid"),
        "assessmentid": data.get("assessmentid") or data.get("assessment_id"),
        "assessment_id": data.get("assessment_id") or data.get("assessmentid"),
        "detail": data.get("detail"),
        "message": data.get("message"),
        "confidence": data.get("confidence", 0.0),
        "timestamp": data.get("timestamp"),
        "evidenceavailable": True,
        "evidence_available": True,
        "evidencestatus": "available",
        "evidence_status": "available",
        "evidencemimetype": content_type,
        "evidence_mime_type": content_type,
        "evidenceobject": evidence_object,
        "evidence_object": evidence_object,
        "imagebase64": image_base64,
        "image_base64": image_base64,
        "dataurl": data_url,
        "data_url": data_url,
        "imageurl": data_url,
        "image_url": data_url,
        "size": evidence_content.get("size", 0),
    }


@router.patch("/{violation_id}/review")
async def review_violation(
    violation_id: str,
    body: dict,
    current_user=Depends(require_role("Examiner", "Admin")),
):
    db = get_db()
    violation = await db.violations.find_one(_violation_query(violation_id))
    if not violation:
        raise HTTPException(status_code=404, detail="Violation not found")

    exam_id = violation.get("exam_id") or violation.get("examid")
    await _ensure_exam_access(db, exam_id, current_user)

    note = str(body.get("note") or body.get("review_note") or "").strip()
    status = str(body.get("status") or "Reviewed").strip()
    now = datetime.utcnow()
    user_id = _user_id(current_user)

    await db.violations.update_one(
        _violation_query(violation_id),
        {
            "$set": {
                "reviewed": True,
                "reviewedby": user_id,
                "reviewed_by": user_id,
                "reviewnote": note,
                "review_note": note,
                "reviewedat": now,
                "reviewed_at": now,
                "status": status,
            }
        },
    )

    updated = await db.violations.find_one(_violation_query(violation_id))
    return {
        "message": "Violation reviewed",
        "violation": _normalize_violation(updated),
    }


@router.get("/{exam_id}/{candidate_id}/events")
async def get_monitoring_events(
    exam_id: str,
    candidate_id: str,
    current_user=Depends(require_role("Examiner", "Admin", "Candidate")),
):
    db = get_db()
    assessment = await _ensure_candidate_exam_access(
        db,
        exam_id,
        candidate_id,
        current_user,
    )

    query = _candidate_exam_query(exam_id, candidate_id)
    warnings = await db.warnings.find(query).sort(_created_sort()).to_list(None)
    violations = await db.violations.find(query).sort(_created_sort()).to_list(None)

    warning_count = int(
        _assessment_value(
            assessment or {},
            "warningcount",
            "warning_count",
            default=len(warnings),
        )
        or 0
    )
    violation_count = int(
        _assessment_value(
            assessment or {},
            "violationcount",
            "violation_count",
            default=len(violations),
        )
        or 0
    )
    credibility_score = int(
        _assessment_value(
            assessment or {},
            "credibilityscore",
            "credibility_score",
            default=100,
        )
        or 0
    )

    return {
        "examid": exam_id,
        "exam_id": exam_id,
        "candidateid": candidate_id,
        "candidate_id": candidate_id,
        "assessmentid": (assessment or {}).get("assessmentid")
        or (assessment or {}).get("assessment_id"),
        "assessment_id": (assessment or {}).get("assessment_id")
        or (assessment or {}).get("assessmentid"),
        "warnings": [_normalize_warning(item) for item in warnings],
        "violations": [_normalize_violation(item) for item in violations],
        "warningcount": warning_count,
        "warning_count": warning_count,
        "violationcount": violation_count,
        "violation_count": violation_count,
        "credibilityscore": credibility_score,
        "credibility_score": credibility_score,
    }


@router.get("/{exam_id}/{candidate_id}")
async def get_violations(
    exam_id: str,
    candidate_id: str,
    current_user=Depends(require_role("Examiner", "Admin", "Candidate")),
):
    db = get_db()
    await _ensure_candidate_exam_access(
        db,
        exam_id,
        candidate_id,
        current_user,
    )

    violations = (
        await db.violations.find(_candidate_exam_query(exam_id, candidate_id))
        .sort(_created_sort())
        .to_list(None)
    )

    return [_normalize_violation(item) for item in violations]
