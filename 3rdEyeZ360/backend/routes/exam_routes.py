from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from controllers.exam_controller import (create_exam, get_exams_by_examiner,
                                          get_exam, assign_candidates, publish_exam)
from config.database import get_db as _get_db

from middleware.auth import require_role
import uuid
from datetime import datetime

router = APIRouter(prefix="/api/exams", tags=["Exams"])

class CreateExamRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    date: str
    start_time: str
    end_time: str
    duration_minutes: int
    violation_threshold: int = 10
    allowed_websites: List[str] = []
    instructions: Optional[str] = ""

class AssignRequest(BaseModel):
    candidate_ids: List[str]

@router.post("/")
async def create(req: CreateExamRequest, current_user=Depends(require_role("Examiner"))):
    return await create_exam(req.dict(), current_user["user_id"])

@router.get("/")
async def list_exams(current_user=Depends(require_role("Examiner", "Admin"))):
    return await get_exams_by_examiner(current_user["user_id"])


# This MUST come before @router.get("/{exam_id}")
@router.get("/candidate/upcoming")
async def candidate_upcoming(...):
@router.get("/{exam_id}")
async def get_one(exam_id: str, current_user=Depends(require_role("Examiner", "Admin", "Candidate"))):
    return await get_exam(exam_id)

@router.post("/{exam_id}/assign")
async def assign(exam_id: str, req: AssignRequest, current_user=Depends(require_role("Examiner"))):
    return await assign_candidates(exam_id, req.candidate_ids, current_user["user_id"])

@router.patch("/{exam_id}/publish")
async def publish(exam_id: str, current_user=Depends(require_role("Examiner"))):
    return await publish_exam(exam_id)


@router.get("/{exam_id}/assessments")
async def get_assessments(exam_id: str, current_user=Depends(require_role("Examiner", "Admin"))):
    db = _get_db()
    assessments = await db.assessments.find({"exam_id": exam_id}).to_list(None)
    result = []
    for a in assessments:
        user = await db.users.find_one({"user_id": a["candidate_id"]})
        a["candidate_name"] = user["name"] if user else a["candidate_id"]
        result.append({k: str(v) if k == "_id" else v for k, v in a.items() if k != "_id"})
    return result

@router.patch("/{exam_id}/start")
async def start_exam(exam_id: str, current_user=Depends(require_role("Examiner"))):
    db = _get_db()
    await db.exams.update_one({"exam_id": exam_id}, {"$set": {"status": "Running"}})
    return {"message": "Exam started"}

@router.get("/candidate/upcoming")
async def candidate_upcoming(current_user=Depends(require_role("Candidate"))):
    db = _get_db()
    assessment = await db.assessments.find_one(
        {"candidate_id": current_user["user_id"], "status": {"$in": ["ASSIGNED","AVAILABLE","READY"]}}
    )
    if not assessment:
        return None
    exam = await db.exams.find_one({"exam_id": assessment["exam_id"]})
    return {
        "exam": {k: str(v) if k == "_id" else v for k, v in exam.items() if k != "_id"},
        "assessment": {k: str(v) if k == "_id" else v for k, v in assessment.items() if k != "_id"}
    }

@router.delete("/{exam_id}/assign/{candidate_id}")
async def remove_candidate(exam_id: str, candidate_id: str,
                           current_user=Depends(require_role("Examiner", "Admin"))):
    db = _get_db()
    await db.assessments.delete_one({"exam_id": exam_id, "candidate_id": candidate_id})
    return {"message": "Candidate removed"}

@router.get("/{exam_id}/requests")
async def get_requests(exam_id: str,
                       current_user=Depends(require_role("Examiner", "Admin"))):
    db = _get_db()
    # Get all assessments for this exam
    assessments = await db.assessments.find({"exam_id": exam_id}).to_list(None)
    assessment_ids = [a["assessment_id"] for a in assessments]

    requests = await db.reentry_requests.find(
        {"assessment_id": {"$in": assessment_ids}}
    ).sort("created_at", -1).to_list(None)

    result = []
    for r in requests:
        user = await db.users.find_one({"user_id": r["candidate_id"]})
        r["candidate_name"] = user["name"] if user else r["candidate_id"]
        r["type"] = "reentry"
        result.append({k: str(v) if k == "_id" else v for k, v in r.items() if k != "_id"})
    return result