from config.database import get_db
from config.keycloak_client import keycloak_admin
from utils.id_generator import generate_user_id
from datetime import datetime

async def get_all_users(role: str = None):
    db = get_db()
    query = {"role": role} if role else {}
    users = await db.users.find(query).to_list(None)
    return [{k: str(v) if k == "_id" else v for k, v in u.items() if k != "_id"} for u in users]

async def get_user_by_id(user_id: str):
    db = get_db()
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        return None
    return {k: str(v) if k == "_id" else v for k, v in user.items() if k != "_id"}

async def create_user_in_keycloak(name: str, email: str, password: str, role: str):
    db = get_db()
    # Create in Keycloak
    kc_user_id = keycloak_admin.create_user({
        "email": email,
        "username": email,
        "firstName": name.split(" ")[0],
        "lastName": " ".join(name.split(" ")[1:]) if len(name.split(" ")) > 1 else "",
        "enabled": True,
        "emailVerified": True,
        "credentials": [{"type": "password", "value": password, "temporary": False}]
    })
    # Assign role in Keycloak
    role_obj = keycloak_admin.get_realm_role(role)
    keycloak_admin.assign_realm_roles(kc_user_id, [role_obj])
    # Create in MongoDB
    user_id = await generate_user_id(role)
    user = {
        "user_id": user_id,
        "keycloak_id": kc_user_id,
        "name": name,
        "email": email,
        "role": role,
        "status": "Active",
        "created_at": datetime.utcnow(),
        "last_login": None
    }
    await db.users.insert_one(user)
    return {k: str(v) if k == "_id" else v for k, v in user.items() if k != "_id"}

async def disable_user(user_id: str):
    db = get_db()
    user = await db.users.find_one({"user_id": user_id})
    if user:
        keycloak_admin.update_user(user["keycloak_id"], {"enabled": False})
        await db.users.update_one({"user_id": user_id}, {"$set": {"status": "Disabled"}})
    return {"message": "User disabled"}