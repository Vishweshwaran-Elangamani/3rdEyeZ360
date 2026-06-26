import os

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

load_dotenv(override=True)

JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"

security = HTTPBearer(auto_error=False)


def extract_role(roles: list) -> str:
    priority = ["Admin", "Examiner", "Candidate"]
    lowered = [str(value).lower() for value in (roles or [])]

    for role in priority:
        if role in (roles or []) or role.lower() in lowered:
            return role

    return "Candidate"


def decode_token(token: str) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="No token provided")

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id") or payload.get("userid") or payload.get("sub") or ""
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token subject")

        return {
            "user_id": user_id,
            "userid": user_id,
            "email": payload.get("email") or payload.get("preferred_username", ""),
            "role": payload.get("role") or extract_role(payload.get("roles", [])),
            "name": payload.get("name") or payload.get("email") or "",
        }
    except HTTPException:
        raise
    except JWTError:
        pass

    try:
        payload = jwt.decode(
            token,
            key="",
            options={
                "verify_signature": False,
                "verify_aud": False,
                "verify_exp": True,
            },
            algorithms=["RS256", "HS256"],
        )

        email = payload.get("email") or payload.get("preferred_username", "")
        roles = payload.get("realm_access", {}).get("roles", []) or payload.get("roles", [])
        role = extract_role(roles)
        user_id = payload.get("sub", "")

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token subject")

        return {
            "user_id": user_id,
            "userid": user_id,
            "email": email,
            "role": role,
            "name": payload.get("name", email),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


def create_access_token(data: dict) -> str:
    payload = data.copy()
    if "userid" in payload and "user_id" not in payload:
        payload["user_id"] = payload["userid"]
    if "user_id" in payload and "userid" not in payload:
        payload["userid"] = payload["user_id"]
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return decode_token(credentials.credentials)


def require_role(*roles: str):
    async def checker(
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ) -> dict:
        if not credentials or not credentials.credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
            )

        user = decode_token(credentials.credentials)

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