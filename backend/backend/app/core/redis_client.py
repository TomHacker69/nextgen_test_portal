import redis.asyncio as aioredis
from app.core.config import settings

redis_client: aioredis.Redis = None


async def connect_redis():
    global redis_client
    redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        await redis_client.ping()
        print("[Redis] Connected")
    except Exception as e:
        print(f"[Redis] Warning: Could not connect - {e}. Continuing without Redis.")
        redis_client = None


async def close_redis():
    global redis_client
    if redis_client:
        await redis_client.aclose()
        print("[Redis] Connection closed")


def get_redis():
    return redis_client
