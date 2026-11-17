"""What the LLM has to return at each step. Pydantic checks it, so bad JSON gets caught."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Genre = Literal["pop", "rock", "rap", "rb", "country"]


class PlaylistRequest(BaseModel):
    """Step 1: turn the user's message into search terms and filters."""

    search_query: str = Field(description="mood/theme in a few words, used for the song search")
    language: Literal["en", "el"] | None = None
    genres: list[Genre] = Field(default_factory=list)
    decade_from: int | None = Field(default=None, ge=1900, le=2030)
    decade_to: int | None = Field(default=None, ge=1900, le=2030)
    exclude_artists: list[str] = Field(default_factory=list, max_length=20)
    size: int = Field(default=10, ge=3, le=25)


class Pick(BaseModel):
    song_id: int
    reason: str = Field(max_length=300)


class CuratedPlaylist(BaseModel):
    """Step 2: pick songs from the candidates and say why."""

    title: str = Field(max_length=80)
    picks: list[Pick] = Field(max_length=40)
