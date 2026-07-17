from __future__ import annotations

import re
from pathlib import Path

from consensus import run_consensus
from providers import AIProviderClient, parse_structured_json
from schemas import OrchestratorResult

GREETING_PATTERNS = [
    r"^(hi|hello|hey|howdy|greetings)\b",
    r"^good\s+(morning|afternoon|evening)\b",
    r"^(thanks|thank you|thx)\b",
    r"^(bye|goodbye|see you)\b",
]

NAVIGATION_PATTERNS = [
    r"\b(go to|open|show|navigate to|take me to)\b.*\b(tools?|settings|prompts?|dashboard|workspace)\b",
    r"\bwhere (can i|do i) (find|see)\b.*\b(tools?|settings|prompts?)\b",
    r"^help\b",
]

AMBIGUOUS_PATTERNS = [
    r"\b(which|what) (should|would) (i|we) (use|choose|pick|go with)\b",
    r"\b(vs\.?|versus|or)\b",
    r"\b(better|best option|trade-?off|compare)\b",
    r"\b(recommend|suggest).*\b(between|among)\b",
    r"\b(pros and cons|advantages and disadvantages)\b",
]

ARCHITECTURE_KEYWORDS = [
    "architecture",
    "stack",
    "database",
    "deploy",
    "auth",
    "api",
    "frontend",
    "backend",
    "microservice",
    "saas",
    "multi-tenant",
    "scalab",
    "framework",
    "build",
    "design",
    "schema",
    "infra",
]

_PROMPT_PATH = Path(__file__).parent / "prompts" / "system_prompt.txt"
DISHA_SYSTEM_PROMPT = _PROMPT_PATH.read_text(encoding="utf-8")


def _matches_any(text: str, patterns: list[str]) -> bool:
    lowered = text.lower().strip()
    return any(re.search(p, lowered) for p in patterns)


def _provider_for_model(model: str) -> str:
    model_lower = model.lower()
    if "claude" in model_lower:
        return "anthropic"
    if "gpt" in model_lower or "o1" in model_lower:
        return "openai"
    if "gemini" in model_lower:
        return "google"
    if "llama" in model_lower or "mixtral" in model_lower:
        return "groq"
    return "groq"


def classify_message(text: str) -> str:
    if _matches_any(text, GREETING_PATTERNS):
        return "greeting"
    if _matches_any(text, NAVIGATION_PATTERNS):
        return "navigation"
    if _matches_any(text, AMBIGUOUS_PATTERNS):
        return "ambiguous"
    if any(kw in text.lower() for kw in ARCHITECTURE_KEYWORDS) or len(text.split()) > 12:
        return "architecture"
    return "general"


def _greeting_response(text: str) -> OrchestratorResult:
    lowered = text.lower().strip()
    if re.match(r"^(thanks|thank you|thx)\b", lowered):
        content = "You're welcome! Let me know when you're ready to continue planning your architecture."
    elif re.match(r"^(bye|goodbye|see you)\b", lowered):
        content = "Goodbye! Your workspace will be here when you return."
    else:
        content = (
            "Hi — I'm Disha, your AI architecture planning assistant. "
            "Describe what you're building and I'll help map requirements, architecture, tools, and prompts."
        )
    return OrchestratorResult(kind="text", content=content, confidence_delta=2)


def _navigation_response(text: str) -> OrchestratorResult:
    lowered = text.lower()
    if "tool" in lowered:
        content = "Open the **Tool Registry** from the sidebar to browse curated AI dev tools and generate setup prompts."
    elif "setting" in lowered or "api key" in lowered:
        content = "Head to **Settings** to configure your Groq, OpenAI, Anthropic, or Google API keys."
    elif "prompt" in lowered:
        content = "Visit the **Prompt Library** to view, copy, and download generated prompts for your workspace."
    elif "dashboard" in lowered:
        content = "Go to the **Dashboard** to see all your workspaces and start a new planning session."
    else:
        content = "Use the sidebar to navigate between Dashboard, Tools, Prompts, and Settings."
    return OrchestratorResult(kind="text", content=content, confidence_delta=1)


async def orchestrate_message(
    text: str,
    history: list[dict],
    default_model: str,
    api_keys: dict[str, str],
    project_summary: dict | None = None,
) -> OrchestratorResult:
    intent = classify_message(text)

    if intent == "greeting":
        return _greeting_response(text)
    if intent == "navigation":
        return _navigation_response(text)

    context = _build_context(history, project_summary)
    client = AIProviderClient(api_keys)
    available = client.available_providers()

    if not available:
        return OrchestratorResult(
            kind="text",
            content=(
                "I'd love to help with architecture planning, but no AI provider keys are configured. "
                "Add your Groq, OpenAI, Anthropic, or Google API key in Settings to get started."
            ),
            confidence_delta=3,
        )

    if intent == "ambiguous":
        consensus = await run_consensus(client, text, context)
        options = [
            {"model": r.model, "recommendation": r.recommendation, "confidence": r.confidence}
            for r in consensus.results
        ]
        return OrchestratorResult(
            kind="consensus",
            content="I polled multiple models on this decision:",
            consensus_data={
                "options": options,
                "final_index": consensus.final_index,
                "summary": consensus.summary,
            },
            confidence_delta=8,
            phase="Architecture",
        )

    provider = _provider_for_model(default_model)
    if provider not in available:
        provider = available[0]

    user_prompt = f"{context}\n\nUser message:\n{text}"
    try:
        response = await client.complete(provider, DISHA_SYSTEM_PROMPT, user_prompt, default_model)
    except Exception as exc:
        fallback_providers = [p for p in available if p != provider]
        if fallback_providers:
            try:
                response = await client.complete(fallback_providers[0], DISHA_SYSTEM_PROMPT, user_prompt)
            except Exception as exc2:
                return OrchestratorResult(
                    kind="text",
                    content=f"All configured providers failed. Last error: {exc2}. Please check your API keys in Settings.",
                    confidence_delta=0,
                )
        else:
            return OrchestratorResult(
                kind="text",
                content=f"I hit an error calling {provider}: {exc}. Check your API key in Settings.",
                confidence_delta=0,
            )

    structured = parse_structured_json(response.content)
    tool_data = None
    phase = None
    tech_stack = None

    if structured:
        recommendations = structured.get("tool_recommendations", [])
        # handle old single tool_recommendation format too
        if not recommendations and structured.get("tool_recommendation"):
            recommendations = [structured["tool_recommendation"]]

        if recommendations:
            tool_data = [
                {
                    "name": tr.get("name", ""),
                    "description": tr.get("description", ""),
                    "paid": bool(tr.get("paid", False)),
                    "category": tr.get("category", "Backend"),
                    "best_for": tr.get("best_for", ""),
                    "pros": tr.get("pros", []),
                    "cons": tr.get("cons", []),
                }
                for tr in recommendations
            ]
        phase = structured.get("phase")
        tech_stack = structured.get("tech_stack")

    content = response.content
    if structured:
        content = re.sub(r"\{.*\}\s*$", "", content, flags=re.DOTALL).strip()

    if tool_data and len(tool_data) > 0:
        return OrchestratorResult(
            kind="tool",
            content=content or f"Recommended: {tool_data[0]['name']}",
            tool_data=tool_data,
            phase=phase,
            tech_stack=tech_stack,
            confidence_delta=6,
        )

    return OrchestratorResult(
        kind="text",
        content=content,
        phase=phase,
        tech_stack=tech_stack,
        confidence_delta=5,
    )


def _build_context(history: list[dict], project_summary: dict | None) -> str:
    parts: list[str] = []
    if project_summary:
        parts.append(f"Project summary: {project_summary}")
    if history:
        recent = history[-10:]
        lines = [f"{m.get('author', 'user')}: {m.get('content', '')}" for m in recent]
        parts.append("Recent conversation:\n" + "\n".join(lines))
    return "\n\n".join(parts) if parts else "No prior context."