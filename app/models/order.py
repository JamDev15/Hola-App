from pydantic import BaseModel
from typing import Optional
from enum import Enum


class OrderStatus(str, Enum):
    pending = "pending"
    in_production = "in-production"
    completed = "completed"


class OrderCreate(BaseModel):
    clientName: str
    formula: str
    sku: str
    quantity: int
    notes: Optional[str] = None


class OrderUpdate(BaseModel):
    clientName: Optional[str] = None
    formula: Optional[str] = None
    sku: Optional[str] = None
    quantity: Optional[int] = None
    notes: Optional[str] = None
    assignedCoPacker: Optional[str] = None
    status: Optional[OrderStatus] = None
    aiRecommendation: Optional[str] = None
