from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException

from app.database import get_db
from app.models.proof_job import ProofJobCreate, ProofJobUpdate
from app.utils import to_camel, to_snake

router = APIRouter()


@router.get("")
async def list_proof_jobs(status: str = None, owner: str = None, client: str = None):
    db = get_db()
    query = db.table("proof_jobs").select("*").order("created_at", desc=True)
    if status:
        query = query.eq("status", status)
    if owner:
        query = query.ilike("owner_name", f"%{owner}%")
    if client:
        query = query.ilike("client_name", f"%{client}%")
    response = await query.execute()
    return [to_camel(r) for r in response.data]


@router.post("", status_code=201)
async def create_proof_job(body: ProofJobCreate):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    doc = to_snake(body.model_dump())
    doc["status"] = "in_progress"
    doc["created_at"] = now
    doc["updated_at"] = now
    response = await db.table("proof_jobs").insert(doc).execute()
    return to_camel(response.data[0])


@router.get("/{job_id}")
async def get_proof_job(job_id: str):
    db = get_db()
    response = await db.table("proof_jobs").select("*").eq("id", job_id).execute()
    if not response.data:
        raise HTTPException(404, "Proof job not found")
    return to_camel(response.data[0])


@router.put("/{job_id}")
async def update_proof_job(job_id: str, body: ProofJobUpdate):
    db = get_db()
    raw = {k: v for k, v in body.model_dump().items() if v is not None}
    update_data = to_snake(raw)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    if update_data.get("status") == "done":
        update_data["completed_at"] = update_data["updated_at"]
    if "final_verification" in update_data:
        update_data["final_verified_at"] = update_data["updated_at"]
    response = await db.table("proof_jobs").update(update_data).eq("id", job_id).execute()
    if not response.data:
        raise HTTPException(404, "Proof job not found")
    return to_camel(response.data[0])


@router.delete("/{job_id}")
async def delete_proof_job(job_id: str):
    db = get_db()
    response = await db.table("proof_jobs").delete().eq("id", job_id).execute()
    if not response.data:
        raise HTTPException(404, "Proof job not found")
    return {"success": True}
