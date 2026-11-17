"""downloads the public genius lyrics dataset and makes our song list from it.

lyrics have copyright so they are not in the repo. this downloads the raw data to
data/raw/ (gitignored), keeps the most popular english and greek songs, cleans them
and saves data/processed/songs.parquet.

how to run:
    uv run --with duckdb python data/build_dataset.py [--en 50000] [--el 10000]
"""

from __future__ import annotations

import argparse
import os
import time
import urllib.request
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
OUT = ROOT / "processed" / "songs.parquet"

DATASET = "sebastiandizon/genius-song-lyrics"
BASE_URL = (
    f"https://huggingface.co/datasets/{DATASET}/resolve/refs%2Fconvert%2Fparquet/default/partial-train"
)
N_FILES = 10

# genius tags. "misc" has poems, books etc so we skip it
GENRES = ("pop", "rap", "rock", "rb", "country")


def download(n_files: int = N_FILES) -> list[Path]:
    RAW.mkdir(parents=True, exist_ok=True)
    token = os.environ.get("HF_TOKEN")  # optional, you get a higher rate limit with it
    paths = []
    for i in range(n_files):
        path = RAW / f"{i:04d}.parquet"
        paths.append(path)
        if path.exists() and path.stat().st_size > 0:
            continue
        req = urllib.request.Request(f"{BASE_URL}/{i:04d}.parquet")
        if token:
            req.add_header("Authorization", f"Bearer {token}")
        for attempt in range(6):
            try:
                print(f"downloading {path.name} ...", flush=True)
                tmp = path.with_suffix(".part")
                with urllib.request.urlopen(req, timeout=120) as r, open(tmp, "wb") as f:  # noqa: S310
                    while chunk := r.read(1 << 20):
                        f.write(chunk)
                tmp.rename(path)
                break
            except Exception as e:  # noqa: BLE001
                wait = 60 * (attempt + 1)
                print(f"  {e}; retrying in {wait}s", flush=True)
                time.sleep(wait)
        else:
            raise SystemExit(f"could not download {path.name}")
    return paths


BUILD_SQL = """
WITH base AS (
    SELECT
        id,
        trim(title)                       AS title,
        trim(artist)                      AS artist,
        tag                               AS genre,
        year::INT                         AS year,
        views::BIGINT                     AS views,
        features,
        language,
        -- fix whitespace and remove the extra genius lines
        regexp_replace(
            regexp_replace(lyrics, '(?m)^\\s*\\d*\\s*Contributors?.*$', ''),
            '\\n{3,}', chr(10) || chr(10), 'g'
        )                                 AS lyrics
    FROM read_parquet($files)
    WHERE language IN ('en', 'el')
      AND tag IN __GENRES__
      AND year BETWEEN 1950 AND 2024
      AND length(lyrics) BETWEEN 300 AND 8000
      AND title IS NOT NULL AND artist IS NOT NULL
),
dedup AS (
    SELECT *, row_number() OVER (
        PARTITION BY lower(title), lower(artist) ORDER BY views DESC
    ) AS rn
    FROM base
),
ranked AS (
    SELECT *, row_number() OVER (PARTITION BY language ORDER BY views DESC) AS lang_rank
    FROM dedup WHERE rn = 1
)
SELECT id, title, artist, genre, year, (year // 10) * 10 AS decade, views, features,
       language, lyrics
FROM ranked
WHERE (language = 'en' AND lang_rank <= $n_en)
   OR (language = 'el' AND lang_rank <= $n_el)
ORDER BY views DESC
"""


def build(n_en: int, n_el: int) -> None:
    files = [str(p) for p in download()]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    sql = BUILD_SQL.replace("__GENRES__", str(GENRES))
    con.execute(f"CREATE TABLE songs AS {sql}", {"files": files, "n_en": n_en, "n_el": n_el})
    con.execute(f"COPY songs TO '{OUT}' (FORMAT parquet, COMPRESSION zstd)")
    stats = con.execute(
        "SELECT language, genre, count(*) n, min(year), max(year) FROM songs "
        "GROUP BY ALL ORDER BY language, n DESC"
    ).fetchall()
    total = sum(r[2] for r in stats)
    print(f"\nwrote {OUT.relative_to(ROOT.parent)}: {total} songs")
    for lang, genre, n, y0, y1 in stats:
        print(f"  {lang} {genre:<8} {n:>7}  ({y0}-{y1})")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--en", type=int, default=int(os.environ.get("WAVELENGTH_SONGS_EN", 50000)))
    ap.add_argument("--el", type=int, default=int(os.environ.get("WAVELENGTH_SONGS_EL", 10000)))
    a = ap.parse_args()
    build(a.en, a.el)
