from datetime import datetime
from fastapi import HTTPException

from config.keycloak_client import keycloakopenid
from config.database import get_db
from utils.id_generator import generate_user_id


def _serialize_user(user: dict) -> dict:
    return {k: str(v) if k == "_id" else v for k, v in user.items() if k != "_id"}


async def login(email: str, password: str):
    clean_email = (email or "").strip().lower()

    if not clean_email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    try:
        token_response = keycloakopenid.token(clean_email, password)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid email or password: {str(e)}")

    try:
        token_info = keycloakopenid.introspect(token_response["access_token"])
    except Exception:
        token_info = {}

    keycloak_id = token_info.get("sub")
    roles = token_info.get("realm_access", {}).get("roles", [])
    role = next((r for r in ["Admin", "Examiner", "Candidate"] if r in roles), None)

    if not keycloak_id:
        raise HTTPException(status_code=401, detail="Unable to resolve Keycloak user ID")
    if not role:
        raise HTTPException(status_code=403, detail="No valid role assigned in Keycloak")

    given = token_info.get("given_name", "") or ""
    family = token_info.get("family_name", "") or ""
    display_name = f"{given} {family}".strip() or clean_email

    db = get_db()
    user = await db.users.find_one({"keycloak_id": keycloak_id})

    if user:
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "email": clean_email,
                    "name": display_name,
                    "role": role,
                    "status": "Active",
                    "last_login": datetime.utcnow(),
                }
            },
        )
        user = await db.users.find_one({"_id": user["_id"]})
    else:
        existing_by_email = await db.users.find_one({"email": clean_email})

        if existing_by_email:
            await db.users.update_one(
                {"_id": existing_by_email["_id"]},
                {
                    "$set": {
                        "keycloak_id": keycloak_id,
                        "name": display_name,
                        "role": role,
                        "status": "Active",
                        "last_login": datetime.utcnow(),
                    }
                },
            )
            user = await db.users.find_one({"_id": existing_by_email["_id"]})
        else:
            user = {
                "user_id": await generate_user_id(role),
                "keycloak_id": keycloak_id,
                "name": display_name,
                "email": clean_email,
                "role": role,
                "status": "Active",
                "created_at": datetime.utcnow(),
                "last_login": datetime.utcnow(),
            }
            await db.users.insert_one(user)

    return {
        "access_token": token_response["access_token"],
        "refresh_token": token_response["refresh_token"],
        "expires_in": token_response.get("expires_in"),
        "user": _serialize_user(user),
    }


async def refresh_token(refresh_token_value: str):
    try:
        return keycloakopenid.refresh_token(refresh_token_value)
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


async def logout(refresh_token_value: str):
    try:
        keycloakopenid.logout(refresh_token_value)
        return {"message": "Logged out"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


async def refreshtoken(refresh_token_value: str):
    return await refresh_token(refresh_token_value)