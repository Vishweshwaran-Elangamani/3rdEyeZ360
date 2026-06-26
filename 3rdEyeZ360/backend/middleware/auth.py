import os

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from config.database import get_db

load_dotenv(override=True)

security = HTTPBearer(auto_error=False)


def extract_role(roles: list) -> str:
    priority = ["Admin", "Examiner", "Candidate"]
    lowered = [str(value).lower() for value in (roles or [])]

    for role in priority:
        if role in (roles or []) or role.lower() in lowered:
            return role

    return "Candidate"


async def decode_token(token: str) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="No token provided")

    try:
        payload = jwt.get_unverified_claims(token)
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

    keycloak_id = payload.get("sub")
    email = (payload.get("email") or payload.get("preferred_username") or "").strip().lower()
    roles = payload.get("realm_access", {}).get("roles", []) or payload.get("roles", [])
    role = payload.get("role") or extract_role(roles)
    name = payload.get("name") or email or ""

    if not keycloak_id:
        raise HTTPException(status_code=401, detail="Invalid token subject")

    db = get_db()

    user = await db.users.find_one({"keycloak_id": keycloak_id})
    if not user and email:
        user = await db.users.find_one({"email": email})

    if not user:
        raise HTTPException(status_code=401, detail="User not found in local database")

    if user.get("status") == "Disabled":
        raise HTTPException(status_code=403, detail="User is disabled")

    return {
        "user_id": user["user_id"],
        "keycloak_id": user.get("keycloak_id"),
        "email": user.get("email"),
        "role": user.get("role") or role,
        "name": user.get("name") or name,
        "status": user.get("status", "Active"),
    }


def create_access_token(data: dict) -> str:
    raise RuntimeError("Local JWT creation is disabled. Authentication is managed by Keycloak.")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return await decode_token(credentials.credentials)


def require_role(*roles: str):
    async def checker(
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ) -> dict:
        if not credentials or not credentials.credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
            )

        user = await decode_token(credentials.credentials)

        if roles and user.get("role") not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {' or '.join(roles)}",
            )

        return user

    return checker


extractroleroles = extract_role
decodetoken = decode_token
createaccesstoken = create_access_token
getcurrentuser = get_current_user
requirerole = require_role