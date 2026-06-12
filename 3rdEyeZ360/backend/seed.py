import asyncio
import uuid
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

MONGO_URL = "mongodb://localhost:27017"
DB_NAME   = "sampdb"
pwd_ctx   = CryptContext(schemes=["bcrypt"], deprecated="auto")

USERS = [
    {"name": "Super Admin",    "email": "admin@test.com",     "password": "password123", "role": "Admin"},
    {"name": "Sarah Examiner", "email": "examiner@test.com",  "password": "password123", "role": "Examiner"},
    {"name": "John Candidate", "email": "candidate@test.com", "password": "password123", "role": "Candidate"},
    {"name": "Jane Candidate", "email": "candidate2@test.com","password": "password123", "role": "Candidate"},
]

async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    # Clear existing
    await db.users.delete_many({})
    print("Cleared users")

    for u in USERS:
        doc = {
            "user_id":    str(uuid.uuid4()),
            "name":       u["name"],
            "email":      u["email"],
            "password": pwd_ctx.hash(u["password"][:72]),
            "role":       u["role"],
            "status":     "Active",
            "created_at": datetime.utcnow().isoformat()
        }
        await db.users.insert_one(doc)
        print(f"✅ Created {u['role']}: {u['email']} / {u['password']}")

    client.close()
    print("\n🌱 Seed complete. You can now log in.")

asyncio.run(seed())