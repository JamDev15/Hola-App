from pydantic import BaseModel
from typing import Optional, List


class SKU(BaseModel):
    name: str
    description: Optional[str] = None


class FormulaCreate(BaseModel):
    name: str
    skus: List[SKU] = []
    description: Optional[str] = None
    specialRequirements: Optional[str] = None


class FormulaUpdate(BaseModel):
    name: Optional[str] = None
    skus: Optional[List[SKU]] = None
    description: Optional[str] = None
    specialRequirements: Optional[str] = None
