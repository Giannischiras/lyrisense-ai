"""how we split lyrics into chunks. i compared them in the evals (hit@10, mrr).

- song: one chunk per song (title + first lines, the model cuts at 128 tokens anyway)
- stanza: split on empty lines or [Chorus] style headers, small ones get merged
"""

from __future__ import annotations

import re
from collections.abc import Callable

SECTION = re.compile(r"^\s*\[[^\]]*\]\s*$", re.M)
WORD_LIMIT_SONG = 90


def _clean(text: str) -> str:
    text = SECTION.sub("\n", text)
    return re.sub(r"[ \t]+", " ", text).strip()


def header(title: str, artist: str, genre: str, year: int | None) -> str:
    return f"{title} by {artist} ({genre}{f', {year}' if year else ''})"


def song_chunks(lyrics: str, head: str) -> list[str]:
    words = _clean(lyrics).split()
    return [f"{head}: {' '.join(words[:WORD_LIMIT_SONG])}"]


def stanza_chunks(lyrics: str, head: str, min_words: int = 12, max_words: int = 90) -> list[str]:
    raw = [s.strip() for s in re.split(r"\n\s*\n|^\s*\[[^\]]*\]\s*$", lyrics, flags=re.M)]
    stanzas = [re.sub(r"\s+", " ", s) for s in raw if s and s.strip()]
    out: list[str] = []
    buf = ""
    for s in stanzas:
        buf = f"{buf} / {s}" if buf else s
        if len(buf.split()) >= min_words:
            out.append(" ".join(buf.split()[:max_words]))
            buf = ""
    if buf:
        if out and len(buf.split()) < min_words:
            out[-1] = " ".join(f"{out[-1]} / {buf}".split()[:max_words])
        else:
            out.append(buf)
    seen: set[str] = set()
    uniq = [c for c in out if not (c in seen or seen.add(c))]  # choruses repeat a lot
    return uniq or song_chunks(lyrics, head)


STRATEGIES: dict[str, Callable[[str, str], list[str]]] = {
    "song": song_chunks,
    "stanza": stanza_chunks,
}
