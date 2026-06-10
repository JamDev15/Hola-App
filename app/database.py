from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import settings

_client: AsyncIOMotorClient | None = None


async def connect_db():
    global _client
    _client = AsyncIOMotorClient(settings.mongodb_uri)


async def close_db():
    global _client
    if _client:
        _client.close()
        _client = None


def get_db() -> AsyncIOMotorDatabase:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.mongodb_uri)
    return _client[settings.db_name]
