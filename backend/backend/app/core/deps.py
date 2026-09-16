from fastapi import Depends, HTTPException, status, Cookie, Header
from typing import Optional
from app.core.security import decode_token
from app.core.database import get_db


async def get_current_user(
    access_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
    db=Depends(get_db)
):
    token = access_token
    if not token and authorization:
        if authorization.startswith("Bearer "):
            token = authorization.split("Bearer ", 1)[1].strip()
        else:
            token = authorization.strip()

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    payload = decode_token(token)
    if not payload:
        raise credentials_exception

    user_id = payload.get("sub")
    role = payload.get("role")
    if not user_id:
        raise credentials_exception

    from bson import ObjectId
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise credentials_exception

    return user


async def require_admin(current_user=Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


async def require_student(current_user=Depends(get_current_user)):
    if current_user.get("role") != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student access required")
    return current_user
