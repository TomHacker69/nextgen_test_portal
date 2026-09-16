from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from bson import ObjectId
from datetime import datetime
from app.core.deps import require_student
from app.core.database import get_db
from app.models.attempt import AttemptPublic, AttemptResult
from app.models.answer import AnswerSave, AnswerSaveResponse
from app.services.attempt_service import get_or_create_attempt, submit_attempt

router = APIRouter(prefix="/api/student/attempts", tags=["student-attempts"])


@router.post("/{exam_id}/start", response_model=AttemptPublic)
async def start_attempt(exam_id: str, student=Depends(require_student), db=Depends(get_db)):
    """Start or resume an exam attempt."""
    student_id = str(student["_id"])
    student_obj_id = student["_id"]

    try:
        exam_obj_id = ObjectId(exam_id)
    except Exception:
        exam_obj_id = None

    # Check eligibility supporting both ObjectId and str
    candidate_query = {
        "$or": [
            {"exam_id": exam_id, "student_id": student_id},
            {"exam_id": exam_obj_id, "student_id": student_obj_id},
            {"exam_id": exam_id, "student_id": student_obj_id},
            {"exam_id": exam_obj_id, "student_id": student_id},
        ]
    }
    assignment = await db.exam_candidates.find_one(candidate_query)
    if not assignment:
        raise HTTPException(status_code=403, detail="Not eligible for this exam")

    exam = await db.exams.find_one({"_id": exam_obj_id, "status": {"$in": ["published", "live"]}})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found or not active")

    # Check time window
    now = datetime.utcnow()
    if exam.get("start_time") and now < exam["start_time"]:
        raise HTTPException(status_code=400, detail="Exam has not started yet")
    if exam.get("end_time") and now > exam["end_time"]:
        raise HTTPException(status_code=400, detail="Exam window has closed")

    try:
        attempt = await get_or_create_attempt(exam_id, student_id, exam)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return AttemptPublic.from_doc(attempt)


@router.get("/{attempt_id}", response_model=AttemptPublic)
async def get_attempt(attempt_id: str, student=Depends(require_student), db=Depends(get_db)):
    """Fetch current attempt state (used on page refresh/recovery)."""
    student_id = str(student["_id"])
    attempt = await db.attempts.find_one({"_id": ObjectId(attempt_id), "student_id": student_id})
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return AttemptPublic.from_doc(attempt)


@router.get("/{attempt_id}/answers")
async def get_saved_answers(attempt_id: str, student=Depends(require_student), db=Depends(get_db)):
    """Fetch all saved answers for recovery after reconnect."""
    student_id = str(student["_id"])
    attempt = await db.attempts.find_one({"_id": ObjectId(attempt_id), "student_id": student_id})
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    answers = await db.answers.find({"attempt_id": attempt_id}).to_list(None)
    # Return: {question_id -> {answer, marked_for_review, time_spent_seconds}}
    # NOTE: no correctness included
    result = {}
    for a in answers:
        result[a["question_id"]] = {
            "answer": a.get("answer"),
            "marked_for_review": a.get("marked_for_review", False),
            "time_spent_seconds": a.get("time_spent_seconds"),
        }
    return result


@router.post("/{attempt_id}/answers", response_model=AnswerSaveResponse)
async def save_answer(
    attempt_id: str,
    body: AnswerSave,
    student=Depends(require_student),
    db=Depends(get_db),
):
    """Save/update an answer (idempotent upsert)."""
    student_id = str(student["_id"])
    attempt = await db.attempts.find_one({"_id": ObjectId(attempt_id), "student_id": student_id})
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    if attempt["status"] not in ("in_progress", "paused"):
        raise HTTPException(status_code=400, detail="Attempt is not active")

    # Server-side time check
    now = datetime.utcnow()
    if attempt.get("expires_at") and now > attempt["expires_at"]:
        raise HTTPException(status_code=400, detail="Attempt has expired")

    # Upsert on (attempt_id, question_id) — the unique index prevents duplicates
    await db.answers.update_one(
        {"attempt_id": attempt_id, "question_id": body.question_id},
        {"$set": {
            "attempt_id": attempt_id,
            "question_id": body.question_id,
            "exam_id": str(attempt["exam_id"]),
            "student_id": student_id,
            "answer": body.answer,
            "marked_for_review": body.marked_for_review,
            "time_spent_seconds": body.time_spent_seconds,
            "saved_at": now,
        }},
        upsert=True,
    )

    # Update answer count on attempt
    answer_count = await db.answers.count_documents({"attempt_id": attempt_id})
    await db.attempts.update_one(
        {"_id": ObjectId(attempt_id)},
        {"$set": {"answer_count": answer_count}},
    )

    return AnswerSaveResponse(saved=True, question_id=body.question_id)


@router.post("/{attempt_id}/submit", response_model=AttemptResult)
async def submit(attempt_id: str, student=Depends(require_student), db=Depends(get_db)):
    """Submit exam — idempotent."""
    student_id = str(student["_id"])
    try:
        updated = await submit_attempt(attempt_id, student_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return AttemptResult.from_doc(updated)


@router.get("/{attempt_id}/result", response_model=AttemptResult)
async def get_attempt_result(attempt_id: str, student=Depends(require_student), db=Depends(get_db)):
    """Fetch completed attempt result summary."""
    student_id = str(student["_id"])
    attempt = await db.attempts.find_one({"_id": ObjectId(attempt_id), "student_id": student_id})
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    return AttemptResult.from_doc(attempt)
