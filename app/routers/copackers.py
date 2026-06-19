from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException

from app.database import get_db
from app.models.copacker import CoPackerCreate, CoPackerUpdate
from app.utils import to_camel, to_snake

router = APIRouter()


@router.get("")
async def list_copackers():
    db = get_db()
    response = await db.table("copackers").select("*").order("name").execute()
    return [to_camel(r) for r in response.data]


@router.post("", status_code=201)
async def create_copacker(body: CoPackerCreate):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        **to_snake(body.model_dump()),
        "created_at": now,
        "updated_at": now,
    }
    response = await db.table("copackers").insert(doc).execute()
    return to_camel(response.data[0])


@router.get("/{cp_id}")
async def get_copacker(cp_id: str):
    db = get_db()
    response = await db.table("copackers").select("*").eq("id", cp_id).execute()
    if not response.data:
        raise HTTPException(404, "Co-packer not found")
    return to_camel(response.data[0])


@router.put("/{cp_id}")
async def update_copacker(cp_id: str, body: CoPackerUpdate):
    db = get_db()
    raw = {k: v for k, v in body.model_dump().items() if v is not None}
    update_data = to_snake(raw)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    response = await db.table("copackers").update(update_data).eq("id", cp_id).execute()
    if not response.data:
        raise HTTPException(404, "Co-packer not found")
    return to_camel(response.data[0])


@router.delete("/{cp_id}")
async def delete_copacker(cp_id: str):
    db = get_db()
    response = await db.table("copackers").delete().eq("id", cp_id).execute()
    if not response.data:
        raise HTTPException(404, "Co-packer not found")
    return {"success": True}
