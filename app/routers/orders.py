from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from bson import ObjectId

from app.database import get_db
from app.models.order import OrderCreate, OrderUpdate
from app.utils import serialize, serialize_many
from app.ai import get_recommendation

router = APIRouter()


@router.get("")
async def list_orders(status: str = None, client: str = None,
                      formula: str = None, coPacker: str = None):
    db = get_db()
    query = {}
    if status:
        query["status"] = status
    if client:
        query["clientName"] = {"$regex": client, "$options": "i"}
    if formula:
        query["formula"] = {"$regex": formula, "$options": "i"}
    if coPacker:
        query["assignedCoPacker"] = {"$regex": coPacker, "$options": "i"}
    orders = await db.orders.find(query).sort("createdAt", -1).to_list(None)
    return serialize_many(orders)


@router.post("", status_code=201)
async def create_order(body: OrderCreate):
    db = get_db()

    # Fetch co-packers + active orders for AI context
    co_packers = await db.copackers.find({"isActive": True}).to_list(None)
    active_orders = await db.orders.find(
        {"status": {"$in": ["pending", "in-production"]}}
    ).to_list(None)

    # Get AI recommendation (fail gracefully if API key not set)
    try:
        ai_text = await get_recommendation(body.model_dump(), co_packers, active_orders)
    except Exception as e:
        ai_text = f"AI recommendation unavailable: {str(e)}"

    # Extract recommended co-packer name from AI response
    assigned = None
    for line in ai_text.splitlines():
        if "RECOMMENDED CO-PACKER:" in line:
            assigned = line.split("RECOMMENDED CO-PACKER:")[-1].strip().lstrip("*").rstrip("*").strip()
            break

    doc = {
        **body.model_dump(),
        "assignedCoPacker": assigned,
        "aiRecommendation": ai_text,
        "status": "pending",
        "batchedWith": None,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }

    result = await db.orders.insert_one(doc)
    doc["_id"] = result.inserted_id

    # Update co-packer load if matched
    if assigned:
        matched = next(
            (cp for cp in co_packers
             if assigned.lower() in cp["name"].lower()
             or cp["name"].lower() in assigned.lower()),
            None,
        )
        if matched:
            await db.copackers.update_one(
                {"_id": matched["_id"]},
                {"$inc": {"currentLoad": body.quantity}},
            )

    return serialize(doc)


@router.get("/{order_id}")
async def get_order(order_id: str):
    db = get_db()
    doc = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not doc:
        raise HTTPException(404, "Order not found")
    return serialize(doc)


@router.put("/{order_id}")
async def update_order(order_id: str, body: OrderUpdate):
    db = get_db()
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    update_data["updatedAt"] = datetime.now(timezone.utc)
    result = await db.orders.find_one_and_update(
        {"_id": ObjectId(order_id)},
        {"$set": update_data},
        return_document=True,
    )
    if not result:
        raise HTTPException(404, "Order not found")
    return serialize(result)


@router.delete("/{order_id}")
async def delete_order(order_id: str):
    db = get_db()
    result = await db.orders.delete_one({"_id": ObjectId(order_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Order not found")
    return {"success": True}
