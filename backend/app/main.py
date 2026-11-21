import json
from typing import Literal

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from app.agent.graph import replace_song, run_agent, stream_agent
from app.agent.guardrails import MAX_USER_CHARS, GuardrailError
from app.agent.llm import PROVIDERS, LLMError, make_llm
from app.agent.schemas import PlaylistRequest, Turn
from app.config import get_settings
from app.log import log, setup_logging
from app.rag.search import Filters, search
from app.secrets import vault
from app.tracing import setup_tracing

settings = get_settings()

setup_logging()
setup_tracing()
app = FastAPI(title="Lyrisense API", version="0.1.0")


@app.exception_handler(RequestValidationError)
async def bad_request(_: Request, exc: RequestValidationError) -> JSONResponse:
    # pydantic's default 422 is a list of dicts that also echoes the whole input back.
    # the ui shows `detail` as text, so send one short sentence instead
    errors = exc.errors()
    on_message = [e for e in errors if e.get("loc", [""])[-1] == "message"]
    first = (on_message or errors or [{}])[0]
    field = first.get("loc", ["", ""])[-1]
    if field == "message" and first.get("type") == "string_too_long":
        msg = f"message too long (max {MAX_USER_CHARS} characters)"
    elif field == "message":
        msg = "the message is empty"
    else:
        msg = f"bad request: {field} {first.get('msg', '')}".strip()
    return JSONResponse(status_code=422, content={"detail": msg})


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
    # earlier messages, kept by the browser only. we use them for context and forget them
    history: list[Turn] = Field(default_factory=list, max_length=20)


def _search(query: str, filters: Filters, k: int):
    from app.db import connect

    with connect() as conn:
        return search(conn, query, filters, k=k)


class SongRef(BaseModel):
    song_id: int
    artist: str = Field(max_length=200)


class ReplaceIn(BaseModel):
    provider: Literal["groq", "gemini", "anthropic", "openai"]
    model: str | None = Field(default=None, max_length=80)
    message: str = Field(min_length=1, max_length=MAX_USER_CHARS)
    request: PlaylistRequest
    current: list[SongRef] = Field(max_length=40)
    drop_id: int


def _llm_for(body: PlaylistIn | ReplaceIn, sid: str):
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
            for ev in stream_agent(llm, _search, body.message, body.history):
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
        return run_agent(llm, _search, body.message, body.history)
    except GuardrailError as e:
        raise HTTPException(422, str(e)) from e
    except LLMError as e:
        raise HTTPException(502, f"the language model failed: {e}") from e


@app.post("/agent/replace")
def replace(body: ReplaceIn, x_session_id: str = Header()) -> dict:
    """swap one song the user didn't like for the next best match"""
    llm = _llm_for(body, x_session_id)
    try:
        song = replace_song(
            llm,
            _search,
            body.request,
            body.message,
            [(c.song_id, c.artist) for c in body.current],
            body.drop_id,
        )
    except LLMError as e:
        raise HTTPException(502, f"the language model failed: {e}") from e
    return {"song": song}
