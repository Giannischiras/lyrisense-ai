"""wrapper for the llm providers you can pick in the ui.

groq, gemini and openai all work with the openai format so they use the same class.
claude uses the anthropic sdk. the key comes from the user's session (only in memory),
it's never read from env or a file.
"""

from __future__ import annotations

import json
import os
import re
import time
from typing import Protocol

from pydantic import BaseModel, ValidationError

from app.log import llm_calls, log

OPENAI_COMPAT = {
    "groq": "https://api.groq.com/openai/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai/",
    "openai": None,
}
# we use the first one the key can access. model names change a lot so we check the list
PREFERRED = {
    "groq": [
        "openai/gpt-oss-120b",
        "llama-3.3-70b-versatile",
        "openai/gpt-oss-20b",
        "llama-3.1-8b-instant",
    ],
    "gemini": [
        "gemini-3-flash",
        "gemini-3-flash-preview",
        "gemini-flash-latest",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
    ],
    "openai": ["gpt-4.1-mini", "gpt-4o-mini", "gpt-4.1", "gpt-4o"],
}
ANTHROPIC_MODEL = "claude-opus-5-5"
PROVIDERS = (*OPENAI_COMPAT, "anthropic")


class LLMError(RuntimeError):
    def __init__(self, msg: str, status: int | None = None) -> None:
        super().__init__(msg)
        self.status = status


class LLM(Protocol):
    name: str

    def complete(self, system: str, user: str) -> str: ...


def _record(provider: str, model: str, t0: float, prompt_chars: int, reply_chars: int) -> None:
    ms = round((time.perf_counter() - t0) * 1000)
    log.info(
        "llm call  provider=%s model=%s ms=%d in=%d chars out=%d chars",
        provider,
        model,
        ms,
        prompt_chars,
        reply_chars,
    )
    calls = llm_calls.get()
    if calls is not None:
        calls.append({"model": model, "ms": ms})


def parse_json[T: BaseModel](text: str, model: type[T]) -> T:
    """sometimes the model puts the json in ``` or adds text around it, so find the json part"""
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise LLMError("no JSON object in the model reply")
    try:
        return model.model_validate(json.loads(m.group(0)))
    except (json.JSONDecodeError, ValidationError) as e:
        raise LLMError(f"bad JSON from the model: {e}") from e


def complete_json[T: BaseModel](llm: LLM, system: str, user: str, model: type[T]) -> T:
    """ask for json that fits `model`. if it's broken, try one more time and send the error"""
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

        self.name = provider
        self.model = model
        self._client = OpenAI(
            api_key=api_key, base_url=OPENAI_COMPAT[provider], timeout=60, max_retries=1
        )

    def _candidates(self) -> list[str]:
        """models to try, best first. the preferred ones, then any other flash/mini model"""
        import openai

        try:
            available = {m.id.removeprefix("models/") for m in self._client.models.list()}
        except openai.AuthenticationError as e:
            raise LLMError(f"{self.name} rejected the API key") from e
        except openai.APIError as e:
            raise LLMError(f"could not list {self.name} models: {e}") from e
        picks = [m for m in PREFERRED[self.name] if m in available]
        # model names change a lot, so also take newer ones we don't know about yet
        extra = sorted(
            (
                m
                for m in available
                if m not in picks
                and any(w in m for w in ("flash", "mini", "instant"))
                and not any(w in m for w in ("lite", "image", "tts", "audio", "live", "embed"))
            ),
            reverse=True,
        )
        if not picks + extra:
            raise LLMError(f"none of the usual {self.name} models are enabled for this key")
        return picks + extra

    def _call(self, model: str, system: str, user: str):
        import openai

        self._t0 = time.perf_counter()
        try:
            return self._client.chat.completions.create(
                model=model,
                temperature=0.3,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            )
        except openai.APIStatusError as e:
            log.warning("llm error provider=%s model=%s status=%s", self.name, model, e.status_code)
            raise LLMError(
                f"{self.name} returned {e.status_code} for {model}: {e.message}", e.status_code
            ) from e
        except openai.APIError as e:
            raise LLMError(f"{self.name} request failed: {e}") from e

    def complete(self, system: str, user: str) -> str:
        if self.model is not None:
            r = self._call(self.model, system, user)
        else:
            # try models until one answers. a model can be in the list but closed for
            # new keys (404), or have no free quota left (429)
            r = None
            last: LLMError | None = None
            for m in self._candidates()[:5]:
                try:
                    r = self._call(m, system, user)
                    self.model = m
                    log.info("using model %s for %s", m, self.name)
                    break
                except LLMError as e:
                    if e.status not in (404, 429):
                        raise
                    last = e
            if r is None:
                raise last or LLMError(f"no {self.name} model answered")
        t0 = self._t0
        text = r.choices[0].message.content or ""
        _record(self.name, self.model, t0, len(system) + len(user), len(text))
        return text


class AnthropicLLM:
    def __init__(self, api_key: str, model: str | None = None) -> None:
        import anthropic

        self.name = "anthropic"
        self.model = model or os.environ.get("LYRISENSE_ANTHROPIC_MODEL", ANTHROPIC_MODEL)
        self._client = anthropic.Anthropic(api_key=api_key, timeout=120, max_retries=2)

    def complete(self, system: str, user: str) -> str:
        import anthropic

        t0 = time.perf_counter()
        try:
            # fallbacks="default" means if the model refuses, the api tries another model
            r = self._client.beta.messages.create(
                model=self.model,
                max_tokens=16000,
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
                output_config={"effort": "low"},
                system=system,
                messages=[{"role": "user", "content": user}],
            )
        except anthropic.APIStatusError as e:
            raise LLMError(f"anthropic returned {e.status_code}: {e.message}") from e
        except anthropic.APIError as e:
            raise LLMError(f"anthropic request failed: {e}") from e
        if r.stop_reason == "refusal":
            raise LLMError("the model declined this request")
        text = "".join(b.text for b in r.content if b.type == "text")
        _record(self.name, self.model, t0, len(system) + len(user), len(text))
        return text


def make_llm(provider: str, api_key: str, model: str | None = None) -> LLM:
    if provider == "anthropic":
        return AnthropicLLM(api_key, model)
    if provider in OPENAI_COMPAT:
        return OpenAICompatLLM(provider, api_key, model)
    raise ValueError(f"unknown provider {provider!r}")
