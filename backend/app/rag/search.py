"""hybrid search: postgres full text + pgvector, merged with rrf, then reranked.

each result also has the chunk that matched best and why it was picked
(keyword match, vector match, rerank score).
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field

from pgvector.psycopg import register_vector
from psycopg import Connection

from app.rag.models import embed, rerank
from app.tracing import tracer

RRF_K = 60


@dataclass
class Filters:
    language: str | None = None  # 'en' | 'el'
    genres: list[str] = field(default_factory=list)
    decade_from: int | None = None
    decade_to: int | None = None
    exclude_artists: list[str] = field(default_factory=list)
    artists: list[str] = field(default_factory=list)  # "songs by X"

    def sql(self) -> tuple[str, list]:
        # the dataset has ~380 "Genius English Translations" pages (translated k-pop etc),
        # they're not real songs by that artist so never return them
        where, args = ["s.artist NOT LIKE %s"], ["Genius%"]
        if self.language:
            where.append("s.language = %s")
            args.append(self.language)
        if self.genres:
            where.append("s.genre = ANY(%s)")
            args.append(self.genres)
        # by year, so "2010 to 2015" doesn't bring 2018. decade_to=1990 means the whole 90s
        if self.decade_from is not None:
            where.append("coalesce(s.year, s.decade) >= %s")
            args.append(self.decade_from)
        if self.decade_to is not None:
            end = self.decade_to + 9 if self.decade_to % 10 == 0 else self.decade_to
            where.append("coalesce(s.year, s.decade) <= %s")
            args.append(end)
        if self.artists:
            # whole words, so "Adele" doesn't match "Marie Madeleine". the surname alone
            # also counts ("Παπακωνσταντίνου" -> the model writes Papakonstantinou)
            names = {n for a in self.artists for n in _name_variants(a)}
            where.append("(" + " OR ".join(["s.artist ~* %s"] * len(names)) + ")")
            args.extend(rf"\m{_flex(n)}\M" for n in sorted(names))
        if self.exclude_artists:
            where.append("NOT (lower(s.artist) = ANY(%s))")
            args.append([a.lower() for a in self.exclude_artists])
        return " AND ".join(where), args


def _name_variants(artist: str) -> list[str]:
    artist = artist.strip()
    if not artist:
        return []
    last = artist.split()[-1]
    return [artist, last] if len(last) >= 5 and last != artist else [artist]


def _flex(name: str) -> str:
    """greek surnames come with or without the final s (Vissi/Vissis, Remos/Remo) depending on
    how the model writes them, so the last s is optional"""
    base = name[:-1] if name.lower().endswith("s") and len(name) > 4 else name
    return re.escape(base) + ("s?" if base != name or base[-1:].lower() in "aeiouy" else "")


@dataclass
class Hit:
    song_id: int
    title: str
    artist: str
    genre: str
    year: int | None
    language: str
    snippet: str
    keyword_rank: int | None
    vector_rank: int | None
    rrf: float
    rerank_score: float | None = None

    def why(self) -> str:
        parts = []
        if self.vector_rank is not None:
            parts.append(f"semantic match #{self.vector_rank}")
        if self.keyword_rank is not None:
            parts.append(f"keyword match #{self.keyword_rank}")
        return ", ".join(parts)

    def as_dict(self) -> dict:
        return asdict(self) | {"why": self.why()}


def rrf_fuse(*rankings: list[int], k: int = RRF_K) -> dict[int, float]:
    """rrf (reciprocal rank fusion), lists have the best ids first"""
    scores: dict[int, float] = {}
    for ranking in rankings:
        for rank, sid in enumerate(ranking, start=1):
            scores[sid] = scores.get(sid, 0.0) + 1.0 / (k + rank)
    return scores


def _keyword(conn: Connection, query: str, f: Filters, n: int) -> list[int]:
    with tracer().start_as_current_span("keyword_search") as span:
        ids = _keyword_inner(conn, query, f, n)
        span.set_attribute("results", len(ids))
        return ids


def _keyword_inner(conn: Connection, query: str, f: Filters, n: int) -> list[int]:
    where, args = f.sql()
    rows = conn.execute(
        f"""
        SELECT s.id FROM songs s, websearch_to_tsquery('simple', %s) q
        WHERE s.tsv @@ q AND {where}
        ORDER BY ts_rank_cd(s.tsv, q) DESC, s.views DESC LIMIT %s
        """,
        [query, *args, n],
    ).fetchall()
    return [r[0] for r in rows]


def _vector(
    conn: Connection, query: str, f: Filters, n: int, strategy: str
) -> tuple[list[int], dict[int, str]]:
    where, args = f.sql()
    with tracer().start_as_current_span("embed_query"):
        qv = embed([query])[0]
    with tracer().start_as_current_span("vector_search") as span:
        span.set_attribute("strategy", strategy)
        order, best = _vector_inner(conn, qv, where, args, n, strategy)
        span.set_attribute("results", len(order))
    return order, best


def _vector_inner(conn, qv, where, args, n, strategy) -> tuple[list[int], dict[int, str]]:
    conn.execute("SET LOCAL hnsw.ef_search = 200")
    rows = conn.execute(
        f"""
        SELECT c.song_id, c.text, c.embedding <=> %s AS dist
        FROM chunks c JOIN songs s ON s.id = c.song_id
        WHERE c.strategy = %s AND {where}
        ORDER BY c.embedding <=> %s LIMIT %s
        """,
        [qv, strategy, *args, qv, n * 4],
    ).fetchall()
    order: list[int] = []
    best: dict[int, str] = {}
    for sid, text, _ in rows:  # many chunks can be the same song, keep only the best one
        if sid not in best:
            best[sid] = text
            order.append(sid)
    return order[:n], best


def search(
    conn: Connection,
    query: str,
    filters: Filters | None = None,
    k: int = 10,
    strategy: str | tuple[str, ...] = ("song", "stanza"),
    candidates: int = 50,
    rerank_pool: int = 50,
    use_keyword: bool = True,
    use_vector: bool = True,
    use_rerank: bool = True,
) -> list[Hit]:
    with tracer().start_as_current_span("search") as span:
        span.set_attribute("query", query)  # just the search text, no keys
        span.set_attribute("k", k)
        span.set_attribute("filters", str(asdict(filters or Filters())))
        hits = _search(
            conn,
            query,
            filters,
            k,
            strategy,
            candidates,
            rerank_pool,
            use_keyword,
            use_vector,
            use_rerank,
        )
        span.set_attribute("results", len(hits))
        if hits:
            span.set_attribute("top_result", f"{hits[0].title} - {hits[0].artist}")
        return hits


def _search(
    conn, query, filters, k, strategy, candidates, rerank_pool, use_keyword, use_vector, use_rerank
) -> list[Hit]:
    f = filters or Filters()
    register_vector(conn)
    kw = _keyword(conn, query, f, candidates) if use_keyword else []
    strategies = (strategy,) if isinstance(strategy, str) else strategy
    vec_lists, snippets = [], {}
    if use_vector:
        for strat in strategies:
            ranked, snips = _vector(conn, query, f, candidates, strat)
            vec_lists.append(ranked)
            for sid, text in snips.items():
                snippets.setdefault(sid, text)
    fused = rrf_fuse(*(r for r in (kw, *vec_lists) if r))
    vec = sorted(
        {sid for r in vec_lists for sid in r},
        key=lambda sid: min(r.index(sid) if sid in r else 10**6 for r in vec_lists),
    )
    top = sorted(fused, key=fused.get, reverse=True)[: max(candidates, k)]
    if not top:
        return []

    meta = {
        r[0]: r[1:]
        for r in conn.execute(
            """SELECT id, title, artist, genre, year, language, left(lyrics, 400)
               FROM songs WHERE id = ANY(%s)""",
            [top],
        ).fetchall()
    }
    kw_rank = {sid: i for i, sid in enumerate(kw, 1)}
    vec_rank = {sid: i for i, sid in enumerate(vec, 1)}
    hits = [
        Hit(
            song_id=sid,
            title=meta[sid][0],
            artist=meta[sid][1],
            genre=meta[sid][2],
            year=meta[sid][3],
            language=meta[sid][4],
            snippet=snippets.get(sid) or meta[sid][5],
            keyword_rank=kw_rank.get(sid),
            vector_rank=vec_rank.get(sid),
            rrf=fused[sid],
        )
        for sid in top
    ]
    if use_rerank:
        pool = hits[:rerank_pool]
        docs = [f"{h.title} by {h.artist} ({h.genre}, {h.year}): {h.snippet}" for h in pool]
        with tracer().start_as_current_span("rerank") as span:
            span.set_attribute("candidates", len(docs))
            scores = rerank(query, docs)
        for h, s in zip(pool, scores, strict=True):
            h.rerank_score = s
        hits = sorted(pool, key=lambda h: h.rerank_score or 0, reverse=True) + hits[rerank_pool:]
    return hits[:k]
