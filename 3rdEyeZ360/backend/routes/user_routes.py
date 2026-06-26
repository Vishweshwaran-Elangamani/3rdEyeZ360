from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from controllers.user_controller import (
    create_user_in_keycloak,
    disable_user,
    enable_user,
    get_all_users,
    get_user_by_id,
)
from middleware.auth import require_role

router = APIRouter(prefix="/api/users", tags=["Users"])


class CreateUserRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    role: str


@router.get("")
async def list_users(
    role: str | None = None,
    current_user=Depends(require_role("Admin")),
):
    return await get_all_users(role)


@router.get("/{user_id}")
async def get_user(
    user_id: str,
    current_user=Depends(require_role("Admin", "Examiner")),
):
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user["role"] == "Examiner" and user.get("role") != "Candidate":
        raise HTTPException(status_code=403, detail="Access denied")

    return user


@router.post("")
async def create_user(
    req: CreateUserRequest,
    current_user=Depends(require_role("Admin")),
):
    return await create_user_in_keycloak(
        req.first_name,
        req.last_name,
        req.email,
        req.role,
    )


@router.post("/{user_id}/disable")
async def disable_user_route(
    user_id: str,
    current_user=Depends(require_role("Admin")),
):
    return await disable_user(user_id)


@router.post("/{user_id}/enable")
async def enable_user_route(
    user_id: str,
    current_user=Depends(require_role("Admin")),
):
    return await enable_user(user_id)