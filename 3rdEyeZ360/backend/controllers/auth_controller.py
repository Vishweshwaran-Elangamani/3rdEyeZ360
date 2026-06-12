from config.keycloak_client import keycloak_openid
from config.database import get_db
from utils.id_generator import generate_user_id
from datetime import datetime

async def login(email: str, password: str):
    token_response = keycloak_openid.token(email, password)
    token_info = keycloak_openid.introspect(token_response["access_token"])
    keycloak_id = token_info["sub"]
    roles = token_info.get("realm_access", {}).get("roles", [])
    role = next((r for r in ["Admin", "Examiner", "Candidate"] if r in roles), None)
    if not role:
        raise Exception("No valid role assigned in Keycloak")
    db = get_db()
    user = await db.users.find_one({"keycloak_id": keycloak_id})
    if not user:
        user_id = await generate_user_id(role)
        name = f"{token_info.get('given_name', '')} {token_info.get('family_name', '')}".strip()
        user = {
            "user_id": user_id,
            "keycloak_id": keycloak_id,
            "name": name or email,
            "email": email,
            "role": role,
            "status": "Active",
            "created_at": datetime.utcnow(),
            "last_login": datetime.utcnow()
        }
        await db.users.insert_one(user)
    else:
        await db.users.update_one(
            {"keycloak_id": keycloak_id},
            {"$set": {"last_login": datetime.utcnow()}}
        )
        user = await db.users.find_one({"keycloak_id": keycloak_id})
    return {
        "access_token": token_response["access_token"],
        "refresh_token": token_response["refresh_token"],
        "expires_in": token_response["expires_in"],
        "user": {k: str(v) if k == "_id" else v for k, v in user.items() if k != "_id"}
    }

async def refresh_token(refresh_token: str):
    return keycloak_openid.refresh_token(refresh_token)

async def logout(refresh_token: str):
    keycloak_openid.logout(refresh_token)
    return {"message": "Logged out"}