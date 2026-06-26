from datetime import datetime
from config.keycloak_client import keycloakopenid
from config.database import getdb
from utils.id_generator import generateuserid

async def login(email: str, password: str):
    try:
        tokenresponse = keycloakopenid.token(email, password)
    except Exception as e:
        raise Exception(f"Invalid email or password: {str(e)}")

    tokeninfo = keycloakopenid.introspect(tokenresponse["access_token"])
    keycloakid = tokeninfo.get("sub")
    roles = tokeninfo.get("realm_access", {}).get("roles", [])

    role = next((r for r in ["Admin", "Examiner", "Candidate"] if r in roles), None)
    if not role:
        raise Exception("No valid role assigned in Keycloak")

    db = getdb()
    user = await db.users.find_one({"keycloakid": keycloakid})

    if not user:
        user = await db.users.find_one({"email": email})

        if user:
            await db.users.update_one(
                {"_id": user["_id"]},
                {
                    "$set": {
                        "keycloakid": keycloakid,
                        "role": role,
                        "status": "Active",
                        "lastlogin": datetime.utcnow(),
                    }
                }
            )
            user = await db.users.find_one({"_id": user["_id"]})
        else:
            userid = await generateuserid(role)
            given = tokeninfo.get("given_name", "")
            family = tokeninfo.get("family_name", "")
            name = f"{given} {family}".strip() or email

            user = {
                "userid": userid,
                "keycloakid": keycloakid,
                "name": name,
                "email": email,
                "role": role,
                "status": "Active",
                "createdat": datetime.utcnow(),
                "lastlogin": datetime.utcnow(),
            }
            await db.users.insert_one(user)
    else:
        await db.users.update_one(
            {"keycloakid": keycloakid},
            {"$set": {"lastlogin": datetime.utcnow()}}
        )
        user = await db.users.find_one({"keycloakid": keycloakid})

    return {
        "accesstoken": tokenresponse["access_token"],
        "refreshtoken": tokenresponse["refresh_token"],
        "expiresin": tokenresponse.get("expires_in"),
        "user": {k: str(v) if k == "_id" else v for k, v in user.items() if k != "_id"},
    }

async def refresh_token(refreshtoken: str):
    return keycloakopenid.refresh_token(refreshtoken)

async def logout(refreshtoken: str):
    keycloakopenid.logout(refreshtoken)
    return {"message": "Logged out"}

# legacy compatibility aliases
async def refreshtoken(refreshtoken_value: str):
    return await refresh_token(refreshtoken_value)