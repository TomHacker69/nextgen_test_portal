from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class ExamStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    LIVE = "live"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class ExamSection(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    question_ids: List[str] = []          # fixed questions from bank
    pool_question_ids: List[str] = []     # pool to pick N from
    pool_pick_count: int = 0              # how many from pool
    randomize_questions: bool = False
    randomize_options: bool = False
    positive_marks: Optional[float] = None  # override per-question marks
    negative_marks: Optional[float] = None


class ExamCreate(BaseModel):
    title: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    duration_minutes: int = 60
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    sections: List[ExamSection] = []
    allow_navigation: bool = True
    show_timer: bool = True
    auto_submit: bool = True
    shuffle_questions: bool = False
    shuffle_options: bool = False
    max_attempts: int = 1
    passing_marks: Optional[float] = None
    show_result_immediately: bool = False
    created_by: Optional[str] = None


class ExamPublic(BaseModel):
    """Student-safe exam payload."""
    id: str
    title: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    duration_minutes: int
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    allow_navigation: bool
    show_timer: bool
    status: str
    section_count: int = 0

    @classmethod
    def from_doc(cls, doc: dict) -> "ExamPublic":
        return cls(
            id=str(doc["_id"]),
            title=doc["title"],
            description=doc.get("description"),
            instructions=doc.get("instructions"),
            duration_minutes=doc.get("duration_minutes", 60),
            start_time=doc.get("start_time"),
            end_time=doc.get("end_time"),
            allow_navigation=doc.get("allow_navigation", True),
            show_timer=doc.get("show_timer", True),
            status=doc.get("status", "draft"),
            section_count=len(doc.get("sections", [])),
        )


class ExamAdmin(BaseModel):
    """Full admin exam view."""
    id: str
    title: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    duration_minutes: int
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    sections: List[Dict] = []
    allow_navigation: bool
    show_timer: bool
    auto_submit: bool
    shuffle_questions: bool
    shuffle_options: bool
    max_attempts: int
    passing_marks: Optional[float] = None
    show_result_immediately: bool
    status: str
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    candidate_count: int = 0

    @classmethod
    def from_doc(cls, doc: dict) -> "ExamAdmin":
        return cls(
            id=str(doc["_id"]),
            title=doc["title"],
            description=doc.get("description"),
            instructions=doc.get("instructions"),
            duration_minutes=doc.get("duration_minutes", 60),
            start_time=doc.get("start_time"),
            end_time=doc.get("end_time"),
            sections=doc.get("sections", []),
            allow_navigation=doc.get("allow_navigation", True),
            show_timer=doc.get("show_timer", True),
            auto_submit=doc.get("auto_submit", True),
            shuffle_questions=doc.get("shuffle_questions", False),
            shuffle_options=doc.get("shuffle_options", False),
            max_attempts=doc.get("max_attempts", 1),
            passing_marks=doc.get("passing_marks"),
            show_result_immediately=doc.get("show_result_immediately", False),
            status=doc.get("status", "draft"),
            created_by=str(doc["created_by"]) if doc.get("created_by") else None,
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at"),
            candidate_count=doc.get("candidate_count", 0),
        )
