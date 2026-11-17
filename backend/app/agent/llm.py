"""One small interface over the LLM providers the user can pick.

Groq, Gemini and OpenAI all speak the OpenAI chat format, so they share one class.
Claude goes through the official Anthropic SDK. The key comes from the user's
session (RAM only) and is passed in, never read from env or disk.
"""

from __future__ import annotations

import json
import os
import re
from typing import Protocol

from pydantic import BaseModel, ValidationError

OPENAI_COMPAT = {
    "groq": ("https://api.groq.com/openai/v1", "llama-3.3-70b-versatile"),
    "gemini": ("https://generativelanguage.googleapis.com/v1beta/openai/", "gemini-2.5-flash"),
    "openai": (None, "gpt-4o-mini"),
}
ANTHROPIC_MODEL = "claude-opus-5-5"
PROVIDERS = (*OPENAI_COMPAT, "anthropic")


class LLMError(RuntimeError):
    pass


class LLM(Protocol):
    name: str

    def complete(self, system: str, user: str) -> str: ...


def parse_json[T: BaseModel](text: str, model: type[T]) -> T:
    """Models sometimes wrap JSON in ``` fences or add a sentence, so dig it out."""
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise LLMError("no JSON object in the model reply")
    try:
        return model.model_validate(json.loads(m.group(0)))
    except (json.JSONDecodeError, ValidationError) as e:
        raise LLMError(f"bad JSON from the model: {e}") from e


def complete_json[T: BaseModel](llm: LLM, system: str, user: str, model: type[T]) -> T:
    """Ask for JSON matching `model`. If it comes back broken, retry once with the error."""
    schema = json.dumps(model.model_json_schema())
    system = f"{system}\n\nReply with ONE JSON object only, matching this JSON schema:\n{schema}"
    reply = llm.complete(system, user)
    try:
        return parse_json(reply, model)
    except LLMError as e:
        retry = (
            f"{user}\n\nYour last reply was invalid ({str(e)[:300]}). Reply with valid JSON only."
        )
        return parse_json(llm.complete(system, retry), model)


class OpenAICompatLLM:
    def __init__(self, provider: str, api_key: str, model: str | None = None) -> None:
        from openai import OpenAI

        base_url, default_model = OPENAI_COMPAT[provider]
        self.name = provider
        self.model = model or default_model
        self._client = OpenAI(api_key=api_key, base_url=base_url, timeout=60, max_retries=2)

    def complete(self, system: str, user: str) -> str:
        r = self._client.chat.completions.create(
            model=self.model,
            temperature=0.3,
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        )
        return r.choices[0].message.content or ""


class AnthropicLLM:
    def __init__(self, api_key: str, model: str | None = None) -> None:
        import anthropic

        self.name = "anthropic"
        self.model = model or os.environ.get("WAVELENGTH_ANTHROPIC_MODEL", ANTHROPIC_MODEL)
        self._client = anthropic.Anthropic(api_key=api_key, timeout=120, max_retries=2)

    def complete(self, system: str, user: str) -> str:
        # fallbacks="default": if the model declines, the API retries on a fallback model
        r = self._client.beta.messages.create(
            model=self.model,
            max_tokens=16000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": "low"},
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        if r.stop_reason == "refusal":
            raise LLMError("the model declined this request")
        return "".join(b.text for b in r.content if b.type == "text")


def make_llm(provider: str, api_key: str, model: str | None = None) -> LLM:
    if provider == "anthropic":
        return AnthropicLLM(api_key, model)
    if provider in OPENAI_COMPAT:
        return OpenAICompatLLM(provider, api_key, model)
    raise ValueError(f"unknown provider {provider!r}")
