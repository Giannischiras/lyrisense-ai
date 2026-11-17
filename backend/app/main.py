from typing import Literal

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.agent.graph import run_agent
from app.agent.guardrails import MAX_USER_CHARS, GuardrailError
from app.agent.llm import PROVIDERS, LLMError, make_llm
from app.config import get_settings
from app.rag.search import Filters, search
from app.secrets import vault
from app.tracing import setup_tracing

settings = get_settings()

setup_tracing()
app = FastAPI(title="Wavelength API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "X-Session-Id"],
)

KeyName = Literal["groq", "gemini", "anthropic", "openai", "ticketmaster"]


class KeyIn(BaseModel):
    name: KeyName
    value: str = Field(min_length=8, max_length=512)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/session")
def create_session() -> dict:
    return {"session_id": vault.create_session()}


@app.post("/session/keys", status_code=204)
def set_key(body: KeyIn, x_session_id: str = Header()) -> None:
    try:
        vault.set_key(x_session_id, body.name, body.value)
    except KeyError as e:
        raise HTTPException(401, "unknown or expired session") from e


@app.get("/session/keys")
def list_keys(x_session_id: str = Header()) -> dict:
    """Returns only WHICH providers are configured, never the values."""
    try:
        return {"configured": vault.configured(x_session_id)}
    except KeyError as e:
        raise HTTPException(401, "unknown or expired session") from e


@app.delete("/session", status_code=204)
def end_session(x_session_id: str = Header()) -> None:
    vault.end_session(x_session_id)


class PlaylistIn(BaseModel):
    message: str = Field(min_length=1, max_length=MAX_USER_CHARS)
    provider: Literal["groq", "gemini", "anthropic", "openai"]
    model: str | None = Field(default=None, max_length=80)


def _search(query: str, filters: Filters, k: int):
    from app.db import connect

    with connect() as conn:
        return search(conn, query, filters, k=k)


@app.post("/agent/playlist")
def make_playlist(body: PlaylistIn, x_session_id: str = Header()) -> dict:
    """Builds a playlist proposal. Nothing is created in Spotify here: the browser
    does that after the user approves."""
    assert body.provider in PROVIDERS
    try:
        key = vault.get_key(x_session_id, body.provider)
    except KeyError as e:
        raise HTTPException(401, "unknown or expired session") from e
    if not key:
        raise HTTPException(400, f"no {body.provider} key in this session")
    try:
        return run_agent(make_llm(body.provider, key, body.model), _search, body.message)
    except GuardrailError as e:
        raise HTTPException(422, str(e)) from e
    except LLMError as e:
        raise HTTPException(502, f"the language model failed: {e}") from e
