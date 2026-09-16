from fastapi import APIRouter, Depends, Query
from typing import Optional
from bson import ObjectId
from app.core.deps import require_admin
from app.core.database import get_db

router = APIRouter(prefix="/api/admin/analytics", tags=["admin-analytics"])


@router.get("/{exam_id}/overview")
async def exam_analytics_overview(
    exam_id: str,
    admin=Depends(require_admin),
    db=Depends(get_db),
):
    """Overview metrics for an exam."""
    exam = await db.exams.find_one({"_id": ObjectId(exam_id)})
    if not exam:
        return {"error": "Exam not found"}

    total_attempts = await db.attempts.count_documents(
        {"exam_id": exam_id, "status": {"$in": ["submitted", "expired"]}}
    )
    submitted_attempts = await db.attempts.find(
        {"exam_id": exam_id, "status": {"$in": ["submitted", "expired"]}}
    ).to_list(None)

    avg_score = 0.0
    if submitted_attempts:
        scores = [a.get("score", 0.0) or 0.0 for a in submitted_attempts]
        avg_score = round(sum(scores) / len(scores), 2)

    return {
        "exam_id": exam_id,
        "title": exam.get("title"),
        "total_attempts": total_attempts,
        "average_score": avg_score,
        "total_candidates": exam.get("candidate_count", 0),
    }


@router.get("/{exam_id}/questions")
async def question_analytics(
    exam_id: str,
    admin=Depends(require_admin),
    db=Depends(get_db),
):
    """Per-question analytics sorted by solve rate (highest first)."""
    exam = await db.exams.find_one({"_id": ObjectId(exam_id)})
    if not exam:
        return {"error": "Exam not found"}

    total_attempts = await db.attempts.count_documents(
        {"exam_id": exam_id, "status": {"$in": ["submitted", "expired"]}}
    )
    if total_attempts == 0:
        return {"total_attempts": 0, "questions": []}

    # Get all questions for the exam
    all_q_ids = []
    for section in exam.get("sections", []):
        all_q_ids.extend(section.get("question_ids", []))
        all_q_ids.extend(section.get("pool_question_ids", []))

    q_ids = list(set(all_q_ids))
    questions = await db.question_bank.find(
        {"_id": {"$in": [ObjectId(qid) for qid in q_ids]}}
    ).to_list(None)
    q_map = {str(q["_id"]): q for q in questions}

    results = []
    for qid in q_ids:
        q = q_map.get(qid)
        if not q:
            continue

        # Count attempts, correct, wrong, unattempted
        answered = await db.answers.count_documents({"exam_id": exam_id, "question_id": qid})
        unattempted = total_attempts - answered

        # Count correct (using server-side scoring logic)
        q_type = q.get("question_type", "mcq")
        correct_count = 0

        if q_type == "mcq":
            correct_option = q.get("correct_option")
            if correct_option:
                correct_count = await db.answers.count_documents({
                    "exam_id": exam_id,
                    "question_id": qid,
                    "answer.option_id": correct_option,
                })
        elif q_type == "multi_select":
            # Count exact matches
            all_answers = await db.answers.find(
                {"exam_id": exam_id, "question_id": qid}
            ).to_list(None)
            correct_set = set(q.get("correct_options", []))
            for a in all_answers:
                if set(a.get("answer", {}).get("option_ids", [])) == correct_set:
                    correct_count += 1
        elif q_type in ("short_answer", "fill_blank"):
            correct_text = (q.get("correct_answer_text") or "").strip().lower()
            all_answers = await db.answers.find(
                {"exam_id": exam_id, "question_id": qid}
            ).to_list(None)
            for a in all_answers:
                if (a.get("answer", {}).get("text") or "").strip().lower() == correct_text:
                    correct_count += 1

        wrong_count = answered - correct_count
        accuracy = round((correct_count / answered * 100), 1) if answered > 0 else 0.0

        # Option distribution for MCQ
        option_distribution = {}
        if q_type == "mcq" and q.get("options"):
            all_answers = await db.answers.find(
                {"exam_id": exam_id, "question_id": qid}
            ).to_list(None)
            for a in all_answers:
                opt = a.get("answer", {}).get("option_id", "Unknown")
                option_distribution[opt] = option_distribution.get(opt, 0) + 1

        results.append({
            "question_id": qid,
            "question_text": q.get("text", ""),
            "question_type": q_type,
            "subject": q.get("subject"),
            "topic": q.get("topic"),
            "difficulty": q.get("difficulty"),
            "tags": q.get("tags", []),
            "total_candidates": total_attempts,
            "answered": answered,
            "unattempted": unattempted,
            "correct": correct_count,
            "wrong": wrong_count,
            "accuracy": accuracy,
            "solve_rate": round(correct_count / total_attempts * 100, 1),
            "attempt_rate": round(answered / total_attempts * 100, 1),
            "option_distribution": option_distribution,
        })

    # Sort by solve_rate DESC (highest solved first)
    results.sort(key=lambda x: x["solve_rate"], reverse=True)

    return {"exam_id": exam_id, "total_attempts": total_attempts, "questions": results}


@router.get("/{exam_id}/leaderboard")
async def leaderboard(
    exam_id: str,
    search: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    sort_by: str = Query("score"),  # score | accuracy | time | name
    admin=Depends(require_admin),
    db=Depends(get_db),
):
    """Full leaderboard — paginated, searchable, sorted."""
    # Get all submitted attempts
    attempts = await db.attempts.find({
        "exam_id": {"$in": [exam_id, ObjectId(exam_id) if ObjectId.is_valid(exam_id) else exam_id]},
        "status": {"$in": ["submitted", "expired"]}
    }).sort([("score", -1), ("correct_count", -1), ("time_taken_seconds", 1)]).to_list(None)

    student_ids = []
    for a in attempts:
        sid = a.get("student_id")
        if sid:
            if isinstance(sid, ObjectId):
                student_ids.append(sid)
            elif ObjectId.is_valid(str(sid)):
                student_ids.append(ObjectId(str(sid)))

    users = await db.users.find({"_id": {"$in": student_ids}}).to_list(None)
    user_map = {str(u["_id"]): u for u in users}

    rows = []
    for i, a in enumerate(attempts):
        sid_str = str(a.get("student_id", ""))
        student = user_map.get(sid_str, {})
        correct = a.get("correct_count", 0) or 0
        wrong = a.get("wrong_count", 0) or 0
        accuracy = round(correct / max(correct + wrong, 1) * 100, 1) if (correct + wrong) > 0 else 0

        name = student.get("name", "Student")
        roll = student.get("roll_number", "")
        email = student.get("email", "")

        if search:
            s_lower = search.lower()
            if s_lower not in name.lower() and s_lower not in (roll or "").lower() and s_lower not in email.lower():
                continue

        rows.append({
            "rank": skip + len(rows) + 1,
            "student_id": sid_str,
            "name": name,
            "roll_number": roll,
            "email": email,
            "score": a.get("score", 0),
            "max_score": a.get("max_score", 0),
            "accuracy": accuracy,
            "correct": correct,
            "wrong": wrong,
            "unattempted": a.get("unattempted_count", 0),
            "time_taken_seconds": a.get("time_taken_seconds"),
            "status": a.get("status"),
            "submitted_at": a.get("submitted_at"),
            "attempt_id": str(a["_id"]),
        })

    paginated_rows = rows[skip: skip + limit]
    return {"exam_id": exam_id, "total": len(rows), "skip": skip, "limit": limit, "rows": paginated_rows, "rankings": paginated_rows}
