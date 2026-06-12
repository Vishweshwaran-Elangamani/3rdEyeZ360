from fastapi import APIRouter
from pydantic import BaseModel
from controllers.auth_controller import login, refresh_token, logout
import uuid
from datetime import datetime

router = APIRouter(prefix="/api/auth", tags=["Auth"])

class LoginRequest(BaseModel):
    email: str
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class LogoutRequest(BaseModel):
    refresh_token: str

@router.post("/login")
async def login_route(req: LoginRequest):
    return await login(req.email, req.password)

@router.post("/refresh")
async def refresh_route(req: RefreshRequest):
    return await refresh_token(req.refresh_token)

@router.post("/logout")
async def logout_route(req: LogoutRequest):
    return await logout(req.refresh_token)