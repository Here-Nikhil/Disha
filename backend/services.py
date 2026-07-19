from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from encryption import decrypt_api_key, encrypt_api_key, mask_api_key
from models import ApiKey, Conversation, Message, Project, ToolRegistry, User, Workspace
from schemas import MessageResponse, ToolData, ConsensusData, ConsensusOption, GeneratedPromptData


async def get_user_api_keys(db: AsyncSession, user_id: uuid.UUID) -> dict[str, str]:
    settings = get_settings()
    if not settings.master_encryption_key:
        return {}

    result = await db.execute(select(ApiKey).where(ApiKey.user_id == user_id))
    keys: dict[str, str] = {}
    for row in result.scalars().all():
        try:
            keys[row.provider.lower()] = decrypt_api_key(row.encrypted_key, settings.master_encryption_key)
        except Exception:
            continue
    return keys


async def ensure_workspace(db: AsyncSession, workspace_id: uuid.UUID) -> Workspace:
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise ValueError("Workspace not found")
    return workspace


async def ensure_conversation(db: AsyncSession, workspace: Workspace) -> Conversation:
    result = await db.execute(select(Conversation).where(Conversation.workspace_id == workspace.id))
    conversation = result.scalar_one_or_none()
    if conversation:
        return conversation

    conversation = Conversation(workspace_id=workspace.id)
    db.add(conversation)
    await db.flush()
    return conversation


async def ensure_project(db: AsyncSession, workspace: Workspace) -> Project:
    result = await db.execute(select(Project).where(Project.workspace_id == workspace.id))
    project = result.scalar_one_or_none()
    if project:
        return project

    project = Project(workspace_id=workspace.id, summary={})
    db.add(project)
    await db.flush()
    return project


def message_to_response(message: Message) -> MessageResponse:
    tool = None
    tools = None

    if message.tool_data:
        if isinstance(message.tool_data, list):
            tools = [
                ToolData(
                    name=t.get("name", ""),
                    description=t.get("description", ""),
                    paid=bool(t.get("paid", False)),
                    category=t.get("category", "Backend"),
                    best_for=t.get("best_for"),
                    pros=t.get("pros"),
                    cons=t.get("cons"),
                )
                for t in message.tool_data
            ]
            tool = tools[0] if tools else None
        else:
            tool = ToolData(
                name=message.tool_data.get("name", ""),
                description=message.tool_data.get("description", ""),
                paid=bool(message.tool_data.get("paid", False)),
                category=message.tool_data.get("category", "Backend"),
                best_for=message.tool_data.get("best_for"),
                pros=message.tool_data.get("pros"),
                cons=message.tool_data.get("cons"),
            )
            tools = [tool]

    consensus = None
    if message.consensus_data:
        options = [
            ConsensusOption(
                model=o.get("model", ""),
                recommendation=o.get("recommendation", ""),
                confidence=float(o.get("confidence", 0.5)),
            )
            for o in message.consensus_data.get("options", [])
        ]
        consensus = ConsensusData(
            options=options,
            final_index=message.consensus_data.get("final_index", 0),
            summary=message.consensus_data.get("summary", ""),
        )

    return MessageResponse(
        id=message.id,
        author=message.author,
        kind=message.kind,
        content=message.content,
        tool=tool,
        tools=tools,
        consensus=consensus,
        created_at=message.created_at,
    )


async def save_api_key_for_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    provider: str,
    api_key: str,
) -> None:
    settings = get_settings()
    if not settings.master_encryption_key:
        raise ValueError("MASTER_ENCRYPTION_KEY is not configured")

    encrypted = encrypt_api_key(api_key, settings.master_encryption_key)
    result = await db.execute(
        select(ApiKey).where(ApiKey.user_id == user_id, ApiKey.provider == provider)
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.encrypted_key = encrypted
    else:
        db.add(ApiKey(user_id=user_id, provider=provider, encrypted_key=encrypted))
    await db.flush()


async def list_api_key_providers(db: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    settings = get_settings()
    providers = ["OpenAI", "Anthropic", "Google", "OpenRouter", "Groq"]
    result = await db.execute(select(ApiKey).where(ApiKey.user_id == user_id))
    stored = {row.provider: row for row in result.scalars().all()}

    items = []
    for provider in providers:
        row = stored.get(provider)
        if not row or not settings.master_encryption_key:
            items.append({"provider": provider, "masked_key": None, "status": "unset"})
            continue
        try:
            decrypted = decrypt_api_key(row.encrypted_key, settings.master_encryption_key)
            status = "valid" if len(decrypted) > 8 else "invalid"
            items.append(
                {"provider": provider, "masked_key": mask_api_key(decrypted), "status": status}
            )
        except Exception:
            items.append({"provider": provider, "masked_key": None, "status": "invalid"})
    return items


async def get_tool_by_id(db: AsyncSession, tool_id: uuid.UUID) -> ToolRegistry:
    result = await db.execute(select(ToolRegistry).where(ToolRegistry.id == tool_id))
    tool = result.scalar_one_or_none()
    if not tool:
        raise ValueError("Tool not found")
    return tool