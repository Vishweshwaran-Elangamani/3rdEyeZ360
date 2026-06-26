from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from controllers.user_controller import (
    getallusers,
    getuserbyid,
    createuserinkeycloak,
    disableuser,
    enableuser,
)
from middleware.auth import requirerole

router = APIRouter(prefix="/api/users", tags=["Users"])


class CreateUserRequest(BaseModel):
    name: str
    email: EmailStr
    role: str


@router.get("")
async def listusers(
    role: str | None = None,
    currentuser=Depends(requirerole("Admin"))
):
    return await getallusers(role)


@router.get("/{userid}")
async def getuser(
    userid: str,
    currentuser=Depends(requirerole("Admin", "Examiner"))
):
    user = await getuserbyid(userid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("")
async def createuser(
    req: CreateUserRequest,
    currentuser=Depends(requirerole("Admin"))
):
    return await createuserinkeycloak(req.name, req.email, req.role)


@router.post("/{userid}/disable")
async def disableuserroute(
    userid: str,
    currentuser=Depends(requirerole("Admin"))
):
    return await disableuser(userid)


@router.post("/{userid}/enable")
async def enableuserroute(
    userid: str,
    currentuser=Depends(requirerole("Admin"))
):
    return await enableuser(userid)