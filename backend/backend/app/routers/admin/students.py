from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from typing import List, Optional
import csv
import io
from bson import ObjectId
from datetime import datetime
from app.core.deps import require_admin
from app.core.database import get_db
from app.core.security import hash_password
from app.models.user import UserCreate, UserPublic

router = APIRouter(prefix="/api/admin/students", tags=["admin-students"])


@router.get("", response_model=List[UserPublic])
async def list_students(
    search: Optional[str] = Query(None),
    branch: Optional[str] = Query(None),
    section: Optional[str] = Query(None),
    batch: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    admin=Depends(require_admin),
    db=Depends(get_db),
):
    query: dict = {"role": "student"}
    if branch:
        query["branch"] = branch
    if section:
        query["section"] = section
    if batch:
        query["batch"] = batch
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"roll_number": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]

    students = await db.users.find(query).skip(skip).limit(limit).to_list(None)
    return [UserPublic.from_doc(s) for s in students]


@router.get("/count")
async def count_students(admin=Depends(require_admin), db=Depends(get_db)):
    total = await db.users.count_documents({"role": "student"})
    return {"total": total}


@router.post("", response_model=UserPublic)
async def create_student(body: UserCreate, admin=Depends(require_admin), db=Depends(get_db)):
    """Manually create a single student."""
    # Check duplicates
    if body.roll_number:
        existing = await db.users.find_one({"roll_number": body.roll_number})
        if existing:
            raise HTTPException(status_code=400, detail="Roll number already exists")
    if body.email:
        existing = await db.users.find_one({"email": body.email.lower()})
        if existing:
            raise HTTPException(status_code=400, detail="Email already exists")

    doc = {
        "name": body.name,
        "email": body.email.lower() if body.email else None,
        "roll_number": body.roll_number,
        "password_hash": hash_password(body.password),
        "role": "student",
        "branch": body.branch,
        "section": body.section,
        "year": body.year,
        "batch": body.batch,
        "is_active": True,
        "created_at": datetime.utcnow(),
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    return UserPublic.from_doc(doc)


@router.post("/import-csv")
async def import_students_csv(
    file: UploadFile = File(...),
    common_password: str = Query(...),
    exam_id: Optional[str] = Query(None),
    duplicate_policy: str = Query("skip"),  # skip | update
    admin=Depends(require_admin),
    db=Depends(get_db),
):
    """Bulk import students from CSV. Returns per-row results."""
    content = await file.read()
    text = content.decode("utf-8-sig")  # handle BOM
    reader = csv.DictReader(io.StringIO(text))

    results = {"imported": 0, "skipped": 0, "errors": []}
    password_hash = hash_password(common_password)

    for row_num, row in enumerate(reader, start=2):
        name = (row.get("name") or row.get("Name") or "").strip()
        roll = (row.get("roll_number") or row.get("Roll Number") or row.get("RollNumber") or "").strip()
        email = (row.get("email") or row.get("Email") or "").strip().lower()
        branch = (row.get("branch") or row.get("Branch") or "").strip()
        section = (row.get("section") or row.get("Section") or "").strip()
        year = (row.get("year") or row.get("Year") or "").strip()
        batch = (row.get("batch") or row.get("Batch") or "").strip()

        if not name:
            results["errors"].append({"row": row_num, "error": "Name is required"})
            continue

        # Check duplicates
        query = {}
        if roll:
            query = {"roll_number": roll}
        elif email:
            query = {"email": email}
        else:
            results["errors"].append({"row": row_num, "error": "Roll number or email required"})
            continue

        existing = await db.users.find_one(query)
        if existing:
            if duplicate_policy == "skip":
                results["skipped"] += 1
                continue
            elif duplicate_policy == "update":
                await db.users.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {"name": name, "branch": branch, "section": section, "year": year, "batch": batch}},
                )
                student_id = str(existing["_id"])
                results["imported"] += 1
            else:
                results["skipped"] += 1
                continue
        else:
            doc = {
                "name": name,
                "email": email or None,
                "roll_number": roll or None,
                "password_hash": password_hash,
                "role": "student",
                "branch": branch or None,
                "section": section or None,
                "year": year or None,
                "batch": batch or None,
                "is_active": True,
                "created_at": datetime.utcnow(),
            }
            ins = await db.users.insert_one(doc)
            student_id = str(ins.inserted_id)
            results["imported"] += 1

        # Assign to exam if provided
        if exam_id and student_id:
            await db.exam_candidates.update_one(
                {"exam_id": exam_id, "student_id": student_id},
                {"$setOnInsert": {"exam_id": exam_id, "student_id": student_id, "assigned_at": datetime.utcnow()}},
                upsert=True,
            )

    return results


@router.post("/assign-exam")
async def assign_students_to_exam(
    body: dict,
    admin=Depends(require_admin),
    db=Depends(get_db),
):
    """Bulk assign students to an exam."""
    exam_id = body.get("exam_id")
    student_ids = body.get("student_ids", [])
    if not exam_id or not student_ids:
        raise HTTPException(status_code=400, detail="exam_id and student_ids required")

    count = 0
    for sid in student_ids:
        await db.exam_candidates.update_one(
            {"exam_id": exam_id, "student_id": sid},
            {"$setOnInsert": {"exam_id": exam_id, "student_id": sid, "assigned_at": datetime.utcnow()}},
            upsert=True,
        )
        count += 1
    return {"assigned": count}


@router.delete("/{student_id}")
async def delete_student(student_id: str, admin=Depends(require_admin), db=Depends(get_db)):
    result = await db.users.delete_one({"_id": ObjectId(student_id), "role": "student"})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"deleted": True}
