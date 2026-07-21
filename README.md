# Disha Backend

FastAPI backend for [Disha](https://github.com/Here-Nikhil/intellicode-navigator) — an AI architecture planning assistant. Handles workspaces, conversational AI orchestration, multi-model consensus, encrypted API key storage, tool registry, and prompt generation.

## Prerequisites

- Python 3.11+
- A [Neon](https://neon.tech) PostgreSQL database
- At least one AI provider API key (Groq, OpenAI, Anthropic, or Google) — via `.env` or the Settings UI

## Quick start

### 1. Create a virtual environment

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL URL (`postgresql://...`) |
| `MASTER_ENCRYPTION_KEY` | Yes | Secret for AES-256-GCM encryption of stored API keys |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key for JWT verification |
| `CLERK_WEBHOOK_SECRET` | Yes | Clerk webhook signing secret |
| `GROQ_ADMIN_KEY` | No | Server-side Groq key for admin operations |

Generate a strong encryption key:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 4. Run the server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API is available at `http://localhost:8000`. Interactive docs: `http://localhost:8000/docs`.

Tables are created automatically on startup, and the tool registry is seeded with Cursor, Claude Code, Windsurf, Bolt, Lovable, Replit, Vercel, Fly.io, Cloudflare Workers, Supabase, Neon, PlanetScale, GitHub Copilot, and Emergence AI.

> **Note:** VS Code must be run as Administrator on Windows. Use `\` not `/` in paths.

## Connect the frontend

The frontend (TanStack Start on `localhost:3000`) expects this API at `http://localhost:8000`. Set `VITE_API_URL=http://localhost:8000` in the frontend `.env` for local testing.

## API overview

### Workspaces

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/workspaces` | Create a workspace |
| `GET` | `/workspaces` | List workspaces |
| `PATCH` | `/workspaces/{id}` | Rename or update default model |
| `DELETE` | `/workspaces/{id}` | Delete a workspace |
| `POST` | `/workspaces/{id}/messages` | Send a message and receive Disha's response |
| `GET` | `/workspaces/{id}/messages` | Get conversation history |
| `GET` | `/workspaces/{id}/stream?message=...` | SSE stream for AI responses |

### Tools & prompts

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/tools` | List tool registry |
| `POST` | `/tools/submit` | Submit a tool for admin review |
| `POST` | `/tools/{id}/generate-prompt` | Generate a platform-specific prompt |
| `GET` | `/prompts?workspace_id=...` | List generated prompts |
| `DELETE` | `/prompts/{id}` | Delete a prompt |

### Settings

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/settings/api-keys` | Save an encrypted API key |
| `GET` | `/settings/api-keys` | List providers with masked keys |

### Admin

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/tools/pending` | List tools pending approval |
| `POST` | `/admin/tools/{id}/approve` | Approve a pending tool |
| `DELETE` | `/admin/tools/{id}/reject` | Reject and delete a pending tool |
| `GET` | `/admin/users` | List all users |
| `POST` | `/admin/users/{id}/suspend` | Suspend a user |
| `DELETE` | `/admin/users/{id}` | Delete a user |

Admin access requires Clerk metadata `{"role": "admin"}` and DB `role = 'admin'`.

## Architecture

### Orchestration layer

When a message arrives, Disha classifies intent:

1. **Pure greeting** (no project content) — handled locally without calling an AI provider
2. **Navigation** — sidebar/settings queries answered locally
3. **Prompt request** — routed directly to prompt generation
4. **Ambiguous engineering decisions** — triggers the consensus engine (up to 3 models in parallel)
5. **Architecture / general** — routed to the user's configured model via the full Disha system prompt

Greetings mixed with project content (e.g. "hi, I want to build a SaaS app") are correctly routed to the LLM — the greeting is never used as the sole signal.

### Quick reply options

Disha can return structured `options` in its JSON response when it is genuinely presenting a choice to the user (e.g. "React or Vue?"). These are stored in the `messages` table and rendered as quick reply buttons on the frontend. Options are never scraped from bullet points — they only appear when the LLM explicitly outputs them.

### Consensus engine

For trade-off questions ("X vs Y", "which should I use"), Disha queries up to three configured providers simultaneously, scores each response, clusters similar recommendations, and returns:

- Per-model recommendation and confidence score
- A winning recommendation with summary rationale

### Conversation summarization

After every 20 messages, conversation history is compressed into a structured project summary stored in the `projects` and `conversations` tables (overview, requirements, tech stack, decisions, open questions).

### API key encryption

User API keys are encrypted with **AES-256-GCM** before storage. Keys are decrypted only at request time when calling provider APIs. The master key never leaves the server environment.

### System prompt

Disha's personality and conversation flow are controlled by `backend/prompts/system_prompt.txt`. This file can be edited without redeploying — changes take effect on the next server restart.

## SSE streaming example

```javascript
const source = new EventSource(
  `http://localhost:8000/workspaces/${workspaceId}/stream?message=${encodeURIComponent("Should I use Vercel or Fly.io?")}`
);

source.addEventListener("token", (e) => {
  const { token } = JSON.parse(e.data);
  process.stdout.write(token);
});

source.addEventListener("consensus", (e) => {
  console.log("consensus", JSON.parse(e.data));
});

source.addEventListener("done", (e) => {
  // done payload includes: message_id, kind, tool, consensus, generated_prompt, quick_reply_options
  console.log("done", JSON.parse(e.data));
  source.close();
});
```

## Database schema

Tables: `users`, `workspaces`, `conversations`, `messages`, `projects`, `api_keys`, `tool_registry`, `generated_prompts`.

The `messages` table includes a `quick_reply_options` JSONB column storing structured follow-up choices returned by the LLM.

## Production

Deployed on Railway. Environment variables are set via Railway's dashboard. The Neon database is shared between local and production — run migrations carefully.

For production, run with multiple workers behind a reverse proxy:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

Never commit `.env` to version control.