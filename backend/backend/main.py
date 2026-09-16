from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import connect_db, close_db
from app.core.redis_client import connect_redis, close_redis

# Routers
from app.routers import auth
from app.routers.student import exams as student_exams
from app.routers.student import attempts as student_attempts
from app.routers.student import ws as student_ws
from app.routers.admin import students as admin_students
from app.routers.admin import questions as admin_questions
from app.routers.admin import exams as admin_exams
from app.routers.admin import analytics as admin_analytics
from app.routers.admin import export as admin_export
from app.routers.admin import ws as admin_ws


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await connect_redis()
    yield
    await close_db()
    await close_redis()


app = FastAPI(
    title="NextGen Assessment Portal API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers
app.include_router(auth.router)
app.include_router(student_exams.router)
app.include_router(student_attempts.router)
app.include_router(student_ws.router)
app.include_router(admin_students.router)
app.include_router(admin_questions.router)
app.include_router(admin_exams.router)
app.include_router(admin_analytics.router)
app.include_router(admin_export.router)
app.include_router(admin_ws.router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/api/admin/seed")
async def seed_admin():
    """
    One-time seed: creates the default admin account if none exists.
    Remove this endpoint in production!
    """
    from app.core.database import get_db
    from app.core.security import hash_password
    from datetime import datetime

    db = get_db()
    existing = await db.users.find_one({"role": "admin"})
    if existing:
        return {"message": "Admin already exists", "email": existing.get("email")}

    doc = {
        "name": "Portal Admin",
        "email": "admin@nextgen.local",
        "roll_number": None,
        "password_hash": hash_password("Admin@1234"),
        "role": "admin",
        "is_active": True,
        "created_at": datetime.utcnow(),
    }
    result = await db.users.insert_one(doc)
    return {"message": "Admin created", "email": "admin@nextgen.local", "password": "Admin@1234"}
