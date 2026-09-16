from datetime import datetime, timedelta
from typing import Optional, Dict, List
import random
from bson import ObjectId
from app.core.database import get_db
from app.models.attempt import AttemptStatus


async def get_or_create_attempt(exam_id: str, student_id: str, exam_doc: dict) -> dict:
    """Start a new attempt or resume an existing in-progress one."""
    db = get_db()

    # Check for existing active attempt
    existing = await db.attempts.find_one({
        "exam_id": exam_id,
        "student_id": student_id,
        "status": {"$in": ["in_progress", "paused", "created"]},
    })
    if existing:
        return existing

    # Check max attempts
    max_attempts = exam_doc.get("max_attempts", 1)
    prior_count = await db.attempts.count_documents({
        "exam_id": exam_id,
        "student_id": student_id,
        "status": {"$in": ["submitted", "expired"]},
    })
    if prior_count >= max_attempts:
        raise ValueError("Maximum attempts reached")

    # Build question order from sections
    question_order, section_question_map = _build_question_order(exam_doc)

    # Calculate expiry
    started_at = datetime.utcnow()
    duration_minutes = exam_doc.get("duration_minutes", 60)
    expires_at = started_at + timedelta(minutes=duration_minutes)

    # Count max score
    max_score = _compute_max_score(exam_doc, question_order)

    attempt_doc = {
        "exam_id": exam_id,
        "student_id": student_id,
        "status": AttemptStatus.IN_PROGRESS,
        "started_at": started_at,
        "expires_at": expires_at,
        "question_order": question_order,
        "section_question_map": section_question_map,
        "score": None,
        "max_score": max_score,
        "submitted_at": None,
        "time_taken_seconds": None,
        "answer_count": 0,
        "correct_count": 0,
        "wrong_count": 0,
        "unattempted_count": len(question_order),
    }

    result = await db.attempts.insert_one(attempt_doc)
    attempt_doc["_id"] = result.inserted_id
    return attempt_doc


def _build_question_order(exam_doc: dict):
    """Resolve section question pools and build a deterministic order."""
    question_order = []
    section_question_map = {}

    sections = exam_doc.get("sections", [])

    if sections:
        for section in sections:
            section_id = section.get("id", str(ObjectId()))
            q_ids = [str(qid) for qid in list(section.get("question_ids", []))]

            # Handle pool
            pool_ids = [str(qid) for qid in section.get("pool_question_ids", [])]
            pick_count = section.get("pool_pick_count", 0)
            if pool_ids and pick_count > 0:
                picked = random.sample(pool_ids, min(pick_count, len(pool_ids)))
                q_ids.extend(picked)

            if section.get("randomize_questions", False):
                random.shuffle(q_ids)

            section_question_map[section_id] = q_ids
            question_order.extend(q_ids)
    else:
        # Flat exam: question_ids at top level (from published_snapshot or direct)
        snapshot = exam_doc.get("published_snapshot", {})
        flat_qs = snapshot.get("questions", [])
        if flat_qs:
            q_ids = [str(q["id"]) for q in flat_qs]
        else:
            q_ids = [str(qid) for qid in exam_doc.get("question_ids", [])]
        section_question_map["default"] = q_ids
        question_order = q_ids

    return question_order, section_question_map


def _compute_max_score(exam_doc: dict, question_order: List[str]) -> float:
    """Sum up positive marks from sections, or from published_snapshot questions."""
    total = 0.0
    sections = exam_doc.get("sections", [])
    if sections:
        for section in sections:
            override_marks = section.get("positive_marks")
            q_ids = [str(q) for q in section.get("question_ids", []) + section.get("pool_question_ids", [])]
            for qid in q_ids:
                if qid in question_order:
                    total += override_marks if override_marks is not None else 1.0
    else:
        # Flat exam: use published_snapshot for marks
        snapshot = exam_doc.get("published_snapshot", {})
        for q in snapshot.get("questions", []):
            total += float(q.get("points", 1))
    return total


async def submit_attempt(attempt_id: str, student_id: str) -> dict:
    """Finalize an attempt: score it and mark submitted."""
    db = get_db()

    attempt = await db.attempts.find_one({"_id": ObjectId(attempt_id), "student_id": student_id})
    if not attempt:
        raise ValueError("Attempt not found")

    if attempt["status"] in ("submitted", "expired", "terminated"):
        return attempt  # idempotent

    # Fetch all saved answers
    answers = await db.answers.find({"attempt_id": attempt_id}).to_list(None)
    answer_map = {a["question_id"]: a for a in answers}

    # Fetch questions from bank
    exam_id = attempt["exam_id"]
    exam = await db.exams.find_one({"_id": ObjectId(exam_id)})

    score, correct, wrong, unattempted = await _score_attempt(
        attempt, exam, answer_map
    )

    now = datetime.utcnow()
    time_taken = int((now - attempt["started_at"]).total_seconds())

    update = {
        "status": AttemptStatus.SUBMITTED,
        "submitted_at": now,
        "score": score,
        "correct_count": correct,
        "wrong_count": wrong,
        "unattempted_count": unattempted,
        "time_taken_seconds": time_taken,
        "answer_count": len(answers),
    }

    await db.attempts.update_one({"_id": ObjectId(attempt_id)}, {"$set": update})

    # Upsert result record for leaderboard
    max_score = attempt.get("max_score", 0)
    accuracy = round((correct / max(correct + wrong, 1)) * 100, 2) if (correct + wrong) > 0 else 0.0
    await db.results.update_one(
        {"exam_id": exam_id, "student_id": student_id},
        {"$set": {
            "attempt_id": attempt_id,
            "score": score,
            "max_score": max_score,
            "accuracy": accuracy,
            "correct_count": correct,
            "wrong_count": wrong,
            "unattempted_count": unattempted,
            "time_taken_seconds": time_taken,
            "submitted_at": now,
            "status": "submitted",
        }},
        upsert=True,
    )

    return {**attempt, **update}


async def _score_attempt(attempt: dict, exam: dict, answer_map: dict):
    """Server-side scoring — never returns correctness to students."""
    db = get_db()
    question_order = attempt.get("question_order", [])

    if not question_order:
        return 0.0, 0, 0, 0

    # Fetch all questions at once
    q_ids = [ObjectId(qid) for qid in question_order]
    questions = await db.question_bank.find({"_id": {"$in": q_ids}}).to_list(None)
    q_map = {str(q["_id"]): q for q in questions}

    score = 0.0
    correct = 0
    wrong = 0
    unattempted = 0

    # Get section mark overrides
    section_marks = {}
    for section in (exam or {}).get("sections", []):
        for qid in section.get("question_ids", []) + section.get("pool_question_ids", []):
            if section.get("positive_marks") is not None:
                section_marks[qid] = {
                    "positive": section["positive_marks"],
                    "negative": section.get("negative_marks", 0),
                }

    for qid in question_order:
        q = q_map.get(qid)
        if not q:
            continue

        # Support both field name conventions
        pos_marks = section_marks.get(qid, {}).get("positive",
            q.get("positive_marks", q.get("points", 1.0)))
        neg_marks = section_marks.get(qid, {}).get("negative",
            q.get("negative_marks", q.get("negative_points", 0.0)))

        answer = answer_map.get(qid)
        if not answer:
            unattempted += 1
            continue

        q_type = q.get("question_type", q.get("type", "mcq"))
        is_correct = False

        if q_type == "mcq":
            selected = answer.get("answer", {}).get("option_id")
            is_correct = selected == q.get("correct_option", q.get("correct_answer"))
        elif q_type == "multi_select":
            selected = set(answer.get("answer", {}).get("option_ids", []))
            correct_set = set(q.get("correct_options", q.get("correct_answers", [])))
            is_correct = selected == correct_set
        elif q_type in ("short_answer", "fill_blank"):
            student_ans = (answer.get("answer", {}).get("text") or "").strip().lower()
            correct_ans = (q.get("correct_answer_text", q.get("correct_answer")) or "").strip().lower()
            is_correct = student_ans == correct_ans

        if is_correct:
            score += pos_marks
            correct += 1
        else:
            score -= neg_marks
            wrong += 1

    return max(0.0, score), correct, wrong, unattempted


async def check_eligibility(exam_id: str, student_id: str) -> bool:
    """Check if student is assigned/eligible for this exam."""
    db = get_db()
    assignment = await db.exam_candidates.find_one({
        "exam_id": exam_id,
        "student_id": student_id,
    })
    return assignment is not None


async def finalize_expired_attempts():
    """Background task: auto-submit attempts that have expired."""
    db = get_db()
    now = datetime.utcnow()
    expired = await db.attempts.find({
        "status": "in_progress",
        "expires_at": {"$lt": now},
    }).to_list(None)

    for attempt in expired:
        try:
            await submit_attempt(str(attempt["_id"]), attempt["student_id"])
            await db.attempts.update_one(
                {"_id": attempt["_id"]},
                {"$set": {"status": AttemptStatus.EXPIRED}}
            )
        except Exception as e:
            print(f"[AttemptService] Error finalizing {attempt['_id']}: {e}")
