from fastapi import APIRouter, Depends
from config.database import get_db
from middleware.auth import require_role
import uuid
from datetime import datetime

router = APIRouter(prefix="/api/violations", tags=["Violations"])

@router.get("/{exam_id}/{candidate_id}")
async def get_violations(exam_id: str, candidate_id: str,
                         current_user=Depends(require_role("Examiner", "Admin"))):
    db = get_db()
    violations = await db.violations.find(
        {"exam_id": exam_id, "candidate_id": candidate_id}
    ).sort("timestamp", -1).to_list(None)
    return [{k: str(v) if k == "_id" else v for k, v in v.items() if k != "_id"} for v in violations]