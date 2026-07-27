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

CRAWLER_PROMPT = """You are a tool discovery agent. Your job is to find AI developer tools that are not in the existing list provided.

Look across these sources:
- Product Hunt (AI dev tools)
- GitHub Trending (repos tagged with AI, developer tools)
- Tech news (AI coding tools, IDE plugins, developer productivity tools)
- Well-known AI developer tools that are widely used

Existing tools (do not suggest these):
{existing_names}

Return a JSON array of 10 tools not in the list above. Each tool must have:
- name: tool name
- category: one of "IDE", "Deployment", "Database", "Frontend", "Backend"
- description: one sentence description (max 120 chars)
- is_free: true or false
- official_url: the official website URL
- supported_prompt_platforms: array from ["Cursor", "Claude Code", "Lovable", "Replit", "Windsurf", "Bolt"] that this tool works well with

Only include tools that are genuinely useful for software developers building with AI.
Return ONLY the JSON array, no explanation, no markdown."""


SUMMARY_PROMPT = """You are a concise technical writer. Given the name, description, and category of an AI developer tool, write a 3-4 sentence summary covering:
1. What the tool does
2. Who it is for
3. Why it is useful or notable

Be specific and factual. No marketing language. Return only the summary text, no headings or bullet points."""


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


async def _generate_summary(tool: dict, admin_key: str) -> str:
    prompt = f"""{SUMMARY_PROMPT}

Tool name: {tool.get('name', '')}
Category: {tool.get('category', '')}
Description: {tool.get('description', '')}
Official URL: {tool.get('official_url', '')}"""

    try:
        summary = await _call_groq(prompt, admin_key)
        return summary.strip()
    except Exception as e:
        logger.warning(f"Summary generation failed for {tool.get('name')}: {e}")
        return ""


async def run_crawler() -> None:
    admin_key = os.environ.get("GROQ_ADMIN_KEY", "")
    if not admin_key:
        logger.warning("GROQ_ADMIN_KEY not set — skipping crawler run")
        return

    logger.info("Starting tool crawler run...")
    today = datetime.now(timezone.utc).date().isoformat()

    # Fetch all existing tool names first to pass to the prompt
    try:
        async with get_session_factory()() as db:
            result = await db.execute(select(ToolRegistry.name))
            all_names = [row[0] for row in result.fetchall()]
    except Exception as e:
        logger.error(f"Failed to fetch existing tool names: {e}")
        return

    try:
        filled_prompt = CRAWLER_PROMPT.format(
            existing_names=", ".join(all_names) if all_names else "none"
        )
        raw = await _call_groq(filled_prompt, admin_key)

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
        existing_names = {name.lower() for name in all_names}

        added = 0
        for tool in tools:
            name = tool.get("name", "").strip()
            if not name or name.lower() in existing_names:
                continue

            category = tool.get("category", "Backend")
            if category not in ("IDE", "Deployment", "Database", "Frontend", "Backend"):
                category = "Backend"

            # Generate summary via Groq
            summary = await _generate_summary(tool, admin_key)

            new_tool = ToolRegistry(
                name=name,
                category=category,
                description=(tool.get("description") or "")[:200],
                is_free=bool(tool.get("is_free", True)),
                official_url=tool.get("official_url") or "#",
                supported_prompt_platforms=tool.get("supported_prompt_platforms") or [],
                pending=True,
                discovered_date=today,
                summary=summary,
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
        midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
        from datetime import timedelta
        next_midnight = midnight + timedelta(days=1)
        seconds_until_midnight = (next_midnight - now).total_seconds()
        logger.info(f"Crawler scheduled — next run in {seconds_until_midnight/3600:.1f} hours")
        await asyncio.sleep(seconds_until_midnight)
        await run_crawler()