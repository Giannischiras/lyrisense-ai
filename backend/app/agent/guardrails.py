"""checks for what goes into the llm and what comes out.

- user text gets cut to a max length and cleaned
- lyrics can have anything in them (even "ignore your instructions"), so i clean them
  and put them in <song> tags, and the prompt says to treat those as data
- the playlist from the llm is checked against the real search results: no fake songs,
  no duplicates, no excluded artists, max 2 songs per artist
"""

from __future__ import annotations

import re
import unicodedata
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
    """cleans lyrics before they go in the prompt (no tags, no newlines, short)"""
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


# someone saying they want to die gets a caring answer and a helpline, not a playlist of
# suicide songs (that's what happened in the eval). plain code so it never depends on the llm.
# only first person phrases, "songs about death" or "a friend who died" don't match
_CRISIS = re.compile(
    r"θελω να πεθανω|θελω να αυτοκτονησω|να αυτοκτονησω|σκεφτομαι να αυτοκτονησω|"
    r"δεν θελω να ζω|δε θελω να ζω|να τελειωσω τη ζωη μου|θα αυτοκτονησω|"
    r"thelo na pethano|thelo na aftoktoniso|"
    r"\bi (really )?(want|wanna) to die\b|\bi wanna die\b|\bkill myself\b|"
    r"\bend my life\b|\bi don'?t want to (live|be alive)\b|\bi'?m suicidal\b|"
    r"\bhurt myself\b|\bself[- ]harm",
    re.IGNORECASE,
)

CRISIS_REPLY_EL = (
    "Λυπάμαι πολύ που νιώθεις έτσι, και χαίρομαι που το είπες. Δεν χρειάζεται να το "
    "περάσεις μόνος/η: μίλα τώρα με κάποιον που εμπιστεύεσαι ή πάρε τη γραμμή 1018 "
    "(Κλίμακα, 24 ώρες, δωρεάν). Αν κινδυνεύεις άμεσα, κάλεσε το 112. Αν θέλεις, μετά "
    "μπορώ να σου βρω τραγούδια για το πώς βγαίνει κανείς από δύσκολες στιγμές."
)
CRISIS_REPLY_EN = (
    "I'm really sorry you're feeling this way, and I'm glad you said it. You don't have to "
    "go through it alone: please talk to someone you trust right now, or reach a crisis "
    "line (findahelpline.com lists free ones in every country; in Greece it's 1018). If "
    "you're in immediate danger, call your local emergency number. If you'd like, I can "
    "find songs about getting through hard times afterwards."
)


def _plain(text: str) -> str:
    """lowercase, no greek accents, so "Θέλω να πεθάνω" and "θελω να πεθανω" match"""
    text = unicodedata.normalize("NFD", text.lower())
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def crisis_reply(text: str) -> str | None:
    if not _CRISIS.search(_plain(text)):
        return None
    greek = re.search(r"[\u0370-\u03ff\u1f00-\u1fff]", text) or "thelo" in _plain(text)
    return CRISIS_REPLY_EL if greek else CRISIS_REPLY_EN
