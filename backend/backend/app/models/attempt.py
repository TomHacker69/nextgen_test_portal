from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class AttemptStatus(str, Enum):
    CREATED = "created"
    IN_PROGRESS = "in_progress"
    PAUSED = "paused"
    SUBMITTED = "submitted"
    EXPIRED = "expired"
    TERMINATED = "terminated"


class AttemptCreate(BaseModel):
    exam_id: str
    student_id: str
    started_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    status: AttemptStatus = AttemptStatus.IN_PROGRESS
    question_order: List[str] = []      # deterministic order after randomization
    section_question_map: Dict[str, List[str]] = {}
    score: Optional[float] = None
    max_score: Optional[float] = None
    submitted_at: Optional[datetime] = None
    time_taken_seconds: Optional[int] = None
    answer_count: int = 0
    correct_count: int = 0
    wrong_count: int = 0
    unattempted_count: int = 0


class AttemptPublic(BaseModel):
    """Student-safe attempt payload."""
    id: str
    exam_id: str
    status: str
    started_at: datetime
    expires_at: Optional[datetime] = None
    question_order: List[str] = []
    section_question_map: Dict[str, List[str]] = {}
    server_time: datetime = Field(default_factory=datetime.utcnow)
    answer_count: int = 0

    @classmethod
    def from_doc(cls, doc: dict) -> "AttemptPublic":
        return cls(
            id=str(doc["_id"]),
            exam_id=str(doc["exam_id"]),
            status=doc.get("status", "in_progress"),
            started_at=doc["started_at"],
            expires_at=doc.get("expires_at"),
            question_order=doc.get("question_order", []),
            section_question_map=doc.get("section_question_map", {}),
            server_time=datetime.utcnow(),
            answer_count=doc.get("answer_count", 0),
        )


class AttemptResult(BaseModel):
    """Post-submission result for student (if show_result_immediately)."""
    id: str
    exam_id: str
    status: str
    score: Optional[float] = None
    max_score: Optional[float] = None
    submitted_at: Optional[datetime] = None
    time_taken_seconds: Optional[int] = None

    @classmethod
    def from_doc(cls, doc: dict) -> "AttemptResult":
        return cls(
            id=str(doc["_id"]),
            exam_id=str(doc["exam_id"]),
            status=doc.get("status", "submitted"),
            score=doc.get("score"),
            max_score=doc.get("max_score"),
            submitted_at=doc.get("submitted_at"),
            time_taken_seconds=doc.get("time_taken_seconds"),
        )
