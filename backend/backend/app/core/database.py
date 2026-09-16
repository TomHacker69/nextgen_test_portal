from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING
from app.core.config import settings

client: AsyncIOMotorClient = None
db = None


async def connect_db():
    global client, db
    client = AsyncIOMotorClient(
        settings.MONGO_URL,
        serverSelectionTimeoutMS=10000,
        connectTimeoutMS=10000,
    )
    db = client[settings.MONGO_DB_NAME]
    # Verify connection before proceeding
    await client.admin.command("ping")
    await create_indexes()
    print(f"[DB] Connected to MongoDB: {settings.MONGO_DB_NAME}")



async def close_db():
    global client
    if client:
        client.close()
        print("[DB] MongoDB connection closed")


async def create_indexes():
    # users
    await db.users.create_index("email", unique=True, sparse=True)
    await db.users.create_index("roll_number", unique=True, sparse=True)
    await db.users.create_index("role")

    # exams
    await db.exams.create_index("status")
    await db.exams.create_index("created_by")

    # question_bank
    await db.question_bank.create_index("tags")
    await db.question_bank.create_index("subject")
    await db.question_bank.create_index("difficulty")
    await db.question_bank.create_index("created_by")

    # attempts
    await db.attempts.create_index([("exam_id", ASCENDING), ("student_id", ASCENDING)])
    await db.attempts.create_index([("exam_id", ASCENDING), ("status", ASCENDING)])
    await db.attempts.create_index([("exam_id", ASCENDING), ("score", DESCENDING)])
    await db.attempts.create_index("student_id")
    await db.attempts.create_index("status")

    # answers
    await db.answers.create_index(
        [("attempt_id", ASCENDING), ("question_id", ASCENDING)], unique=True
    )
    await db.answers.create_index([("exam_id", ASCENDING), ("question_id", ASCENDING)])

    # events
    await db.events.create_index([("exam_id", ASCENDING), ("timestamp", DESCENDING)])
    await db.events.create_index([("attempt_id", ASCENDING), ("timestamp", DESCENDING)])
    await db.events.create_index("student_id")

    # results
    await db.results.create_index([("exam_id", ASCENDING), ("score", DESCENDING)])
    await db.results.create_index([("exam_id", ASCENDING), ("rank", ASCENDING)])

    print("[DB] Indexes created")


def get_db():
    return db
