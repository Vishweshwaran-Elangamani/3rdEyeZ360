from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import os

KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://localhost:8080")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "3rdeyez360")
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"

security = HTTPBearer(auto_error=False)

def extractroleroles(roles: list) -> str:
    priority = ["Admin", "Examiner", "Candidate"]
    lowered = [str(x).lower() for x in (roles or [])]

    for role in priority:
        if role in (roles or []) or role.lower() in lowered:
            return role
    return "Candidate"

def extract_role(roles: list) -> str:
    return extractroleroles(roles)

def decodetoken(token: str) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="No token provided")

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {
            "userid": payload.get("userid") or payload.get("user_id") or payload.get("sub") or "",
            "user_id": payload.get("user_id") or payload.get("userid") or payload.get("sub") or "",
            "email": payload.get("email") or payload.get("preferred_username", ""),
            "role": payload.get("role") or extractroleroles(payload.get("roles", [])),
            "name": payload.get("name") or payload.get("email") or "",
        }
    except JWTError:
        pass

    try:
        payload = jwt.decode(
            token,
            key="",
            options={"verify_signature": False, "verify_aud": False, "verify_exp": False},
            algorithms=["RS256", "HS256"],
        )

        email = payload.get("email") or payload.get("preferred_username", "")
        roles = payload.get("realm_access", {}).get("roles", []) or payload.get("roles", [])
        role = extractroleroles(roles)

        return {
            "userid": payload.get("sub", ""),
            "user_id": payload.get("sub", ""),
            "email": email,
            "role": role,
            "name": payload.get("name", email),
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

def decode_token(token: str) -> dict:
    return decodetoken(token)

def createaccesstoken(data: dict) -> str:
    return jwt.encode(data.copy(), JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_access_token(data: dict) -> str:
    return createaccesstoken(data)

async def getcurrentuser(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    return decodetoken(credentials.credentials)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    return await getcurrentuser(credentials)

def requirerole(*roles: str):
    async def checker(
        credentials: HTTPAuthorizationCredentials = Depends(security)
    ) -> dict:
        if not credentials or not credentials.credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )

        user = decodetoken(credentials.credentials)

        if roles and user.get("role") not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {' or '.join(roles)}"
            )

        return user

    return checker

def require_role(*roles: str):
    return requirerole(*roles)