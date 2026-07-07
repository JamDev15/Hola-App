from pydantic import BaseModel
from typing import Optional, Any
from enum import Enum


class ProofJobStatus(str, Enum):
    in_progress = "in_progress"
    done = "done"


class ProofJobCreate(BaseModel):
    ownerName: str
    clientName: str
    fileName: Optional[str] = None
    thumbnail: Optional[str] = None
    round: int = 1
    result: Optional[Any] = None
    dropboxUploads: Optional[Any] = None


class ProofJobUpdate(BaseModel):
    ownerName: Optional[str] = None
    clientName: Optional[str] = None
    status: Optional[ProofJobStatus] = None
    round: Optional[int] = None
    fileName: Optional[str] = None
    thumbnail: Optional[str] = None
    result: Optional[Any] = None
    dropboxUploads: Optional[Any] = None
    finalVerification: Optional[Any] = None
