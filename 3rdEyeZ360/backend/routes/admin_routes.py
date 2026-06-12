from fastapi import APIRouter, Depends
from config.database import get_db
from middleware.auth import require_role
import uuid
from datetime import datetime
router = APIRouter(prefix="/api/admin", tags=["Admin"])

@router.get("/stats")
async def get_stats(current_user=Depends(require_role("Admin"))):
    db = get_db()
    return {
        "total_candidates": await db.users.count_documents({"role": "Candidate"}),
        "total_examiners": await db.users.count_documents({"role": "Examiner"}),
        "total_exams": await db.exams.count_documents({}),
        "active_assessments": await db.assessments.count_documents({"status": "ACTIVE"})
    }

@router.get("/audit-logs")
async def get_audit_logs(current_user=Depends(require_role("Admin"))):
    db = get_db()
    logs = await db.audit_logs.find().sort("timestamp", -1).limit(200).to_list(None)
    return [{k: str(v) if k == "_id" else v for k, v in log.items() if k != "_id"} for log in logs]