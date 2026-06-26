from datetime import datetime

from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from config.database import get_db
from config.keycloak_client import keycloakadmin
from utils.id_generator import generate_user_id

VALID_ROLES = {"Admin", "Examiner", "Candidate"}


def _serialize_user(user: dict) -> dict:
    return {k: str(v) if k == "_id" else v for k, v in user.items() if k != "_id"}


async def get_all_users(role: str | None = None):
    db = get_db()
    query = {"role": role} if role else {}
    users = await db.users.find(query).sort("created_at", -1).to_list(None)
    return [_serialize_user(user) for user in users]


async def get_user_by_id(user_id: str):
    db = get_db()
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        return None
    return _serialize_user(user)


async def create_user_in_keycloak(first_name: str, last_name: str, email: str, role: str):
    db = get_db()

    clean_first_name = (first_name or "").strip()
    clean_last_name = (last_name or "").strip()
    clean_email = (email or "").strip().lower()
    clean_role = (role or "").strip()

    if not clean_first_name:
        raise HTTPException(status_code=400, detail="First name is required")
    if not clean_last_name:
        raise HTTPException(status_code=400, detail="Last name is required")
    if not clean_email:
        raise HTTPException(status_code=400, detail="Email is required")
    if clean_role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    existing = await db.users.find_one({"email": clean_email})
    if existing:
        raise HTTPException(status_code=409, detail="A user with this email already exists.")

    full_name = f"{clean_first_name} {clean_last_name}".strip()

    kc_payload = {
        "email": clean_email,
        "username": clean_email,
        "firstName": clean_first_name,
        "lastName": clean_last_name,
        "enabled": True,
        "emailVerified": False,
        "requiredActions": ["UPDATE_PASSWORD"],
        "attributes": {"appRole": [clean_role]},
    }

    keycloak_id = None

    try:
        create_result = keycloakadmin.create_user(kc_payload)

        if isinstance(create_result, str) and create_result.strip():
            keycloak_id = create_result.strip()
        else:
            keycloak_id = keycloakadmin.get_user_id(clean_email)

        if not keycloak_id:
            raise Exception("Keycloak user created but user ID could not be resolved")

        role_obj = keycloakadmin.get_realm_role(clean_role)
        keycloakadmin.assign_realm_roles(user_id=keycloak_id, roles=[role_obj])

        invite_sent = False
        try:
            keycloakadmin.send_update_account(
                user_id=keycloak_id,
                payload=["UPDATE_PASSWORD"],
            )
            invite_sent = True
        except Exception:
            invite_sent = False

        user = {
            "user_id": await generate_user_id(clean_role),
            "keycloak_id": keycloak_id,
            "name": full_name,
            "first_name": clean_first_name,
            "last_name": clean_last_name,
            "email": clean_email,
            "role": clean_role,
            "status": "Active",
            "created_at": datetime.utcnow(),
            "last_login": None,
        }

        await db.users.insert_one(user)

        result = _serialize_user(user)
        result["invite_sent"] = invite_sent
        result["message"] = (
            "User created and password setup email sent."
            if invite_sent
            else "User created, but invite email could not be sent from Keycloak."
        )

        return result

    except DuplicateKeyError as e:
        if keycloak_id:
            try:
                keycloakadmin.delete_user(keycloak_id)
            except Exception:
                pass
        raise HTTPException(status_code=409, detail=f"Duplicate user data: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        if keycloak_id:
            try:
                keycloakadmin.delete_user(keycloak_id)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"Failed to create user in Keycloak: {str(e)}")


async def disable_user(user_id: str):
    db = get_db()
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        if user.get("keycloak_id"):
            keycloakadmin.update_user(user["keycloak_id"], {"enabled": False})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to disable Keycloak user: {str(e)}")

    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"status": "Disabled"}},
    )
    return {"message": "User disabled"}


async def enable_user(user_id: str):
    db = get_db()
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        if user.get("keycloak_id"):
            keycloakadmin.update_user(user["keycloak_id"], {"enabled": True})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to enable Keycloak user: {str(e)}")

    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"status": "Active"}},
    )
    return {"message": "User enabled"}


async def getallusers(role: str | None = None):
    return await get_all_users(role)


async def getuserbyid(user_id: str):
    return await get_user_by_id(user_id)


async def createuserinkeycloak(first_name: str, last_name: str, email: str, role: str):
    return await create_user_in_keycloak(first_name, last_name, email, role)


async def disableuser(user_id: str):
    return await disable_user(user_id)


async def enableuser(user_id: str):
    return await enable_user(user_id)