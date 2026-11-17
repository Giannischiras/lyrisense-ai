"""Checks around the LLM: what goes in and what comes out.

- user text is limited in size and cleaned
- lyrics/snippets are untrusted (anyone can write "ignore your instructions" in a song),
  so they're cleaned and put inside <song> tags that the prompt says are data only
- the playlist the LLM returns is checked against the real search results: no made up
  songs, no duplicates, no excluded artists, not too many songs by one artist
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.agent.schemas import Pick

MAX_USER_CHARS = 500
MAX_PER_ARTIST = 2
_CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")


class GuardrailError(ValueError):
    pass


def clean_user_text(text: str) -> str:
    text = _CONTROL.sub(" ", text).strip()
    if not text:
        raise GuardrailError("empty message")
    if len(text) > MAX_USER_CHARS:
        raise GuardrailError(f"message too long (max {MAX_USER_CHARS} characters)")
    return text


def untrusted(text: str, limit: int = 300) -> str:
    """Make lyric text safe to paste into a prompt: no tags, no newlines, short."""
    text = _CONTROL.sub(" ", text)
    text = text.replace("<", "(").replace(">", ")")
    return re.sub(r"\s+", " ", text).strip()[:limit]


@dataclass
class Checked:
    kept: list[Pick]
    dropped: list[dict]


def check_picks(
    picks: list[Pick],
    candidates: dict[int, tuple[str, str]],  # song_id -> (title, artist)
    exclude_artists: list[str],
    size: int,
) -> Checked:
    excluded = {a.strip().lower() for a in exclude_artists if a.strip()}
    kept: list[Pick] = []
    dropped: list[dict] = []
    seen: set[int] = set()
    per_artist: dict[str, int] = {}
    for p in picks:
        if p.song_id not in candidates:
            dropped.append({"song_id": p.song_id, "why": "not in the search results"})
            continue
        if p.song_id in seen:
            dropped.append({"song_id": p.song_id, "why": "duplicate"})
            continue
        artist = candidates[p.song_id][1].lower()
        if any(x in artist for x in excluded):
            dropped.append({"song_id": p.song_id, "why": "artist the user excluded"})
            continue
        if per_artist.get(artist, 0) >= MAX_PER_ARTIST:
            dropped.append({"song_id": p.song_id, "why": "too many songs by this artist"})
            continue
        if len(kept) >= size:
            dropped.append({"song_id": p.song_id, "why": "playlist already full"})
            continue
        seen.add(p.song_id)
        per_artist[artist] = per_artist.get(artist, 0) + 1
        kept.append(p)
    return Checked(kept, dropped)
