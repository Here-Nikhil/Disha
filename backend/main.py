from __future__ import annotations

import asyncio
import json
import os
from contextlib import asynccontextmanager
from uuid import UUID

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import Base, dispose_engine, get_db, get_engine, get_session_factory
from models import Conversation, GeneratedPrompt, Message, Project, ToolRegistry, User, Workspace
from orchestrator import orchestrate_message
from providers import AIProviderClient
from schemas import (
    ApiKeyCreate,
    ApiKeyProviderResponse,
    GeneratePromptRequest,
    MessageCreate,
    MessageResponse,
    PromptResponse,
    SendMessageResponse,
    ToolResponse,
    WorkspaceCreate,
    WorkspaceResponse,
)
from seed_data import TOOL_REGISTRY_SEED
from services import (
    ensure_conversation,
    ensure_project,
    ensure_workspace,
    get_or_create_default_user,
    get_tool_by_id,
    get_user_api_keys,
    list_api_key_providers,
    message_to_response,
    save_api_key_for_user,
)
from summarizer import maybe_summarize_conversation

settings = get_settings()


# ---------------------------------------------------------------------------
# Clerk token verification
# ---------------------------------------------------------------------------

async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    auth_header = request.headers.get("Authorization", "")

    if not auth_header.startswith("Bearer "):
        print("DEBUG: No Bearer token found, falling back to dev user")
        return await get_or_create_default_user(db)

    token = auth_header.removeprefix("Bearer ").strip()
    print(f"DEBUG: Token received, length={len(token)}, prefix={token[:20]}")

    clerk_secret = os.environ.get("CLERK_SECRET_KEY", "")
    if not clerk_secret:
        print("DEBUG: No CLERK_SECRET_KEY found, falling back to dev user")
        return await get_or_create_default_user(db)

    print(f"DEBUG: CLERK_SECRET_KEY found, prefix={clerk_secret[:10]}")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.clerk.com/v1/tokens/verify",
                json={"token": token},
                headers={
                    "Authorization": f"Bearer {clerk_secret}",
                    "Content-Type": "application/json",
                },
            )

        print(f"DEBUG: Clerk response status={response.status_code}, body={response.text[:200]}")

        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session token")

        data = response.json()
        clerk_id = data.get("sub")
        if not clerk_id:
            raise HTTPException(status_code=401, detail="Could not identify user from token")

    except httpx.RequestError as e:
        print(f"DEBUG: httpx request error: {e}")
        raise HTTPException(status_code=503, detail="Could not reach Clerk to verify token")

    result = await db.execute(select(User).where(User.clerk_id == clerk_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found. Please sign in again.")

    return user


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

async def init_db() -> None:
    async with get_engine().begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def seed_tool_registry(db: AsyncSession) -> None:
    result = await db.execute(select(ToolRegistry))
    if result.scalars().first():
        return
    for tool in TOOL_REGISTRY_SEED:
        db.add(ToolRegistry(**tool))
    await db.flush()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    async with get_session_factory()() as session:
        await seed_tool_registry(session)
        await get_or_create_default_user(session)
        await session.commit()
    yield
    await dispose_engine()


app = FastAPI(
    title="Disha API",
    description="AI architecture planning assistant backend",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "service": "disha-backend"}


@app.post("/webhooks/clerk")
async def clerk_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    headers = dict(request.headers)

    webhook_secret = os.environ.get("CLERK_WEBHOOK_SECRET", "")
    if webhook_secret:
        from svix.webhooks import Webhook
        try:
            wh = Webhook(webhook_secret)
            event = wh.verify(payload, headers)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid webhook signature")
    else:
        event = json.loads(payload)

    event_type = event.get("type")
    data = event.get("data", {})

    if event_type == "user.created":
        clerk_id = data.get("id")
        email = data.get("email_addresses", [{}])[0].get("email_address", "")
        name = f"{data.get('first_name', '')} {data.get('last_name', '')}".strip() or email

        result = await db.execute(select(User).where(User.clerk_id == clerk_id))
        existing = result.scalar_one_or_none()
        if not existing:
            result2 = await db.execute(select(User).where(User.email == email))
            existing_email = result2.scalar_one_or_none()
            if existing_email:
                existing_email.clerk_id = clerk_id
                existing_email.auth_provider = "clerk"
            else:
                new_user = User(
                    email=email,
                    name=name,
                    role="user",
                    auth_provider="clerk",
                    clerk_id=clerk_id,
                )
                db.add(new_user)
        await db.flush()

    elif event_type == "user.deleted":
        clerk_id = data.get("id")
        result = await db.execute(select(User).where(User.clerk_id == clerk_id))
        user = result.scalar_one_or_none()
        if user:
            await db.delete(user)
        await db.flush()

    return {"status": "ok"}


@app.post("/workspaces", response_model=WorkspaceResponse)
async def create_workspace(
    body: WorkspaceCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    workspace = Workspace(user_id=user.id, name=body.name)
    db.add(workspace)
    await db.flush()

    conversation = Conversation(workspace_id=workspace.id)
    project = Project(workspace_id=workspace.id, summary={})
    db.add(conversation)
    db.add(project)
    await db.flush()
    await db.refresh(workspace)
    return workspace


@app.get("/workspaces", response_model=list[WorkspaceResponse])
async def list_workspaces(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Workspace).where(Workspace.user_id == user.id).order_by(Workspace.updated_at.desc())
    )
    return result.scalars().all()


@app.get("/workspaces/{workspace_id}/messages", response_model=list[MessageResponse])
async def get_messages(
    workspace_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    workspace = await ensure_workspace(db, workspace_id)
    conversation = await ensure_conversation(db, workspace)
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at)
    )
    return [message_to_response(m) for m in result.scalars().all()]


@app.post("/workspaces/{workspace_id}/messages", response_model=SendMessageResponse)
async def send_message(
    workspace_id: UUID,
    body: MessageCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    workspace = await ensure_workspace(db, workspace_id)
    conversation = await ensure_conversation(db, workspace)
    project = await ensure_project(db, workspace)
    api_keys = await get_user_api_keys(db, user.id)

    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at)
    )
    prior_messages = result.scalars().all()
    history = [{"author": m.author, "content": m.content} for m in prior_messages]

    user_message = Message(
        conversation_id=conversation.id,
        author="user",
        kind="text",
        content=body.content.strip(),
    )
    db.add(user_message)
    conversation.message_count += 1
    await db.flush()

    orchestration = await orchestrate_message(
        text=body.content,
        history=history,
        default_model=workspace.default_model,
        api_keys=api_keys,
        project_summary=project.summary,
    )

    assistant_message = Message(
        conversation_id=conversation.id,
        author="disha",
        kind=orchestration.kind,
        content=orchestration.content,
        tool_data=orchestration.tool_data,
        consensus_data=orchestration.consensus_data,
    )
    db.add(assistant_message)
    conversation.message_count += 1

    if orchestration.phase:
        workspace.phase = orchestration.phase
    if orchestration.tech_stack:
        workspace.tech_stack = orchestration.tech_stack
    workspace.confidence = min(100, workspace.confidence + orchestration.confidence_delta)
    workspace.activity = "active"

    all_messages = history + [
        {"author": "user", "content": body.content},
        {"author": "disha", "content": orchestration.content},
    ]
    summary = await maybe_summarize_conversation(
        all_messages,
        conversation.message_count,
        project.summary,
        api_keys,
    )
    if summary:
        project.summary = summary
        conversation.summary = summary
        if summary.get("phase"):
            workspace.phase = summary["phase"]
        if summary.get("tech_stack"):
            workspace.tech_stack = summary["tech_stack"]
        if summary.get("confidence"):
            workspace.confidence = int(summary["confidence"])

    await db.flush()
    await db.refresh(workspace)
    await db.refresh(user_message)
    await db.refresh(assistant_message)

    return SendMessageResponse(
        user_message=message_to_response(user_message),
        assistant_message=message_to_response(assistant_message),
        workspace=WorkspaceResponse.model_validate(workspace),
    )


@app.get("/workspaces/{workspace_id}/stream")
async def stream_message(
    workspace_id: UUID,
    message: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    workspace = await ensure_workspace(db, workspace_id)
    conversation = await ensure_conversation(db, workspace)
    project = await ensure_project(db, workspace)
    api_keys = await get_user_api_keys(db, user.id)

    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at)
    )
    prior_messages = result.scalars().all()
    history = [{"author": m.author, "content": m.content} for m in prior_messages]

    user_message = Message(
        conversation_id=conversation.id,
        author="user",
        kind="text",
        content=message.strip(),
    )
    db.add(user_message)
    conversation.message_count += 1
    await db.flush()

    orchestration = await orchestrate_message(
        text=message,
        history=history,
        default_model=workspace.default_model,
        api_keys=api_keys,
        project_summary=project.summary,
    )

    conv_id = conversation.id
    ws_id = workspace.id

    async def event_generator():
        yield f"event: start\ndata: {json.dumps({'status': 'streaming'})}\n\n"

        if orchestration.kind == "consensus" and orchestration.consensus_data:
            for i, option in enumerate(orchestration.consensus_data.get("options", [])):
                payload = {"type": "consensus_option", "index": i, **option}
                yield f"event: consensus\ndata: {json.dumps(payload)}\n\n"
                await asyncio.sleep(0.15)
            summary_payload = {
                "type": "consensus_summary",
                "final_index": orchestration.consensus_data.get("final_index", 0),
                "summary": orchestration.consensus_data.get("summary", ""),
            }
            yield f"event: consensus\ndata: {json.dumps(summary_payload)}\n\n"
            full_content = orchestration.content
        else:
            full_content = orchestration.content
            for word in full_content.split():
                yield f"event: token\ndata: {json.dumps({'token': word + ' '})}\n\n"
                await asyncio.sleep(0.03)

        assistant_id = None
        async with get_session_factory()() as stream_db:
            assistant_message = Message(
                conversation_id=conv_id,
                author="disha",
                kind=orchestration.kind,
                content=full_content,
                tool_data=orchestration.tool_data,
                consensus_data=orchestration.consensus_data,
            )
            stream_db.add(assistant_message)

            conv_result = await stream_db.execute(
                select(Conversation).where(Conversation.id == conv_id)
            )
            stream_conv = conv_result.scalar_one()
            stream_conv.message_count += 1

            ws_result = await stream_db.execute(select(Workspace).where(Workspace.id == ws_id))
            stream_ws = ws_result.scalar_one()
            if orchestration.phase:
                stream_ws.phase = orchestration.phase
            if orchestration.tech_stack:
                stream_ws.tech_stack = orchestration.tech_stack
            stream_ws.confidence = min(100, stream_ws.confidence + orchestration.confidence_delta)

            await stream_db.commit()
            await stream_db.refresh(assistant_message)
            assistant_id = str(assistant_message.id)

        done_payload = {
            "message_id": assistant_id,
            "kind": orchestration.kind,
            "tool": orchestration.tool_data,
            "consensus": orchestration.consensus_data,
        }
        yield f"event: done\ndata: {json.dumps(done_payload)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/tools", response_model=list[ToolResponse])
async def list_tools(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ToolRegistry).order_by(ToolRegistry.category, ToolRegistry.name))
    tools = result.scalars().all()
    return [
        ToolResponse(
            id=t.id,
            name=t.name,
            category=t.category,
            description=t.description,
            paid=not t.is_free,
            url=t.official_url,
            supported_prompt_platforms=t.supported_prompt_platforms,
        )
        for t in tools
    ]


@app.post("/tools/{tool_id}/generate-prompt", response_model=PromptResponse)
async def generate_prompt(
    tool_id: UUID,
    body: GeneratePromptRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tool = await get_tool_by_id(db, tool_id)

    workspace_id = body.workspace_id
    if not workspace_id:
        result = await db.execute(
            select(Workspace).where(Workspace.user_id == user.id).order_by(Workspace.updated_at.desc())
        )
        workspace = result.scalars().first()
        if not workspace:
            raise HTTPException(status_code=400, detail="Create a workspace before generating prompts.")
        workspace_id = workspace.id
    else:
        workspace = await ensure_workspace(db, workspace_id)

    project = await ensure_project(db, workspace)
    api_keys = await get_user_api_keys(db, user.id)
    client = AIProviderClient(api_keys)

    platform = body.platform
    if platform not in tool.supported_prompt_platforms and tool.supported_prompt_platforms:
        platform = tool.supported_prompt_platforms[0]

    system_prompt = (
        f"You write optimized prompts for {platform}. "
        "Produce a single, copy-paste-ready prompt an engineer can run in that tool. "
        "Be specific about files, commands, env vars, and validation steps."
    )
    user_prompt = (
        f"Tool: {tool.name}\n"
        f"Category: {tool.category}\n"
        f"Description: {tool.description}\n"
        f"Project context: {json.dumps(project.summary)}\n"
        f"Extra context: {body.context or 'None'}\n"
        f"Target platform: {platform}"
    )

    providers = client.available_providers()
    if providers:
        try:
            response = await client.complete(providers[0], system_prompt, user_prompt)
            prompt_body = response.content.strip()
        except Exception as exc:
            prompt_body = _fallback_prompt(tool.name, platform, str(exc))
    else:
        prompt_body = _fallback_prompt(tool.name, platform)

    prompt = GeneratedPrompt(
        workspace_id=workspace_id,
        tool_id=tool.id,
        title=f"{tool.name} — {platform} prompt",
        platform=platform,
        body=prompt_body,
    )
    db.add(prompt)
    await db.flush()
    await db.refresh(prompt)
    return prompt


@app.get("/prompts", response_model=list[PromptResponse])
async def list_prompts(
    workspace_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(GeneratedPrompt).join(Workspace).where(Workspace.user_id == user.id)

    if workspace_id:
        await ensure_workspace(db, workspace_id)
        query = query.where(GeneratedPrompt.workspace_id == workspace_id)

    result = await db.execute(query.order_by(GeneratedPrompt.created_at.desc()))
    return result.scalars().all()


@app.post("/settings/api-keys", response_model=ApiKeyProviderResponse)
async def save_api_key(
    body: ApiKeyCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    provider = body.provider.strip()
    if provider not in {"OpenAI", "Anthropic", "Google", "OpenRouter", "Groq"}:
        raise HTTPException(status_code=400, detail="Unsupported provider.")

    if not body.api_key.strip():
        raise HTTPException(status_code=400, detail="API key cannot be empty.")

    try:
        await save_api_key_for_user(db, user.id, provider, body.api_key.strip())
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    from encryption import mask_api_key
    return ApiKeyProviderResponse(
        provider=provider,
        masked_key=mask_api_key(body.api_key.strip()),
        status="valid" if len(body.api_key.strip()) > 8 else "invalid",
    )


@app.get("/settings/api-keys", response_model=list[ApiKeyProviderResponse])
async def get_api_keys(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items = await list_api_key_providers(db, user.id)
    return [ApiKeyProviderResponse(**item) for item in items]


def _fallback_prompt(tool_name: str, platform: str, error: str | None = None) -> str:
    note = f"\n\n(Note: AI generation unavailable{' — ' + error if error else ''}. Using template.)"
    return (
        f"You are integrating {tool_name} into the current project.\n"
        f"1. Read the repository structure and identify the framework.\n"
        f"2. Install {tool_name} with the minimal required dependencies.\n"
        f"3. Add configuration files and environment variables.\n"
        f"4. Implement a small sanity-check example proving the integration works.\n"
        f"5. Document rollback steps.\n"
        f"Optimize this workflow for {platform}."
        f"{note}"
    )