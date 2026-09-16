from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from bson import ObjectId
from datetime import datetime
from app.core.deps import require_admin
from app.core.database import get_db
from app.models.exam import ExamCreate, ExamAdmin, ExamPublic

router = APIRouter(prefix="/api/admin/exams", tags=["admin-exams"])


@router.get("", response_model=List[ExamAdmin])
async def list_exams(
    status: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 20,
    admin=Depends(require_admin),
    db=Depends(get_db),
):
    query: dict = {}
    if status:
        query["status"] = status
    exams = await db.exams.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(None)
    return [ExamAdmin.from_doc(e) for e in exams]


@router.post("", response_model=ExamAdmin)
async def create_exam(body: ExamCreate, admin=Depends(require_admin), db=Depends(get_db)):
    doc = body.model_dump()
    doc["created_by"] = str(admin["_id"])
    doc["status"] = "draft"
    doc["created_at"] = datetime.utcnow()
    doc["updated_at"] = datetime.utcnow()

    result = await db.exams.insert_one(doc)
    doc["_id"] = result.inserted_id
    return ExamAdmin.from_doc(doc)


@router.get("/{exam_id}", response_model=ExamAdmin)
async def get_exam(exam_id: str, admin=Depends(require_admin), db=Depends(get_db)):
    exam = await db.exams.find_one({"_id": ObjectId(exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return ExamAdmin.from_doc(exam)


@router.put("/{exam_id}", response_model=ExamAdmin)
async def update_exam(exam_id: str, body: ExamCreate, admin=Depends(require_admin), db=Depends(get_db)):
    exam = await db.exams.find_one({"_id": ObjectId(exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if exam.get("status") == "published":
        raise HTTPException(status_code=400, detail="Cannot edit a published exam. Create a new version.")

    doc = body.model_dump(exclude_unset=True)
    doc["updated_at"] = datetime.utcnow()

    result = await db.exams.find_one_and_update(
        {"_id": ObjectId(exam_id)},
        {"$set": doc},
        return_document=True,
    )
    return ExamAdmin.from_doc(result)


@router.post("/{exam_id}/publish")
async def publish_exam(exam_id: str, admin=Depends(require_admin), db=Depends(get_db)):
    """Freeze exam into immutable published state."""
    exam = await db.exams.find_one({"_id": ObjectId(exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if exam.get("status") == "published":
        return {"message": "Exam already published"}

    # Validate: must have at least one question
    total_questions = 0
    for section in exam.get("sections", []):
        total_questions += len(section.get("question_ids", []))
        total_questions += len(section.get("pool_question_ids", []))
    if total_questions == 0:
        raise HTTPException(status_code=400, detail="Exam must have at least one question before publishing")

    await db.exams.update_one(
        {"_id": ObjectId(exam_id)},
        {"$set": {
            "status": "published",
            "published_at": datetime.utcnow(),
            "published_by": str(admin["_id"]),
            "snapshot_version": 1,
        }},
    )
    return {"message": "Exam published successfully", "exam_id": exam_id}


@router.get("/{exam_id}/overview")
async def get_exam_overview(exam_id: str, admin=Depends(require_admin), db=Depends(get_db)):
    """Admin exam overview: candidate stats + student score list."""
    exam = await db.exams.find_one({"_id": ObjectId(exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    total_candidates = await db.exam_candidates.count_documents({"exam_id": exam_id})
    started = await db.attempts.count_documents({"exam_id": exam_id})
    completed = await db.attempts.count_documents({"exam_id": exam_id, "status": "submitted"})
    in_progress = await db.attempts.count_documents({"exam_id": exam_id, "status": "in_progress"})
    expired = await db.attempts.count_documents({"exam_id": exam_id, "status": "expired"})

    # Student score list
    attempts = await db.attempts.find(
        {"exam_id": exam_id},
    ).sort("score", -1).to_list(100)

    student_scores = []
    for a in attempts:
        student = await db.users.find_one({"_id": ObjectId(a["student_id"])})
        if student:
            student_scores.append({
                "student_id": str(student["_id"]),
                "name": student.get("name"),
                "roll_number": student.get("roll_number"),
                "score": a.get("score"),
                "max_score": a.get("max_score"),
                "status": a.get("status"),
                "attempt_id": str(a["_id"]),
                "submitted_at": a.get("submitted_at"),
                "time_taken_seconds": a.get("time_taken_seconds"),
            })

    return {
        "exam_id": exam_id,
        "title": exam.get("title"),
        "status": exam.get("status"),
        "stats": {
            "total_candidates": total_candidates,
            "started": started,
            "completed": completed,
            "in_progress": in_progress,
            "expired": expired,
        },
        "student_scores": student_scores,
    }


@router.get("/{exam_id}/candidates/{attempt_id}/detail")
async def get_candidate_detail(
    exam_id: str,
    attempt_id: str,
    admin=Depends(require_admin),
    db=Depends(get_db),
):
    """Full candidate attempt review — admin only."""
    attempt = await db.attempts.find_one({"_id": ObjectId(attempt_id), "exam_id": exam_id})
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    student = await db.users.find_one({"_id": ObjectId(attempt["student_id"])})
    answers = await db.answers.find({"attempt_id": attempt_id}).to_list(None)
    answer_map = {a["question_id"]: a for a in answers}

    question_order = attempt.get("question_order", [])
    q_ids = [ObjectId(qid) for qid in question_order]
    questions = await db.question_bank.find({"_id": {"$in": q_ids}}).to_list(None)
    q_map = {str(q["_id"]): q for q in questions}

    question_details = []
    for i, qid in enumerate(question_order):
        q = q_map.get(qid, {})
        ans = answer_map.get(qid, {})
        student_answer = ans.get("answer", {})

        # Determine correctness (admin view)
        q_type = q.get("question_type", "mcq")
        is_correct = False
        correct_display = None

        if q_type == "mcq":
            selected = student_answer.get("option_id")
            correct_display = q.get("correct_option")
            is_correct = selected == correct_display
        elif q_type == "multi_select":
            selected_set = set(student_answer.get("option_ids", []))
            correct_set = set(q.get("correct_options", []))
            correct_display = list(correct_set)
            is_correct = selected_set == correct_set
        elif q_type in ("short_answer", "fill_blank"):
            student_txt = (student_answer.get("text") or "").strip().lower()
            correct_txt = (q.get("correct_answer_text") or "").strip().lower()
            correct_display = q.get("correct_answer_text")
            is_correct = student_txt == correct_txt

        pos_marks = q.get("positive_marks", 1.0)
        neg_marks = q.get("negative_marks", 0.0)
        marks_obtained = pos_marks if is_correct else (-neg_marks if ans else 0)

        question_details.append({
            "index": i + 1,
            "question_id": qid,
            "question_text": q.get("text", ""),
            "question_type": q_type,
            "options": q.get("options"),
            "student_answer": student_answer,
            "correct_answer": correct_display,
            "is_correct": is_correct if ans else None,
            "marks_obtained": marks_obtained if ans else 0,
            "time_spent_seconds": ans.get("time_spent_seconds"),
            "marked_for_review": ans.get("marked_for_review", False),
            "attempted": bool(ans),
        })

    # Compute rank
    rank_result = await db.results.find_one({"exam_id": exam_id, "student_id": attempt["student_id"]})

    return {
        "student": {
            "id": str(student["_id"]) if student else None,
            "name": student.get("name") if student else "Unknown",
            "roll_number": student.get("roll_number") if student else None,
        },
        "attempt": {
            "id": attempt_id,
            "status": attempt.get("status"),
            "score": attempt.get("score"),
            "max_score": attempt.get("max_score"),
            "correct_count": attempt.get("correct_count", 0),
            "wrong_count": attempt.get("wrong_count", 0),
            "unattempted_count": attempt.get("unattempted_count", 0),
            "time_taken_seconds": attempt.get("time_taken_seconds"),
            "submitted_at": attempt.get("submitted_at"),
            "accuracy": round(
                (attempt.get("correct_count", 0) /
                 max(attempt.get("correct_count", 0) + attempt.get("wrong_count", 0), 1)) * 100, 1
            ) if attempt.get("correct_count") else 0,
            "rank": rank_result.get("rank") if rank_result else None,
        },
        "questions": question_details,
    }


@router.delete("/{exam_id}")
async def delete_exam(exam_id: str, admin=Depends(require_admin), db=Depends(get_db)):
    exam = await db.exams.find_one({"_id": ObjectId(exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if exam.get("status") in ("published", "live"):
        raise HTTPException(status_code=400, detail="Cannot delete a published/live exam")
    await db.exams.delete_one({"_id": ObjectId(exam_id)})
    return {"deleted": True}
