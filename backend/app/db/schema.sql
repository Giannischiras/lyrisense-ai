-- Wavelength schema. Holds songs and embeddings only: no users, no keys, no tokens.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS songs (
    id        BIGINT PRIMARY KEY,
    title     TEXT NOT NULL,
    artist    TEXT NOT NULL,
    genre     TEXT NOT NULL,
    year      INT,
    decade    INT,
    views     BIGINT,
    features  TEXT,
    language  TEXT NOT NULL,
    lyrics    TEXT NOT NULL,
    -- keyword side of hybrid search; 'simple' config works for English and Greek
    tsv       TSVECTOR GENERATED ALWAYS AS (
                  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
                  setweight(to_tsvector('simple', coalesce(artist, '')), 'A') ||
                  setweight(to_tsvector('simple', coalesce(genre, '')), 'B') ||
                  setweight(to_tsvector('simple', coalesce(lyrics, '')), 'C')
              ) STORED
);

CREATE INDEX IF NOT EXISTS songs_tsv_idx      ON songs USING GIN (tsv);
CREATE INDEX IF NOT EXISTS songs_filters_idx  ON songs (language, genre, decade);
CREATE INDEX IF NOT EXISTS songs_artist_trgm  ON songs USING GIN (artist gin_trgm_ops);
CREATE INDEX IF NOT EXISTS songs_title_trgm   ON songs USING GIN (title gin_trgm_ops);
