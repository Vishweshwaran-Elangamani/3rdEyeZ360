from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from controllers.auth_controller import login, refresh_token, logout

router = APIRouter(prefix="/api/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refreshtoken: str


class LogoutRequest(BaseModel):
    refreshtoken: str


@router.post("/login")
async def loginroute(req: LoginRequest):
    try:
        return await login(req.email, req.password)
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/refresh")
async def refreshroute(req: RefreshRequest):
    try:
        return await refresh_token(req.refreshtoken)
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/logout")
async def logoutroute(req: LogoutRequest):
    try:
        return await logout(req.refreshtoken)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))