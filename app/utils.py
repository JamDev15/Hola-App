from bson import ObjectId
from datetime import datetime


def serialize(doc: dict) -> dict:
    """Convert MongoDB document to JSON-serializable dict."""
    if doc is None:
        return None
    doc = dict(doc)
    for key, val in doc.items():
        if isinstance(val, ObjectId):
            doc[key] = str(val)
        elif isinstance(val, datetime):
            doc[key] = val.isoformat()
        elif isinstance(val, list):
            doc[key] = [
                serialize(i) if isinstance(i, dict) else
                str(i) if isinstance(i, ObjectId) else
                i.isoformat() if isinstance(i, datetime) else i
                for i in val
            ]
    return doc


def serialize_many(docs) -> list:
    return [serialize(d) for d in docs]
