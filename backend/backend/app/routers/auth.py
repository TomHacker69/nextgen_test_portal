from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from pydantic import BaseModel
from typing import Optional
from app.core.security import verify_password, create_access_token, hash_password
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import UserPublic

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    identifier: str   # email or roll_number
    password: str


class LoginResponse(BaseModel):
    user: UserPublic
    access_token: Optional[str] = None
    message: str = "Login successful"


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, response: Response, db=Depends(get_db)):
    # Try email first, then roll_number
    user = await db.users.find_one({"email": body.identifier.lower()})
    if not user:
        user = await db.users.find_one({"roll_number": body.identifier})

    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not user.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    token = create_access_token({"sub": str(user["_id"]), "role": user["role"]})

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # Set to True in production with HTTPS
        max_age=60 * 60 * 8,  # 8 hours
    )
    response.set_cookie(
        key="user_role",
        value=user["role"],
        httponly=False,
        samesite="lax",
        secure=False,
        max_age=60 * 60 * 8,
    )

    return LoginResponse(user=UserPublic.from_doc(user), access_token=token)


@router.post("/admin-login", response_model=LoginResponse)
async def admin_login(body: LoginRequest, response: Response, db=Depends(get_db)):
    """Isolated Admin gateway: Strictly blocks non-admin / student accounts."""
    user = await db.users.find_one({"email": body.identifier.lower()})

    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid administrator credentials",
        )

    if not user.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    # STRICT BARRIER: Non-admin accounts are hard-blocked with 403 Forbidden!
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Candidate accounts cannot access the Administrator Command Center.",
        )

    token = create_access_token({"sub": str(user["_id"]), "role": "admin"})

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=60 * 60 * 8,
    )
    response.set_cookie(
        key="user_role",
        value="admin",
        httponly=False,
        samesite="lax",
        secure=False,
        max_age=60 * 60 * 8,
    )

    return LoginResponse(user=UserPublic.from_doc(user), access_token=token)


@router.post("/student-login", response_model=LoginResponse)
async def student_login(body: LoginRequest, response: Response, db=Depends(get_db)):
    """Isolated Student gateway: Strictly blocks admin accounts from candidate portal."""
    user = await db.users.find_one({"email": body.identifier.lower()})
    if not user:
        user = await db.users.find_one({"roll_number": body.identifier})

    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid candidate credentials",
        )

    if not user.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    # STRICT BARRIER: Admin accounts cannot enter candidate session
    if user.get("role") != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Administrator accounts cannot use the student portal.",
        )

    token = create_access_token({"sub": str(user["_id"]), "role": "student"})

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=60 * 60 * 8,
    )
    response.set_cookie(
        key="user_role",
        value="student",
        httponly=False,
        samesite="lax",
        secure=False,
        max_age=60 * 60 * 8,
    )

    return LoginResponse(user=UserPublic.from_doc(user), access_token=token)


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    return {"message": "Logged out"}


@router.get("/me", response_model=UserPublic)
async def me(current_user=Depends(get_current_user)):
    return UserPublic.from_doc(current_user)
