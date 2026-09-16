from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from bson import ObjectId
from datetime import datetime
from app.core.deps import require_admin
from app.core.database import get_db
from app.models.question import QuestionCreate, QuestionAdmin

router = APIRouter(prefix="/api/admin/questions", tags=["admin-questions"])


@router.get("", response_model=List[QuestionAdmin])
async def list_questions(
    search: Optional[str] = Query(None),
    subject: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    question_type: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    admin=Depends(require_admin),
    db=Depends(get_db),
):
    query: dict = {}
    if subject:
        query["subject"] = subject
    if topic:
        query["topic"] = topic
    if difficulty:
        query["difficulty"] = difficulty
    if question_type:
        query["question_type"] = question_type
    if tag:
        query["tags"] = tag
    if search:
        query["text"] = {"$regex": search, "$options": "i"}

    questions = await db.question_bank.find(query).skip(skip).limit(limit).to_list(None)
    return [QuestionAdmin.from_doc(q) for q in questions]


@router.get("/count")
async def count_questions(admin=Depends(require_admin), db=Depends(get_db)):
    total = await db.question_bank.count_documents({})
    return {"total": total}


@router.post("", response_model=QuestionAdmin)
async def create_question(body: QuestionCreate, admin=Depends(require_admin), db=Depends(get_db)):
    doc = body.model_dump()
    doc["created_by"] = str(admin["_id"])
    doc["created_at"] = datetime.utcnow()
    doc["updated_at"] = datetime.utcnow()

    result = await db.question_bank.insert_one(doc)
    doc["_id"] = result.inserted_id
    return QuestionAdmin.from_doc(doc)


@router.get("/{question_id}", response_model=QuestionAdmin)
async def get_question(question_id: str, admin=Depends(require_admin), db=Depends(get_db)):
    q = await db.question_bank.find_one({"_id": ObjectId(question_id)})
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    return QuestionAdmin.from_doc(q)


@router.put("/{question_id}", response_model=QuestionAdmin)
async def update_question(question_id: str, body: QuestionCreate, admin=Depends(require_admin), db=Depends(get_db)):
    doc = body.model_dump(exclude_unset=True)
    doc["updated_at"] = datetime.utcnow()

    result = await db.question_bank.find_one_and_update(
        {"_id": ObjectId(question_id)},
        {"$set": doc},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Question not found")
    return QuestionAdmin.from_doc(result)


@router.delete("/{question_id}")
async def delete_question(question_id: str, admin=Depends(require_admin), db=Depends(get_db)):
    result = await db.question_bank.delete_one({"_id": ObjectId(question_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    return {"deleted": True}
