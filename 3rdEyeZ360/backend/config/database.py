from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv(override=True)

_client = None
_db = None


async def connect_db():
    global _client, _db

    mongo_url = (
        os.getenv("MONGO_URL")
        or os.getenv("MONGODB_URL")
        or "mongodb://127.0.0.1:27017"
    )
    db_name = (
        os.getenv("MONGO_DB")
        or os.getenv("MONGODB_DB")
        or "sampdb"
    )

    _client = AsyncIOMotorClient(mongo_url)
    _db = _client[db_name]

    await _db.users.create_index("keycloak_id", unique=True, sparse=True)
    await _db.users.create_index("email", unique=True)
    await _db.users.create_index("user_id", unique=True)

    await _db.exams.create_index("exam_id", unique=True)
    await _db.exams.create_index("examiner_id")
    await _db.exams.create_index("status")

    await _db.assessments.create_index("assessment_id", unique=True)
    await _db.assessments.create_index([("exam_id", 1), ("candidate_id", 1)], unique=True)
    await _db.assessments.create_index("candidate_id")
    await _db.assessments.create_index("status")

    await _db.violations.create_index("violation_id", unique=True)
    await _db.violations.create_index("assessment_id")
    await _db.violations.create_index("candidate_id")
    await _db.violations.create_index("exam_id")
    await _db.violations.create_index("timestamp")

    await _db.warnings.create_index("warning_id", unique=True)
    await _db.warnings.create_index("assessment_id")
    await _db.warnings.create_index("candidate_id")
    await _db.warnings.create_index("exam_id")

    await _db.chats.create_index([("exam_id", 1), ("candidate_id", 1)])
    await _db.chats.create_index("sent_at")

    await _db.notifications.create_index([("user_id", 1), ("created_at", -1)])

    await _db.requests.create_index("request_id", unique=True)
    await _db.requests.create_index([("assessment_id", 1), ("status", 1)])
    await _db.requests.create_index([("exam_id", 1), ("status", 1)])

    await _db.reentry_requests.create_index("request_id", unique=True)
    await _db.reentry_requests.create_index([("assessment_id", 1), ("status", 1)])

    await _db.audit_logs.create_index("log_id", unique=True)
    await _db.audit_logs.create_index("exam_id")
    await _db.audit_logs.create_index("assessment_id")
    await _db.audit_logs.create_index("user_id")
    await _db.audit_logs.create_index("timestamp")

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