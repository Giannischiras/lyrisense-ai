"""Chunk + embed songs into the `chunks` table.

uv run python -m app.rag.index --strategy stanza [--limit 5000]
"""

from __future__ import annotations

import argparse
import time

from pgvector.psycopg import register_vector

from app.db import connect, init_schema
from app.rag.chunking import STRATEGIES, header
from app.rag.models import embed


def build_index(strategy: str, limit: int | None = None, batch: int = 512) -> int:
    chunker = STRATEGIES[strategy]
    total = 0
    t0 = time.time()
    with connect() as conn:
        init_schema(conn)
        register_vector(conn)
        conn.execute("DELETE FROM chunks WHERE strategy = %s", (strategy,))
        q = "SELECT id, title, artist, genre, year, lyrics FROM songs ORDER BY views DESC"
        rows = conn.execute(
            q + (" LIMIT %s" if limit else ""), (limit,) if limit else ()
        ).fetchall()

        pending: list[tuple[int, int, str]] = []

        def flush() -> None:
            nonlocal total
            if not pending:
                return
            vecs = embed([t for _, _, t in pending])
            with (
                conn.cursor() as cur,
                cur.copy(
                    "COPY chunks (song_id, strategy, idx, text, embedding) "
                    "FROM STDIN WITH (FORMAT BINARY)"
                ) as copy,
            ):
                copy.set_types(["int8", "text", "int4", "text", "vector"])
                for (sid, i, text), v in zip(pending, vecs, strict=True):
                    copy.write_row((sid, strategy, i, text, v))
            total += len(pending)
            pending.clear()
            print(f"\r{strategy}: {total} chunks, {total / (time.time() - t0):.0f}/s", end="")

        for sid, title, artist, genre, year, lyrics in rows:
            for i, text in enumerate(chunker(lyrics, header(title, artist, genre, year))):
                pending.append((sid, i, text))
            if len(pending) >= batch:
                flush()
        flush()
        conn.commit()
    print()
    return total


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--strategy", choices=list(STRATEGIES), default="stanza")
    ap.add_argument("--limit", type=int, default=None)
    a = ap.parse_args()
    build_index(a.strategy, a.limit)
