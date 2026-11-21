"""loads data/processed/songs.parquet into postgres.

uv run python -m app.ingest [path/to/songs.parquet]
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import pyarrow.parquet as pq

from app.db import connect, init_schema

DEFAULT = Path(__file__).resolve().parents[2] / "data" / "processed" / "songs.parquet"
COLUMNS = [
    "id",
    "title",
    "artist",
    "genre",
    "year",
    "decade",
    "views",
    "features",
    "language",
    "lyrics",
]


_LYRICS_PREFIX = re.compile(r"^.* Lyrics - ")


def clean_artist(artist: str) -> str:
    """~240 rows have the artist as "Burn Lyrics - Phillipa Soo", keep only the artist"""
    return _LYRICS_PREFIX.sub("", artist or "")


def load_songs(path: Path = DEFAULT, batch_size: int = 5000) -> int:
    table = pq.ParquetFile(path)
    n = 0
    with connect() as conn:
        init_schema(conn)
        with conn.cursor() as cur:
            cur.execute("TRUNCATE songs CASCADE")
            with cur.copy(f"COPY songs ({', '.join(COLUMNS)}) FROM STDIN") as copy:
                for batch in table.iter_batches(batch_size=batch_size, columns=COLUMNS):
                    cols = [batch.column(c).to_pylist() for c in COLUMNS]
                    cols[COLUMNS.index("artist")] = [clean_artist(a) for a in cols[2]]
                    for row in zip(*cols, strict=True):
                        copy.write_row(row)
                        n += 1
        conn.commit()
    return n


if __name__ == "__main__":
    p = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
    print(f"loaded {load_songs(p)} songs from {p}")
