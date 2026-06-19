from supabase import acreate_client, AsyncClient
from app.config import settings

_client: AsyncClient | None = None


async def init_db():
    global _client
    _client = await acreate_client(settings.supabase_url, settings.supabase_key)


def get_db() -> AsyncClient:
    if _client is None:
        raise RuntimeError("Database not initialized")
    return _client
