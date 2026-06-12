from fastapi import APIRouter, Depends
from pydantic import BaseModel
from controllers.request_controller import create_request, review_request, get_pending_requests
from middleware.auth import require_role
import uuid
from datetime import datetime

router = APIRouter(prefix="/api/requests", tags=["Requests"])

class CreateRequestBody(BaseModel):
    assessment_id: str
    exam_id: str
    candidate_id: str
    type: str
    reason: str

class ReviewBody(BaseModel):
    decision: str

@router.post("/")
async def submit(req: CreateRequestBody, current_user=Depends(require_role("Candidate"))):
    return await create_request(req.assessment_id, req.exam_id, req.candidate_id, req.type, req.reason)

@router.patch("/{request_id}/review")
async def review(request_id: str, req: ReviewBody, current_user=Depends(require_role("Examiner"))):
    return await review_request(request_id, req.decision, current_user["user_id"])

@router.get("/exam/{exam_id}/pending")
async def pending(exam_id: str, current_user=Depends(require_role("Examiner"))):
    return await get_pending_requests(exam_id)