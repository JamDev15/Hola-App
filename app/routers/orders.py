from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException

from app.database import get_db
from app.models.order import OrderCreate, OrderUpdate
from app.utils import to_camel, to_snake
from app.ai import get_recommendation

router = APIRouter()


@router.get("")
async def list_orders(status: str = None, client: str = None,
                      formula: str = None, coPacker: str = None):
    db = get_db()
    query = db.table("orders").select("*").order("created_at", desc=True)
    if status:
        query = query.eq("status", status)
    if client:
        query = query.ilike("client_name", f"%{client}%")
    if formula:
        query = query.ilike("formula", f"%{formula}%")
    if coPacker:
        query = query.ilike("assigned_co_packer", f"%{coPacker}%")
    response = await query.execute()
    return [to_camel(r) for r in response.data]


@router.post("", status_code=201)
async def create_order(body: OrderCreate):
    db = get_db()

    cp_resp = await db.table("copackers").select("*").eq("is_active", True).execute()
    co_packers = [to_camel(r) for r in cp_resp.data]

    ao_resp = await db.table("orders").select("*").in_("status", ["pending", "in-production"]).execute()
    active_orders = [to_camel(r) for r in ao_resp.data]

    try:
        ai_text = await get_recommendation(body.model_dump(), co_packers, active_orders)
    except Exception as e:
        ai_text = f"AI recommendation unavailable: {str(e)}"

    assigned = None
    for line in ai_text.splitlines():
        if "RECOMMENDED CO-PACKER:" in line:
            assigned = line.split("RECOMMENDED CO-PACKER:")[-1].strip().lstrip("*").rstrip("*").strip()
            break

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "client_name": body.clientName,
        "formula": body.formula,
        "sku": body.sku,
        "quantity": body.quantity,
        "notes": body.notes,
        "assigned_co_packer": assigned,
        "ai_recommendation": ai_text,
        "status": "pending",
        "batched_with": None,
        "created_at": now,
        "updated_at": now,
    }

    response = await db.table("orders").insert(doc).execute()

    if assigned:
        matched = next(
            (cp for cp in co_packers
             if assigned.lower() in cp["name"].lower()
             or cp["name"].lower() in assigned.lower()),
            None,
        )
        if matched:
            new_load = (matched.get("currentLoad") or 0) + body.quantity
            await db.table("copackers").update({"current_load": new_load}).eq("id", matched["id"]).execute()

    return to_camel(response.data[0])


@router.get("/{order_id}")
async def get_order(order_id: str):
    db = get_db()
    response = await db.table("orders").select("*").eq("id", order_id).execute()
    if not response.data:
        raise HTTPException(404, "Order not found")
    return to_camel(response.data[0])


@router.put("/{order_id}")
async def update_order(order_id: str, body: OrderUpdate):
    db = get_db()
    raw = {k: v for k, v in body.model_dump().items() if v is not None}
    update_data = to_snake(raw)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    response = await db.table("orders").update(update_data).eq("id", order_id).execute()
    if not response.data:
        raise HTTPException(404, "Order not found")
    return to_camel(response.data[0])


@router.delete("/{order_id}")
async def delete_order(order_id: str):
    db = get_db()
    response = await db.table("orders").delete().eq("id", order_id).execute()
    if not response.data:
        raise HTTPException(404, "Order not found")
    return {"success": True}
