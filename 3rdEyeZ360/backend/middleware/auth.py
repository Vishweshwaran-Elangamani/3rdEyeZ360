from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config.keycloak_client import keycloak_openid
from config.database import get_db

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        token_info = keycloak_openid.introspect(token)
        if not token_info.get("active"):
            raise HTTPException(status_code=401, detail="Token expired or invalid")

        keycloak_id = token_info.get("sub")
        db = get_db()
        user = await db.users.find_one({"keycloak_id": keycloak_id})

        if not user:
            raise HTTPException(status_code=404, detail="User not found in system")

        return user

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


def require_role(*roles):
    async def role_checker(current_user=Depends(get_current_user)):
        if current_user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Access denied")
        return current_user
    return role_checker