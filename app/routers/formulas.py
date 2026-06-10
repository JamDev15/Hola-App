from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from bson import ObjectId

from app.database import get_db
from app.models.formula import FormulaCreate, FormulaUpdate
from app.utils import serialize, serialize_many

router = APIRouter()


@router.get("")
async def list_formulas():
    db = get_db()
    docs = await db.formulas.find().sort("name", 1).to_list(None)
    return serialize_many(docs)


@router.post("", status_code=201)
async def create_formula(body: FormulaCreate):
    db = get_db()
    if await db.formulas.find_one({"name": body.name}):
        raise HTTPException(409, "Formula name already exists")
    doc = {
        **body.model_dump(),
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }
    result = await db.formulas.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc)


@router.get("/{formula_id}")
async def get_formula(formula_id: str):
    db = get_db()
    doc = await db.formulas.find_one({"_id": ObjectId(formula_id)})
    if not doc:
        raise HTTPException(404, "Formula not found")
    return serialize(doc)


@router.put("/{formula_id}")
async def update_formula(formula_id: str, body: FormulaUpdate):
    db = get_db()
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    update_data["updatedAt"] = datetime.now(timezone.utc)
    result = await db.formulas.find_one_and_update(
        {"_id": ObjectId(formula_id)},
        {"$set": update_data},
        return_document=True,
    )
    if not result:
        raise HTTPException(404, "Formula not found")
    return serialize(result)


@router.delete("/{formula_id}")
async def delete_formula(formula_id: str):
    db = get_db()
    result = await db.formulas.delete_one({"_id": ObjectId(formula_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Formula not found")
    return {"success": True}
