from fastapi import APIRouter, Depends, HTTPException
from config.database import get_db
from middleware.auth import require_role
import uuid
from datetime import datetime

router = APIRouter(prefix="/api/assessments", tags=["Assessments"])


@router.post("/{assessment_id}/action")
async def assessment_action(
    assessment_id: str,
    body: dict,
    current_user=Depends(require_role("Examiner", "Admin"))
):
    db = get_db()
    action = body.get("action", "").lower()
    reason = body.get("reason", "")

    if not reason.strip():
        raise HTTPException(status_code=400, detail="Reason is required")

    status_map = {
        "pause":     "PAUSED",
        "resume":    "ACTIVE",
        "terminate": "TERMINATED"
    }
    new_status = status_map.get(action)
    if not new_status:
        raise HTTPException(status_code=400, detail=f"Invalid action: {action}")

    result = await db.assessments.update_one(
        {"assessment_id": assessment_id},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow().isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Assessment not found")

    await db.audit_logs.insert_one({
        "audit_id":       str(uuid.uuid4()),
        "user_id":        current_user["user_id"],
        "action":         f"{action.capitalize()}Assessment",
        "target_id":      assessment_id,
        "reason":         reason,
        "timestamp":      datetime.utcnow().isoformat()
    })

    return {"message": f"Assessment {action}d successfully", "new_status": new_status}


@router.get("/{assessment_id}")
async def get_assessment(
    assessment_id: str,
    current_user=Depends(require_role("Examiner", "Admin", "Candidate"))
):
    db = get_db()
    assessment = await db.assessments.find_one({"assessment_id": assessment_id})
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return {k: str(v) if k == "_id" else v for k, v in assessment.items() if k != "_id"}


@router.post("/{assessment_id}/reentry")
async def request_reentry(
    assessment_id: str,
    body: dict,
    current_user=Depends(require_role("Candidate"))
):
    db = get_db()
    reason = body.get("reason", "")
    if not reason.strip():
        raise HTTPException(status_code=400, detail="Reason is required")

    existing = await db.reentry_requests.find_one({
        "assessment_id": assessment_id,
        "status": "Pending"
    })
    if existing:
        raise HTTPException(status_code=400, detail="A pending re-entry request already exists")

    request_id = str(uuid.uuid4())
    await db.reentry_requests.insert_one({
        "request_id":    request_id,
        "assessment_id": assessment_id,
        "candidate_id":  current_user["user_id"],
        "reason":        reason,
        "status":        "Pending",
        "created_at":    datetime.utcnow().isoformat()
    })
    return {"message": "Re-entry request submitted", "request_id": request_id}


@router.post("/{assessment_id}/reentry/{request_id}/approve")
async def approve_reentry(
    assessment_id: str,
    request_id: str,
    current_user=Depends(require_role("Examiner", "Admin"))
):
    db = get_db()
    await db.reentry_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "Approved", "reviewed_by": current_user["user_id"],
                  "reviewed_at": datetime.utcnow().isoformat()}}
    )
    await db.assessments.update_one(
        {"assessment_id": assessment_id},
        {"$set": {"status": "ACTIVE"}}
    )
    return {"message": "Re-entry approved"}


@router.post("/{assessment_id}/reentry/{request_id}/reject")
async def reject_reentry(
    assessment_id: str,
    request_id: str,
    body: dict,
    current_user=Depends(require_role("Examiner", "Admin"))
):
    db = get_db()
    await db.reentry_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "Rejected", "reviewed_by": current_user["user_id"],
                  "reviewed_at": datetime.utcnow().isoformat(),
                  "rejection_reason": body.get("reason", "")}}
    )
    return {"message": "Re-entry rejected"}


@router.post("/detect")
async def handle_detection(
    body: dict,
    current_user=Depends(require_role("Candidate"))
):
    """
    Called by Electron main process IPC after Python detection.
    Processes warning → violation pipeline.
    """
    db = get_db()
    assessment_id   = body.get("assessment_id")
    candidate_id    = body.get("candidate_id")
    exam_id         = body.get("exam_id")
    detection_type  = body.get("detection_type")
    detail          = body.get("detail")
    confidence      = float(body.get("confidence", 0.0))
    screenshot_b64  = body.get("screenshot_b64", "")

    if not assessment_id or not detection_type:
        raise HTTPException(status_code=400, detail="Missing required fields")

    # Ignore low-confidence detections
    if confidence < 0.55:
        return {"action": "ignored", "message": "Low confidence — ignored"}

    assessment = await db.assessments.find_one({"assessment_id": assessment_id})
    if not assessment or assessment["status"] not in ("ACTIVE", "PAUSED"):
        return {"action": "ignored", "message": "Assessment not active"}

    exam = await db.exams.find_one({"exam_id": exam_id})
    threshold = exam.get("threshold", 10) if exam else 10

    # Count existing warnings for this type in this session
    warning_count = await db.warnings.count_documents({
        "assessment_id": assessment_id,
        "type": detection_type
    })

    WARNING_BEFORE_VIOLATION = 2  # warnings before creating a violation

    if warning_count < WARNING_BEFORE_VIOLATION:
        # Issue a warning
        await db.warnings.insert_one({
            "warning_id":    str(uuid.uuid4()),
            "assessment_id": assessment_id,
            "candidate_id":  candidate_id,
            "type":          detection_type,
            "timestamp":     datetime.utcnow().isoformat()
        })
        await db.assessments.update_one(
            {"assessment_id": assessment_id},
            {"$inc": {"warning_count": 1}}
        )
        msg = _warning_message(detection_type)
        return {"action": "toast", "level": "warning", "message": msg}

    # Create violation
    risk_score = _risk_score(detection_type)
    violation_id = str(uuid.uuid4())

    await db.violations.insert_one({
        "violation_id":  violation_id,
        "assessment_id": assessment_id,
        "candidate_id":  candidate_id,
        "exam_id":       exam_id,
        "type":          detection_type,
        "detail":        detail,
        "confidence":    confidence,
        "risk_score":    risk_score,
        "status":        "Open",
        "timestamp":     datetime.utcnow().isoformat()
    })

    # Update assessment risk score + violation count
    updated = await db.assessments.find_one_and_update(
        {"assessment_id": assessment_id},
        {"$inc": {"violation_count": 1, "risk_score": risk_score}},
        return_document=True
    )

    current_risk = updated.get("risk_score", 0) if updated else 0

    # Check threshold
    if current_risk >= threshold:
        await db.assessments.update_one(
            {"assessment_id": assessment_id},
            {"$set": {"status": "LOCKED"}}
        )
        await db.audit_logs.insert_one({
            "audit_id":  str(uuid.uuid4()),
            "user_id":   candidate_id,
            "action":    "ThresholdReached",
            "reason":    f"Risk score {current_risk} reached threshold {threshold}",
            "timestamp": datetime.utcnow().isoformat()
        })
        return {
            "action":  "violation",
            "locked":  True,
            "message": f"🔒 Assessment locked — violation threshold reached ({current_risk}/{threshold})",
            "violation_id": violation_id
        }

    msg = _violation_message(detection_type)
    return {
        "action":       "violation",
        "locked":       False,
        "message":      msg,
        "violation_id": violation_id,
        "risk_score":   current_risk
    }


def _warning_message(detection_type: str) -> str:
    messages = {
        "face_missing":          "⚠️ Please ensure your face is visible on camera",
        "multiple_face":         "⚠️ Multiple faces detected — please ensure you are alone",
        "phone_detected":        "⚠️ Mobile device detected — please remove it from view",
        "looking_away":          "⚠️ Please keep your focus on the screen",
        "noise_violation":       "⚠️ Background noise detected — please ensure a quiet environment",
        "restricted_app":        "⚠️ Restricted application detected — please close it",
        "multiple_monitor":      "⚠️ Multiple monitors detected — please disconnect the extra display",
        "charger_removed":       "⚠️ Please reconnect your charger",
    }
    return messages.get(detection_type, "⚠️ Please follow exam rules")


def _violation_message(detection_type: str) -> str:
    messages = {
        "face_missing":          "🚨 Violation: Face not visible — violation recorded",
        "multiple_face":         "🚨 Violation: Multiple people detected",
        "phone_detected":        "🚨 Violation: Mobile device detected",
        "looking_away":          "🚨 Violation: Repeated loss of focus detected",
        "noise_violation":       "🚨 Violation: Persistent background noise",
        "restricted_app":        "🚨 Violation: Unauthorized application running",
        "multiple_monitor":      "🚨 Violation: Multiple monitors in use",
        "charger_removed":       "🚨 Violation: Charger disconnected",
    }
    return messages.get(detection_type, "🚨 Violation recorded")


def _risk_score(detection_type: str) -> int:
    scores = {
        "phone_detected":   5,
        "multiple_face":    8,
        "face_missing":     2,
        "looking_away":     2,
        "noise_violation":  2,
        "restricted_app":   6,
        "multiple_monitor": 4,
        "charger_removed":  1,
    }
    return scores.get(detection_type, 2)