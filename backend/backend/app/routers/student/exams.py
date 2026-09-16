from fastapi import APIRouter, Depends, HTTPException
from typing import List
from bson import ObjectId
from app.core.deps import require_student
from app.core.database import get_db
from app.models.exam import ExamPublic
from app.models.question import QuestionPublic

router = APIRouter(prefix="/api/student/exams", tags=["student-exams"])


@router.get("", response_model=List[ExamPublic])
async def get_eligible_exams(student=Depends(require_student), db=Depends(get_db)):
    """Return all published exams the student is eligible for."""
    student_id = str(student["_id"])
    student_obj_id = student["_id"]

    # Find assignments supporting both str and ObjectId
    assignments = await db.exam_candidates.find({
        "$or": [
            {"student_id": student_id},
            {"student_id": student_obj_id},
        ]
    }).to_list(None)

    exam_ids = []
    for a in assignments:
        eid = a.get("exam_id")
        if isinstance(eid, ObjectId):
            exam_ids.append(eid)
        elif eid:
            try:
                exam_ids.append(ObjectId(eid))
            except Exception:
                pass

    if not exam_ids:
        return []

    exams = await db.exams.find({
        "_id": {"$in": exam_ids},
        "status": {"$in": ["published", "live"]},
    }).to_list(None)

    return [ExamPublic.from_doc(e) for e in exams]


@router.get("/{exam_id}", response_model=ExamPublic)
async def get_exam_detail(exam_id: str, student=Depends(require_student), db=Depends(get_db)):
    """Get exam details for the student (no answers)."""
    student_id = str(student["_id"])
    student_obj_id = student["_id"]

    try:
        exam_obj_id = ObjectId(exam_id)
    except Exception:
        exam_obj_id = None

    # Verify eligibility
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
        raise HTTPException(status_code=404, detail="Exam not found")

    return ExamPublic.from_doc(exam)


@router.get("/{exam_id}/questions", response_model=List[QuestionPublic])
async def get_exam_questions(exam_id: str, student=Depends(require_student), db=Depends(get_db)):
    """Get student-safe questions for an exam (must have an active attempt)."""
    student_id = str(student["_id"])

    # Must have an active attempt
    attempt = await db.attempts.find_one({
        "exam_id": exam_id,
        "student_id": student_id,
        "status": {"$in": ["in_progress", "paused"]},
    })
    if not attempt:
        raise HTTPException(status_code=403, detail="No active attempt found. Start the exam first.")

    question_order = attempt.get("question_order", [])
    if not question_order:
        return []

    q_ids = [ObjectId(qid) for qid in question_order]
    questions = await db.question_bank.find({"_id": {"$in": q_ids}}).to_list(None)
    q_map = {str(q["_id"]): q for q in questions}

    # Preserve attempt order
    return [QuestionPublic.from_doc(q_map[qid]) for qid in question_order if qid in q_map]
