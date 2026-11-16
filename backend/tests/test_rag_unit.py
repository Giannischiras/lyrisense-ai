from app.rag.chunking import STRATEGIES, header, stanza_chunks
from app.rag.search import Filters, rrf_fuse

LYRICS = """[Verse 1]
I walk alone beneath the falling rain
counting every light that fades away
the city hums a song I used to know

[Chorus]
Stay, stay, don't let the night go
Stay, stay, don't let the night go

[Verse 2]
Your voice is static on the radio
I keep it on so I don't feel alone
the morning comes and still you don't come home

[Chorus]
Stay, stay, don't let the night go
Stay, stay, don't let the night go
"""


def test_header():
    assert header("Song", "Band", "rock", 1999) == "Song by Band (rock, 1999)"
    assert header("Song", "Band", "rock", None) == "Song by Band (rock)"


def test_stanza_chunks_drop_section_tags_and_dedupe_chorus():
    chunks = stanza_chunks(LYRICS, "h")
    assert all("[" not in c for c in chunks)
    assert sum("Stay, stay" in c for c in chunks) == 1
    assert any("radio" in c for c in chunks)


def test_all_strategies_return_nonempty():
    for fn in STRATEGIES.values():
        assert fn(LYRICS, "h")


def test_rrf_prefers_items_ranked_high_in_both_lists():
    scores = rrf_fuse([1, 2, 3], [3, 1, 4])
    assert max(scores, key=scores.get) == 1
    assert scores[3] > scores[2]
    assert scores[4] < scores[2]


def test_filters_sql_parametrised():
    where, args = Filters(language="el", genres=["rap"], decade_from=2000).sql()
    assert "%s" in where and "el" in args and ["rap"] in args
    assert "'" not in where  # values never interpolated into SQL
