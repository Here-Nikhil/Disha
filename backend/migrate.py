import asyncio
from database import get_engine
from sqlalchemy import text

async def migrate():
    async with get_engine().begin() as conn:
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_id VARCHAR(255) UNIQUE"))
        await conn.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS generated_prompt_data JSONB"))
        print("Migration done!")

asyncio.run(migrate())