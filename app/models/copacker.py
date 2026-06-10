from pydantic import BaseModel
from typing import Optional, List


class CoPackerCreate(BaseModel):
    name: str
    location: str
    specialties: List[str] = []
    capacity: int
    currentLoad: int = 0
    notes: Optional[str] = None
    isActive: bool = True


class CoPackerUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    specialties: Optional[List[str]] = None
    capacity: Optional[int] = None
    currentLoad: Optional[int] = None
    notes: Optional[str] = None
    isActive: Optional[bool] = None
