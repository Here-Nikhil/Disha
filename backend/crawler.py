from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone

import httpx
from sqlalchemy import select

from database import get_session_factory
from models import ToolRegistry

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

CRAWLER_PROMPT = """You are a tool discovery agent. Your job is to find NEW AI developer tools that were released or gained significant attention in the last 24 hours.

Search for new tools from these sources:
- Product Hunt (new AI dev tools launched today)
- GitHub Trending (new repos tagged with AI, developer tools)
- Tech news (new AI coding tools, IDE plugins, developer productivity tools)

Return a JSON array of tools you find. Each tool must have:
- name: tool name
- category: one of "IDE", "Deployment", "Database", "Frontend", "Backend"
- description: one sentence description (max 120 chars)
- is_free: true or false
- official_url: the official website URL
- supported_prompt_platforms: array from ["Cursor", "Claude Code", "Lovable", "Replit", "Windsurf", "Bolt"] that this tool works well with

Only include tools that are genuinely useful for software developers building with AI.
Only include tools that don't already exist in common knowledge (no Vercel, Supabase, Next.js etc).
Return ONLY the JSON array, no explanation, no markdown."""


async def _call_groq(prompt: str, admin_key: str) -> str:
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            GROQ_API_URL,
            headers={"Authorization": f"Bearer {admin_key}"},
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def run_crawler() -> None:
    admin_key = os.environ.get("GROQ_ADMIN_KEY", "")
    if not admin_key:
        logger.warning("GROQ_ADMIN_KEY not set — skipping crawler run")
        return

    logger.info("Starting tool crawler run...")
    today = datetime.now(timezone.utc).date().isoformat()

    try:
        raw = await _call_groq(CRAWLER_PROMPT, admin_key)

        # Strip markdown fences if present
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw
            raw = raw.rsplit("```", 1)[0]

        tools = json.loads(raw.strip())
        if not isinstance(tools, list):
            logger.error("Crawler returned non-list JSON")
            return

    except Exception as e:
        logger.error(f"Crawler Groq call failed: {e}")
        return

    async with get_session_factory()() as db:
        # Get existing tool names to avoid duplicates
        result = await db.execute(select(ToolRegistry.name))
        existing_names = {row[0].lower() for row in result.fetchall()}

        added = 0
        for tool in tools:
            name = tool.get("name", "").strip()
            if not name or name.lower() in existing_names:
                continue

            category = tool.get("category", "Backend")
            if category not in ("IDE", "Deployment", "Database", "Frontend", "Backend"):
                category = "Backend"

            new_tool = ToolRegistry(
                name=name,
                category=category,
                description=(tool.get("description") or "")[:200],
                is_free=bool(tool.get("is_free", True)),
                official_url=tool.get("official_url") or "#",
                supported_prompt_platforms=tool.get("supported_prompt_platforms") or [],
                pending=True,
                discovered_date=today,
            )
            db.add(new_tool)
            existing_names.add(name.lower())
            added += 1

        await db.commit()
        logger.info(f"Crawler run complete — {added} new tools added as pending")


async def start_scheduler() -> None:
    """Runs the crawler once at startup if needed, then every 24h at midnight UTC."""
    while True:
        now = datetime.now(timezone.utc)
        # Calculate seconds until next midnight UTC
        midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
        from datetime import timedelta
        next_midnight = midnight + timedelta(days=1)
        seconds_until_midnight = (next_midnight - now).total_seconds()
        logger.info(f"Crawler scheduled — next run in {seconds_until_midnight/3600:.1f} hours")
        await asyncio.sleep(seconds_until_midnight)
        await run_crawler()