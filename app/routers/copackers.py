from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from bson import ObjectId

from app.database import get_db
from app.models.copacker import CoPackerCreate, CoPackerUpdate
from app.utils import serialize, serialize_many

router = APIRouter()


@router.get("")
async def list_copackers():
    db = get_db()
    docs = await db.copackers.find().sort("name", 1).to_list(None)
    return serialize_many(docs)


@router.post("", status_code=201)
async def create_copacker(body: CoPackerCreate):
    db = get_db()
    doc = {
        **body.model_dump(),
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }
    result = await db.copackers.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize(doc)


@router.get("/{cp_id}")
async def get_copacker(cp_id: str):
    db = get_db()
    doc = await db.copackers.find_one({"_id": ObjectId(cp_id)})
    if not doc:
        raise HTTPException(404, "Co-packer not found")
    return serialize(doc)


@router.put("/{cp_id}")
async def update_copacker(cp_id: str, body: CoPackerUpdate):
    db = get_db()
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    update_data["updatedAt"] = datetime.now(timezone.utc)
    result = await db.copackers.find_one_and_update(
        {"_id": ObjectId(cp_id)},
        {"$set": update_data},
        return_document=True,
    )
    if not result:
        raise HTTPException(404, "Co-packer not found")
    return serialize(result)


@router.delete("/{cp_id}")
async def delete_copacker(cp_id: str):
    db = get_db()
    result = await db.copackers.delete_one({"_id": ObjectId(cp_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Co-packer not found")
    return {"success": True}
