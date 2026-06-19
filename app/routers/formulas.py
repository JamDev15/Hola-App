from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException

from app.database import get_db
from app.models.formula import FormulaCreate, FormulaUpdate
from app.utils import to_camel, to_snake

router = APIRouter()


@router.get("")
async def list_formulas():
    db = get_db()
    response = await db.table("formulas").select("*").order("name").execute()
    return [to_camel(r) for r in response.data]


@router.post("", status_code=201)
async def create_formula(body: FormulaCreate):
    db = get_db()
    existing = await db.table("formulas").select("id").eq("name", body.name).execute()
    if existing.data:
        raise HTTPException(409, "Formula name already exists")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        **to_snake(body.model_dump()),
        "created_at": now,
        "updated_at": now,
    }
    response = await db.table("formulas").insert(doc).execute()
    return to_camel(response.data[0])


@router.get("/{formula_id}")
async def get_formula(formula_id: str):
    db = get_db()
    response = await db.table("formulas").select("*").eq("id", formula_id).execute()
    if not response.data:
        raise HTTPException(404, "Formula not found")
    return to_camel(response.data[0])


@router.put("/{formula_id}")
async def update_formula(formula_id: str, body: FormulaUpdate):
    db = get_db()
    raw = {k: v for k, v in body.model_dump().items() if v is not None}
    update_data = to_snake(raw)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    response = await db.table("formulas").update(update_data).eq("id", formula_id).execute()
    if not response.data:
        raise HTTPException(404, "Formula not found")
    return to_camel(response.data[0])


@router.delete("/{formula_id}")
async def delete_formula(formula_id: str):
    db = get_db()
    response = await db.table("formulas").delete().eq("id", formula_id).execute()
    if not response.data:
        raise HTTPException(404, "Formula not found")
    return {"success": True}
