from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv(override=True)

_client = None
_db = None


async def connect_db():
    global _client, _db

    mongo_url = os.getenv("MONGO_URL") or os.getenv("MONGODB_URL") or "mongodb://127.0.0.1:27017"
    db_name = os.getenv("MONGO_DB") or os.getenv("MONGODB_DB") or "samp_db"

    _client = AsyncIOMotorClient(mongo_url)
    _db = _client[db_name]

    existing_indexes = await _db.users.index_information()

    if "userid_1" in existing_indexes:
        await _db.users.drop_index("userid_1")

    if "keycloak_id_1" in existing_indexes:
        await _db.users.drop_index("keycloak_id_1")

    await _db.users.create_index("user_id", unique=True)
    await _db.users.create_index("keycloak_id", unique=True, sparse=True)
    await _db.users.create_index("email", unique=True)

    await _db.exams.create_index("exam_id", unique=True)
    await _db.assessments.create_index("assessment_id", unique=True)

    print(f"MongoDB connected - {db_name}")


async def close_db():
    global _client, _db
    if _client is not None:
        _client.close()
        _client = None
        _db = None


def get_db():
    if _db is None:
        raise RuntimeError("Database not initialized. Call connect_db() first.")
    return _db


connectdb = connect_db
closedb = close_db
getdb = get_db