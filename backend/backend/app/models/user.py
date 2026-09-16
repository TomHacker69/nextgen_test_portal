from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId


class PyObjectId(str):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return str(v)


class UserBase(BaseModel):
    name: str
    email: Optional[str] = None
    roll_number: Optional[str] = None
    role: str = "student"  # "student" | "admin"
    branch: Optional[str] = None
    section: Optional[str] = None
    year: Optional[str] = None
    batch: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserCreate(BaseModel):
    name: str
    email: Optional[str] = None
    roll_number: Optional[str] = None
    password: str
    role: str = "student"
    branch: Optional[str] = None
    section: Optional[str] = None
    year: Optional[str] = None
    batch: Optional[str] = None


class UserPublic(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    roll_number: Optional[str] = None
    role: str
    branch: Optional[str] = None
    section: Optional[str] = None
    year: Optional[str] = None
    batch: Optional[str] = None
    is_active: bool

    @classmethod
    def from_doc(cls, doc: dict) -> "UserPublic":
        return cls(
            id=str(doc["_id"]),
            name=doc["name"],
            email=doc.get("email"),
            roll_number=doc.get("roll_number"),
            role=doc["role"],
            branch=doc.get("branch"),
            section=doc.get("section"),
            year=doc.get("year"),
            batch=doc.get("batch"),
            is_active=doc.get("is_active", True),
        )
