from __future__ import annotations

import json
import re
from dataclasses import dataclass

import httpx

from config import get_settings


@dataclass
class ProviderResponse:
    provider: str
    model: str
    content: str


MODEL_ALIASES: dict[str, dict[str, str]] = {
    "openai": {
        "gpt-4o": "gpt-4o",
        "claude-3.5-sonnet": "gpt-4o",
        "gemini-1.5-pro": "gpt-4o",
        "llama-3.3-70b": "gpt-4o",
    },
    "anthropic": {
        "claude-3.5-sonnet": "claude-3-5-sonnet-20241022",
        "gpt-4o": "claude-3-5-sonnet-20241022",
        "gemini-1.5-pro": "claude-3-5-sonnet-20241022",
    },
    "google": {
        "gemini-1.5-pro": "gemini-1.5-pro",
        "gpt-4o": "gemini-1.5-pro",
        "claude-3.5-sonnet": "gemini-1.5-pro",
    },
    "groq": {
        "llama-3.3-70b": "llama-3.3-70b-versatile",
        "gpt-4o": "llama-3.3-70b-versatile",
        "claude-3.5-sonnet": "llama-3.3-70b-versatile",
        "gemini-1.5-pro": "llama-3.3-70b-versatile",
    },
    "deepseek": {
        "deepseek-chat": "deepseek-chat",
        "gpt-4o": "deepseek-chat",
        "claude-3.5-sonnet": "deepseek-chat",
        "gemini-1.5-pro": "deepseek-chat",
        "llama-3.3-70b": "deepseek-chat",
    },
}


def resolve_model(provider: str, model: str | None) -> str:
    defaults = {
        "openai": "gpt-4o",
        "anthropic": "claude-3-5-sonnet-20241022",
        "google": "gemini-1.5-pro",
        "groq": "llama-3.3-70b-versatile",
        "deepseek": "deepseek-chat",
    }
    if not model:
        return defaults.get(provider, "llama-3.3-70b-versatile")
    return MODEL_ALIASES.get(provider, {}).get(model, defaults.get(provider, model))


class AIProviderClient:
    def __init__(self, api_keys: dict[str, str] | None = None):
        settings = get_settings()
        self.api_keys = api_keys or {}
        if not self.api_keys.get("openai") and settings.openai_api_key:
            self.api_keys["openai"] = settings.openai_api_key
        if not self.api_keys.get("anthropic") and settings.anthropic_api_key:
            self.api_keys["anthropic"] = settings.anthropic_api_key
        if not self.api_keys.get("google") and settings.google_api_key:
            self.api_keys["google"] = settings.google_api_key
        if not self.api_keys.get("groq") and settings.groq_api_key:
            self.api_keys["groq"] = settings.groq_api_key
        if not self.api_keys.get("deepseek") and settings.deepseek_api_key:
            self.api_keys["deepseek"] = settings.deepseek_api_key

    def available_providers(self) -> list[str]:
        return [p for p in ("groq", "openai", "anthropic", "google", "deepseek") if self.api_keys.get(p)]

    async def complete(
        self,
        provider: str,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
    ) -> ProviderResponse:
        resolved = resolve_model(provider, model)
        if provider == "openai":
            return await self._openai(system_prompt, user_prompt, resolved)
        if provider == "anthropic":
            return await self._anthropic(system_prompt, user_prompt, resolved)
        if provider == "google":
            return await self._google(system_prompt, user_prompt, resolved)
        if provider == "groq":
            return await self._groq(system_prompt, user_prompt, resolved)
        if provider == "deepseek":
            return await self._deepseek(system_prompt, user_prompt, resolved)
        raise ValueError(f"Unknown provider: {provider}")

    async def stream(
        self,
        provider: str,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
    ):
        response = await self.complete(provider, system_prompt, user_prompt, model)
        for word in response.content.split():
            yield word + " "

    async def _openai(self, system_prompt: str, user_prompt: str, model: str) -> ProviderResponse:
        api_key = self.api_keys.get("openai")
        if not api_key:
            raise RuntimeError("OpenAI API key not configured")
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.4,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            return ProviderResponse(provider="openai", model=model, content=content)

    async def _anthropic(self, system_prompt: str, user_prompt: str, model: str) -> ProviderResponse:
        api_key = self.api_keys.get("anthropic")
        if not api_key:
            raise RuntimeError("Anthropic API key not configured")
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": model,
                    "max_tokens": 4096,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": user_prompt}],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            content = "".join(block["text"] for block in data["content"] if block["type"] == "text")
            return ProviderResponse(provider="anthropic", model=model, content=content)

    async def _google(self, system_prompt: str, user_prompt: str, model: str) -> ProviderResponse:
        api_key = self.api_keys.get("google")
        if not api_key:
            raise RuntimeError("Google API key not configured")
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                params={"key": api_key},
                json={
                    "systemInstruction": {"parts": [{"text": system_prompt}]},
                    "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
                    "generationConfig": {"temperature": 0.4},
                },
            )
            resp.raise_for_status()
            data = resp.json()
            parts = data["candidates"][0]["content"]["parts"]
            content = "".join(part.get("text", "") for part in parts)
            return ProviderResponse(provider="google", model=model, content=content)

    async def _groq(self, system_prompt: str, user_prompt: str, model: str) -> ProviderResponse:
        api_key = self.api_keys.get("groq")
        if not api_key:
            raise RuntimeError("Groq API key not configured")
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.4,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            return ProviderResponse(provider="groq", model=model, content=content)

    async def _deepseek(self, system_prompt: str, user_prompt: str, model: str) -> ProviderResponse:
        api_key = self.api_keys.get("deepseek")
        if not api_key:
            raise RuntimeError("DeepSeek API key not configured")
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.4,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            return ProviderResponse(provider="deepseek", model=model, content=content)


def extract_recommendation(text: str) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for line in lines:
        if re.match(r"^(recommendation|choice|answer)\s*:", line, re.I):
            return line.split(":", 1)[1].strip()
    return lines[0] if lines else text.strip()


def parse_structured_json(text: str) -> tuple[dict | None, str]:
    """
    Returns (parsed_json, cleaned_text).
    cleaned_text has the JSON block removed from it permanently.
    """
    # Try <JSON> tags first
    tag_match = re.search(r"<JSON>(.*?)</JSON>", text, re.DOTALL)
    if tag_match:
        try:
            data = json.loads(tag_match.group(1).strip())
            cleaned = (text[:tag_match.start()] + text[tag_match.end():]).strip()
            return data, cleaned
        except json.JSONDecodeError:
            pass
    # Also strip malformed <JSON> tags even if JSON parsing failed
    text_clean = re.sub(r"<JSON>[\s\S]*?</JSON>", "", text).strip()
    text_clean = re.sub(r"<JSON>[\s\S]*", "", text_clean).strip()

    # Find the last { that starts a valid JSON block
    # Walk backwards through the text to find JSON
    last_brace = text.rfind('{')
    while last_brace != -1:
        candidate = text[last_brace:]
        try:
            data = json.loads(candidate)
            cleaned = text[:last_brace].strip().rstrip('}').strip()
            return data, cleaned
        except json.JSONDecodeError:
            last_brace = text.rfind('{', 0, last_brace)

    return None, text_clean