from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv(override=True)

_client = None
_db = None


async def connect_db():
    global _client, _db
    mongo_url = os.getenv("MONGO_URL", os.getenv("MONGODB_URL", "mongodb://127.0.0.1:27017"))
    db_name = os.getenv("MONGODB_DB", os.getenv("MONGO_DB", "sampdb"))

    _client = AsyncIOMotorClient(mongo_url)
    _db = _client[db_name]

    await _db.users.create_index("keycloakid", unique=True, sparse=True)
    await _db.users.create_index("email", unique=True)
    await _db.users.create_index("userid", unique=True)
    await _db.exams.create_index("examinerid")
    await _db.assessments.create_index([("examid", 1), ("candidateid", 1)], unique=True)
    await _db.violations.create_index("assessmentid")
    await _db.warnings.create_index("assessmentid")
    await _db.chats.create_index([("examid", 1), ("candidateid", 1)])
    await _db.auditlogs.create_index("examid")

    print(f"MongoDB connected — {db_name}")


async def close_db():
    global _client
    if _client:
        _client.close()


def get_db():
    if _db is None:
        raise RuntimeError("Database not initialized. Call connect_db() first.")
    return _db


# Legacy aliases — used by files still calling old names
connectdb = connect_db
closedb = close_db
getdb = get_db