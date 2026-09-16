"""
Database Seed Script for NextGen Test Portal.
Run: python seed.py
"""

import asyncio
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.core.security import hash_password


async def seed():
    print(f"Connecting to MongoDB at: {settings.MONGO_URL} (DB: {settings.MONGO_DB_NAME})")
    client = AsyncIOMotorClient(settings.MONGO_URL)
    db = client[settings.MONGO_DB_NAME]

    # 1. Admin Account
    existing_admin = await db.users.find_one({"role": "admin"})
    if not existing_admin:
        admin_doc = {
            "name": "Super Admin",
            "email": "admin@nextgen.local",
            "roll_number": None,
            "password_hash": hash_password("Admin@1234"),
            "role": "admin",
            "department": "Administration",
            "is_active": True,
            "created_at": datetime.utcnow(),
        }
        res = await db.users.insert_one(admin_doc)
        admin_id = res.inserted_id
        print("Created default admin: admin@nextgen.local / Admin@1234")
    else:
        admin_id = existing_admin["_id"]
        print("Admin already exists.")

    # 2. Student Accounts
    student_ids = []
    demo_students = [
        {"name": "Devin Chen", "email": "devin@student.local", "roll_number": "CS2026001", "department": "Computer Science", "batch": "2026"},
        {"name": "Sarah Miller", "email": "sarah@student.local", "roll_number": "CS2026002", "department": "Computer Science", "batch": "2026"},
        {"name": "Arjun Patel", "email": "arjun@student.local", "roll_number": "CS2026003", "department": "Information Tech", "batch": "2026"},
        {"name": "Elena Rostova", "email": "elena@student.local", "roll_number": "CS2026004", "department": "Computer Science", "batch": "2026"},
        {"name": "Marcus Vance", "email": "marcus@student.local", "roll_number": "CS2026005", "department": "Data Science", "batch": "2026"},
    ]

    for s in demo_students:
        existing = await db.users.find_one({"roll_number": s["roll_number"]})
        if not existing:
            doc = {
                "name": s["name"],
                "email": s["email"],
                "roll_number": s["roll_number"],
                "department": s["department"],
                "batch": s["batch"],
                "password_hash": hash_password("Student@1234"),
                "role": "student",
                "is_active": True,
                "created_at": datetime.utcnow(),
            }
            res = await db.users.insert_one(doc)
            student_ids.append(res.inserted_id)
        else:
            student_ids.append(existing["_id"])

    print(f"Verified {len(student_ids)} demo student accounts (Password: Student@1234)")

    # 3. Question Bank
    sample_questions = [
        {
            "text": "What is the worst-case time complexity of QuickSort when using the standard deterministic Lomuto partitioning with the last element as pivot?",
            "type": "mcq",
            "subject": "Algorithms",
            "topic": "Sorting & Searching",
            "difficulty": "medium",
            "points": 4,
            "negative_points": 1,
            "tags": ["dsa", "sorting", "complexity"],
            "options": [
                {"id": "opt_a", "text": "O(N log N)"},
                {"id": "opt_b", "text": "O(N^2)"},
                {"id": "opt_c", "text": "O(N)"},
                {"id": "opt_d", "text": "O(log N)"},
            ],
            "correct_answer": "opt_b",
        },
        {
            "text": "Which of the following conditions MUST hold simultaneously for a deadlock to occur in an operating system?",
            "type": "multi_select",
            "subject": "Operating Systems",
            "topic": "Process Synchronization",
            "difficulty": "hard",
            "points": 5,
            "negative_points": 1,
            "tags": ["os", "deadlock", "concurrency"],
            "options": [
                {"id": "opt_a", "text": "Mutual Exclusion"},
                {"id": "opt_b", "text": "Hold and Wait"},
                {"id": "opt_c", "text": "No Preemption"},
                {"id": "opt_d", "text": "Circular Wait"},
            ],
            "correct_answer": ["opt_a", "opt_b", "opt_c", "opt_d"],
        },
        {
            "text": "In relational database design, which normal form eliminates transitive dependencies between non-prime attributes?",
            "type": "mcq",
            "subject": "Database Systems",
            "topic": "Normalization",
            "difficulty": "medium",
            "points": 3,
            "negative_points": 1,
            "tags": ["dbms", "normalization"],
            "options": [
                {"id": "opt_a", "text": "First Normal Form (1NF)"},
                {"id": "opt_b", "text": "Second Normal Form (2NF)"},
                {"id": "opt_c", "text": "Third Normal Form (3NF)"},
                {"id": "opt_d", "text": "Boyce-Codd Normal Form (BCNF)"},
            ],
            "correct_answer": "opt_c",
        },
        {
            "text": "What layer of the OSI model does the Transport Layer Security (TLS) protocol traditionally operate directly above?",
            "type": "mcq",
            "subject": "Computer Networks",
            "topic": "Network Security",
            "difficulty": "easy",
            "points": 3,
            "negative_points": 0,
            "tags": ["networks", "security", "osi"],
            "options": [
                {"id": "opt_a", "text": "Transport Layer"},
                {"id": "opt_b", "text": "Network Layer"},
                {"id": "opt_c", "text": "Data Link Layer"},
                {"id": "opt_d", "text": "Physical Layer"},
            ],
            "correct_answer": "opt_a",
        },
        {
            "text": "Name the self-balancing binary search tree where the heights of any two sibling subtrees differ by at most one.",
            "type": "short_answer",
            "subject": "Algorithms",
            "topic": "Trees",
            "difficulty": "medium",
            "points": 4,
            "negative_points": 0,
            "tags": ["dsa", "trees"],
            "options": [],
            "correct_answer": "AVL",
        },
        {
            "text": "In a distributed consensus protocol like Raft, the entity elected to orchestrate log replication is called the ______.",
            "type": "fill_in_blank",
            "subject": "Distributed Systems",
            "topic": "Consensus",
            "difficulty": "medium",
            "points": 4,
            "negative_points": 0,
            "tags": ["distributed", "consensus", "raft"],
            "options": [],
            "correct_answer": "leader",
        },
        {
            "text": "Which hash table collision resolution technique places colliding elements into linked lists stored at each bucket index?",
            "type": "mcq",
            "subject": "Algorithms",
            "topic": "Hashing",
            "difficulty": "easy",
            "points": 3,
            "negative_points": 1,
            "tags": ["dsa", "hashing"],
            "options": [
                {"id": "opt_a", "text": "Linear Probing"},
                {"id": "opt_b", "text": "Quadratic Probing"},
                {"id": "opt_c", "text": "Separate Chaining"},
                {"id": "opt_d", "text": "Double Hashing"},
            ],
            "correct_answer": "opt_c",
        },
        {
            "text": "Which HTTP status code signifies that the server successfully processed the request, but is not returning any content?",
            "type": "mcq",
            "subject": "Computer Networks",
            "topic": "HTTP Protocol",
            "difficulty": "easy",
            "points": 3,
            "negative_points": 0,
            "tags": ["web", "http"],
            "options": [
                {"id": "opt_a", "text": "200 OK"},
                {"id": "opt_b", "text": "201 Created"},
                {"id": "opt_c", "text": "204 No Content"},
                {"id": "opt_d", "text": "206 Partial Content"},
            ],
            "correct_answer": "opt_c",
        },
    ]

    question_ids = []
    for q in sample_questions:
        existing = await db.question_bank.find_one({"text": q["text"]})
        if not existing:
            doc = {**q, "created_at": datetime.utcnow()}
            res = await db.question_bank.insert_one(doc)
            question_ids.append(res.inserted_id)
        else:
            question_ids.append(existing["_id"])

    print(f"Verified {len(question_ids)} curated questions in question bank.")

    # 4. Create Active Examination
    exam_title = "National CS Placement & Technical Assessment 2026"
    existing_exam = await db.exams.find_one({"title": exam_title})
    if not existing_exam:
        now = datetime.utcnow()
        exam_doc = {
            "title": exam_title,
            "description": "High-stakes technical screening examination evaluating Algorithms, Operating Systems, Database Systems, and Network Architecture.",
            "duration_minutes": 60,
            "total_marks": 28,
            "status": "published",
            "question_ids": question_ids,
            "eligible_student_ids": student_ids,
            "created_by": admin_id,
            "created_at": now,
            "start_time": now - timedelta(hours=1),
            "end_time": now + timedelta(days=7),
            "published_snapshot": {
                "frozen_at": now,
                "questions": [
                    {
                        "id": str(qid),
                        "text": q["text"],
                        "type": q["type"],
                        "options": q.get("options", []),
                        "points": q["points"],
                        "negative_points": q.get("negative_points", 0),
                        "subject": q.get("subject"),
                        "topic": q.get("topic"),
                    }
                    for qid, q in zip(question_ids, sample_questions)
                ],
            },
        }
        res = await db.exams.insert_one(exam_doc)
        exam_id = res.inserted_id
        print(f"Created active examination: '{exam_title}' (ID: {exam_id})")
    else:
        exam_id = existing_exam["_id"]
        print(f"Active examination already exists: (ID: {exam_id})")

    # Seed exam_candidates so students can start attempts
    for sid in student_ids:
        await db.exam_candidates.update_one(
            {"exam_id": exam_id, "student_id": sid},
            {"$setOnInsert": {"exam_id": exam_id, "student_id": sid, "assigned_at": datetime.utcnow()}},
            upsert=True,
        )
    print(f"Registered {len(student_ids)} students as exam candidates.")

    # 5. Seed Simulated Submissions for Leaderboard & Analytics
    existing_attempts = await db.attempts.count_documents({"exam_id": exam_id})
    if existing_attempts < 3:
        simulated_scores = [
            {"student_idx": 1, "score": 28, "accuracy": 100.0, "duration": 1820, "switches": 0},
            {"student_idx": 2, "score": 24, "accuracy": 87.5, "duration": 2100, "switches": 0},
            {"student_idx": 3, "score": 19, "accuracy": 75.0, "duration": 2450, "switches": 1},
            {"student_idx": 4, "score": 14, "accuracy": 62.5, "duration": 2800, "switches": 2},
        ]

        for sim in simulated_scores:
            s_id = student_ids[sim["student_idx"]]
            attempt_doc = {
                "exam_id": exam_id,
                "student_id": s_id,
                "status": "submitted",
                "started_at": datetime.utcnow() - timedelta(minutes=45),
                "submitted_at": datetime.utcnow() - timedelta(minutes=15),
                "duration_seconds": sim["duration"],
                "score": sim["score"],
                "accuracy": sim["accuracy"],
                "answers": {
                    str(question_ids[0]): {"value": "opt_b", "is_correct": True, "marks_awarded": 4},
                    str(question_ids[1]): {"value": ["opt_a", "opt_b", "opt_c", "opt_d"], "is_correct": True, "marks_awarded": 5},
                    str(question_ids[2]): {"value": "opt_c", "is_correct": True, "marks_awarded": 3},
                },
                "tab_switch_count": sim["switches"],
                "fullscreen_exit_count": 0,
                "created_at": datetime.utcnow(),
            }
            await db.attempts.insert_one(attempt_doc)

        print("Created simulated completed attempts for deterministic leaderboard & psychometric analytics!")

    print("\n=======================================================")
    print("Database seeding completed successfully!")
    print("Admin:   admin@nextgen.local  /  Admin@1234")
    print("Student: CS2026001            /  Student@1234")
    print("=======================================================\n")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
