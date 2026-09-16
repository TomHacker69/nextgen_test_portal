from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime


class AnswerSave(BaseModel):
    question_id: str
    answer: Dict[str, Any]   # {"option_id": "B"} | {"option_ids": ["A","C"]} | {"text": "..."}
    time_spent_seconds: Optional[int] = None
    marked_for_review: bool = False


class AnswerSaveResponse(BaseModel):
    saved: bool
    question_id: str
    server_time: datetime = Field(default_factory=datetime.utcnow)
    # NOTE: No correctness or correct answer ever returned here


class IntegrityEvent(BaseModel):
    attempt_id: str
    exam_id: str
    student_id: str
    event_type: str   # TAB_SWITCH | FULLSCREEN_EXIT | COPY | PASTE | BLUR | FOCUS | DISCONNECT
    meta: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    severity: str = "low"   # low | medium | high
