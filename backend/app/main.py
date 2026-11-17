import json
from typing import Literal

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.agent.graph import run_agent, stream_agent
from app.agent.guardrails import MAX_USER_CHARS, GuardrailError
from app.agent.llm import PROVIDERS, LLMError, make_llm
from app.config import get_settings
from app.log import log, setup_logging
from app.rag.search import Filters, search
from app.secrets import vault
from app.tracing import setup_tracing

settings = get_settings()

setup_logging()
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
    """only says which providers have a key, not the keys"""
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


def _llm_for(body: PlaylistIn, sid: str):
    assert body.provider in PROVIDERS
    try:
        key = vault.get_key(sid, body.provider)
    except KeyError as e:
        raise HTTPException(401, "unknown or expired session") from e
    if not key:
        raise HTTPException(400, f"no {body.provider} key in this session")
    return make_llm(body.provider, key, body.model)


@app.post("/agent/playlist/stream")
def stream_playlist(body: PlaylistIn, x_session_id: str = Header()) -> StreamingResponse:
    """sse stream: a `step` event for each step and a `result` at the end"""
    llm = _llm_for(body, x_session_id)

    def events():
        try:
            for ev in stream_agent(llm, _search, body.message):
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
        except GuardrailError as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        except LLMError as e:
            log.warning("agent failed: %s", e)
            msg = f"the language model failed: {e}"
            yield f"data: {json.dumps({'type': 'error', 'message': msg})}\n\n"
        except Exception:
            log.exception("agent crashed")
            msg = "something went wrong in the agent, check the backend log"
            yield f"data: {json.dumps({'type': 'error', 'message': msg})}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")


@app.post("/agent/playlist")
def make_playlist(body: PlaylistIn, x_session_id: str = Header()) -> dict:
    """makes the playlist. doesn't touch spotify, the browser will do that later
    if the user says ok"""
    llm = _llm_for(body, x_session_id)
    try:
        return run_agent(llm, _search, body.message)
    except GuardrailError as e:
        raise HTTPException(422, str(e)) from e
    except LLMError as e:
        raise HTTPException(502, f"the language model failed: {e}") from e
