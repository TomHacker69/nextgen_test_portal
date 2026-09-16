from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime
from enum import Enum


class QuestionType(str, Enum):
    MCQ = "mcq"
    MULTI_SELECT = "multi_select"
    SHORT_ANSWER = "short_answer"
    FILL_BLANK = "fill_blank"


class MCQOption(BaseModel):
    id: str   # "A", "B", "C", "D"
    text: str
    image_url: Optional[str] = None


class QuestionCreate(BaseModel):
    question_type: QuestionType = QuestionType.MCQ
    text: str
    image_url: Optional[str] = None
    options: Optional[List[MCQOption]] = None          # MCQ / multi-select
    correct_option: Optional[str] = None               # MCQ: "A", "B", etc.
    correct_options: Optional[List[str]] = None        # multi-select
    correct_answer_text: Optional[str] = None          # short answer / fill blank
    explanation: Optional[str] = None
    subject: Optional[str] = None
    topic: Optional[str] = None
    tags: List[str] = []
    difficulty: Optional[str] = "medium"              # easy | medium | hard
    positive_marks: float = 1.0
    negative_marks: float = 0.0
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class QuestionPublic(BaseModel):
    """Student-safe question — NO correct answers."""
    id: str
    question_type: QuestionType
    text: str
    image_url: Optional[str] = None
    options: Optional[List[MCQOption]] = None
    subject: Optional[str] = None
    topic: Optional[str] = None
    tags: List[str] = []
    difficulty: Optional[str] = None
    positive_marks: float
    negative_marks: float

    @classmethod
    def from_doc(cls, doc: dict) -> "QuestionPublic":
        return cls(
            id=str(doc["_id"]),
            question_type=doc.get("question_type", "mcq"),
            text=doc["text"],
            image_url=doc.get("image_url"),
            options=doc.get("options"),
            subject=doc.get("subject"),
            topic=doc.get("topic"),
            tags=doc.get("tags", []),
            difficulty=doc.get("difficulty"),
            positive_marks=doc.get("positive_marks", 1.0),
            negative_marks=doc.get("negative_marks", 0.0),
        )


class QuestionAdmin(QuestionPublic):
    """Admin-safe question — includes correct answers."""
    correct_option: Optional[str] = None
    correct_options: Optional[List[str]] = None
    correct_answer_text: Optional[str] = None
    explanation: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @classmethod
    def from_doc(cls, doc: dict) -> "QuestionAdmin":
        return cls(
            id=str(doc["_id"]),
            question_type=doc.get("question_type", "mcq"),
            text=doc["text"],
            image_url=doc.get("image_url"),
            options=doc.get("options"),
            subject=doc.get("subject"),
            topic=doc.get("topic"),
            tags=doc.get("tags", []),
            difficulty=doc.get("difficulty"),
            positive_marks=doc.get("positive_marks", 1.0),
            negative_marks=doc.get("negative_marks", 0.0),
            correct_option=doc.get("correct_option"),
            correct_options=doc.get("correct_options"),
            correct_answer_text=doc.get("correct_answer_text"),
            explanation=doc.get("explanation"),
            created_by=doc.get("created_by"),
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at"),
        )
