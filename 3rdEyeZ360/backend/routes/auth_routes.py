from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from controllers.auth_controller import login, logout, refresh_token

router = APIRouter(prefix="/api/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


@router.post("/login")
async def login_route(req: LoginRequest):
    try:
        return await login(req.email, req.password)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/refresh")
async def refresh_route(req: RefreshRequest):
    try:
        return await refresh_token(req.refresh_token)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/logout")
async def logout_route(req: LogoutRequest):
    try:
        return await logout(req.refresh_token)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))