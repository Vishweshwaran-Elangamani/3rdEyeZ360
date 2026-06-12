from fastapi import APIRouter, Depends
from pydantic import BaseModel
from controllers.user_controller import get_all_users, create_user_in_keycloak, disable_user, get_user_by_id
from middleware.auth import require_role
import uuid
from datetime import datetime
router = APIRouter(prefix="/api/users", tags=["Users"])

class CreateUserRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str

@router.get("/")
async def list_users(role: str = None, current_user=Depends(require_role("Admin"))):
    return await get_all_users(role)

@router.get("/{user_id}")
async def get_user(user_id: str, current_user=Depends(require_role("Admin", "Examiner"))):
    return await get_user_by_id(user_id)

@router.post("/")
async def create_user(req: CreateUserRequest, current_user=Depends(require_role("Admin"))):
    return await create_user_in_keycloak(req.name, req.email, req.password, req.role)

@router.patch("/{user_id}/disable")
async def disable(user_id: str, current_user=Depends(require_role("Admin"))):
    return await disable_user(user_id)

@router.post("/{user_id}/disable")
async def disable_user(user_id: str, current_user=Depends(require_role("Admin"))):
    db = get_db()
    await db.users.update_one({"user_id": user_id}, {"$set": {"status": "Disabled"}})
    return {"message": "User disabled"}

@router.post("/{user_id}/enable")
async def enable_user(user_id: str, current_user=Depends(require_role("Admin"))):
    db = get_db()
    await db.users.update_one({"user_id": user_id}, {"$set": {"status": "Active"}})
    return {"message": "User enabled"}