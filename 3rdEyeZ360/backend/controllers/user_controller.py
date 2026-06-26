from datetime import datetime
from fastapi import HTTPException
from config.database import getdb

try:
    from config.keycloak_client import keycloakadmin
except ImportError:
    from config.keycloakclient import keycloakadmin

try:
    from utils.id_generator import generateuserid
except ImportError:
    from utils.idgenerator import generateuserid


async def getallusers(role: str | None = None):
    db = getdb()
    query = {"role": role} if role else {}
    users = await db.users.find(query).to_list(None)
    return [
        {k: str(v) if k == "_id" else v for k, v in u.items() if k != "_id"}
        for u in users
    ]


async def getuserbyid(userid: str):
    db = getdb()
    user = await db.users.find_one({"userid": userid})
    if not user:
        return None
    return {k: str(v) if k == "_id" else v for k, v in user.items() if k != "_id"}


async def createuserinkeycloak(name: str, email: str, role: str):
    db = getdb()

    clean_name = (name or "").strip()
    clean_email = (email or "").strip().lower()
    clean_role = (role or "").strip()

    if not clean_name:
        raise HTTPException(status_code=400, detail="Name is required")
    if not clean_email:
        raise HTTPException(status_code=400, detail="Email is required")
    if not clean_role:
        raise HTTPException(status_code=400, detail="Role is required")

    if clean_role not in {"Admin", "Examiner", "Candidate"}:
        raise HTTPException(status_code=400, detail="Invalid role")

    existing = await db.users.find_one({"email": clean_email})
    if existing:
        raise HTTPException(status_code=409, detail="A user with this email already exists.")

    try:
        name_parts = clean_name.split()
        first_name = name_parts[0] if name_parts else ""
        last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""

        kc_payload = {
            "email": clean_email,
            "username": clean_email,
            "firstName": first_name,
            "lastName": last_name,
            "enabled": True,
            "emailVerified": False,
            "requiredActions": ["UPDATE_PASSWORD"],
            "attributes": {"appRole": clean_role},
        }

        kc_user_id = keycloakadmin.create_user(kc_payload)
        role_obj = keycloakadmin.get_realm_role(clean_role)
        keycloakadmin.assign_realm_roles(user_id=kc_user_id, roles=[role_obj])

        invite_sent = False
        try:
            keycloakadmin.send_update_account(
                user_id=kc_user_id,
                payload=["UPDATE_PASSWORD"]
            )
            invite_sent = True
        except Exception:
            invite_sent = False

        user_id = await generateuserid(clean_role)

        user = {
            "userid": user_id,
            "keycloakid": kc_user_id,
            "name": clean_name,
            "email": clean_email,
            "role": clean_role,
            "status": "Active",
            "createdat": datetime.utcnow(),
            "lastlogin": None,
        }

        await db.users.insert_one(user)

        result = {k: str(v) if k == "_id" else v for k, v in user.items() if k != "_id"}
        result["inviteSent"] = invite_sent
        result["message"] = (
            "User created and password setup email sent."
            if invite_sent
            else "User created, but invite email could not be sent from Keycloak."
        )
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create user in Keycloak: {str(e)}")


async def disableuser(userid: str):
    db = getdb()

    user = await db.users.find_one({"userid": userid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        keycloakid = user.get("keycloakid")
        if keycloakid:
            keycloakadmin.update_user(keycloakid, {"enabled": False})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to disable Keycloak user: {str(e)}")

    await db.users.update_one(
        {"userid": userid},
        {"$set": {"status": "Disabled"}}
    )

    return {"message": "User disabled"}


async def enableuser(userid: str):
    db = getdb()

    user = await db.users.find_one({"userid": userid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        keycloakid = user.get("keycloakid")
        if keycloakid:
            keycloakadmin.update_user(keycloakid, {"enabled": True})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to enable Keycloak user: {str(e)}")

    await db.users.update_one(
        {"userid": userid},
        {"$set": {"status": "Active"}}
    )

    return {"message": "User enabled"}


# Compatibility aliases for snake_case imports
async def get_all_users(role: str | None = None):
    return await getallusers(role)


async def get_user_by_id(userid: str):
    return await getuserbyid(userid)


async def create_user_in_keycloak(name: str, email: str, role: str):
    return await createuserinkeycloak(name, email, role)


async def disable_user(userid: str):
    return await disableuser(userid)


async def enable_user(userid: str):
    return await enableuser(userid)