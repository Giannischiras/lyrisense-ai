"""Chunking strategies for lyrics. Compared in evals/chunking (hit@10, MRR).

- song:   one chunk per song (header + opening lines; the encoder truncates at 128 tokens)
- stanza: split on blank lines / [Section] headers, tiny stanzas merged
- window: fixed word windows with overlap
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
    uniq = [c for c in out if not (c in seen or seen.add(c))]  # choruses repeat
    return uniq or song_chunks(lyrics, head)


def window_chunks(lyrics: str, head: str, size: int = 60, overlap: int = 15) -> list[str]:
    words = _clean(lyrics).split()
    if not words:
        return []
    step = size - overlap
    return [" ".join(words[i : i + size]) for i in range(0, max(len(words) - overlap, 1), step)]


STRATEGIES: dict[str, Callable[[str, str], list[str]]] = {
    "song": song_chunks,
    "stanza": stanza_chunks,
    "window": window_chunks,
}
