from typing import Literal

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.config import get_settings
from app.secrets import vault

settings = get_settings()

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
