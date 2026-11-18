"""what the llm should return in each step. pydantic checks it so bad json fails early"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Genre = Literal["pop", "rock", "rap", "rb", "country"]


class PlaylistRequest(BaseModel):
    """step 1: user message -> is it small talk or a music request? if music, the search
    query + filters"""

    intent: Literal["playlist", "chat"] = Field(
        default="playlist",
        description='"playlist" if they want songs, "chat" for anything else',
    )
    reply: str = Field(
        default="",
        max_length=1200,
        description="only for chat: your answer as Lyrisense, in the user's language",
    )
    search_query: str = Field(
        default="", description="mood/theme in a few words, used for the song search"
    )
    language: Literal["en", "el"] | None = None
    genres: list[Genre] = Field(default_factory=list)
    decade_from: int | None = Field(default=None, ge=1900, le=2030)
    decade_to: int | None = Field(default=None, ge=1900, le=2030)
    exclude_artists: list[str] = Field(default_factory=list, max_length=20)
    size: int = Field(default=10, ge=3, le=25)


class Turn(BaseModel):
    """one earlier message of the chat. the browser keeps the history, we don't save it"""

    role: Literal["user", "assistant"]
    content: str = Field(max_length=1500)


class Pick(BaseModel):
    song_id: int
    reason: str = Field(max_length=300)


class CuratedPlaylist(BaseModel):
    """step 2: pick songs from the results and say why"""

    title: str = Field(max_length=80)
    picks: list[Pick] = Field(max_length=40)
