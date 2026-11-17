-- only songs and embeddings here. no users, keys or tokens
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
    -- for the keyword search. 'simple' works for both english and greek
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

-- for the vector search. one row per chunk, `strategy` is song or stanza
-- so i can compare the two on the same songs
CREATE TABLE IF NOT EXISTS chunks (
    id        BIGSERIAL PRIMARY KEY,
    song_id   BIGINT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    strategy  TEXT NOT NULL,
    idx       INT NOT NULL,
    text      TEXT NOT NULL,
    embedding VECTOR(384) NOT NULL
);

CREATE INDEX IF NOT EXISTS chunks_song_idx ON chunks (song_id);
CREATE INDEX IF NOT EXISTS chunks_hnsw_song   ON chunks USING hnsw (embedding vector_cosine_ops) WHERE strategy = 'song';
CREATE INDEX IF NOT EXISTS chunks_hnsw_stanza ON chunks USING hnsw (embedding vector_cosine_ops) WHERE strategy = 'stanza';
