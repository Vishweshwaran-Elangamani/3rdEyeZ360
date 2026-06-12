from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv(override=True)

client: AsyncIOMotorClient = None
db = None

async def connect_db():
    global client, db
    client = AsyncIOMotorClient(os.getenv("MONGO_URL", "mongodb://127.0.0.1:27017/samp_db"))
    db = client[os.getenv("MONGO_DB", "samp_db")]
    await db.users.create_index("keycloak_id", unique=True)
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.exams.create_index("examiner_id")
    await db.assessments.create_index([("exam_id", 1), ("candidate_id", 1)], unique=True)
    await db.violations.create_index("assessment_id")
    await db.warnings.create_index("assessment_id")
    await db.chats.create_index([("exam_id", 1), ("candidate_id", 1)])
    await db.audit_logs.create_index("exam_id")
    print("✅ MongoDB connected and indexes created")

async def close_db():
    global client
    if client:
        client.close()

def get_db():
    return db