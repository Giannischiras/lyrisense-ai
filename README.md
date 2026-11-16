# Wavelength

You tell it how you feel, it makes you a playlist and shows you if any of those artists are playing live soon.

It's an AI music agent that runs on your own computer. It searches a big song database (hybrid RAG), picks songs and says why it picked each one, and if you approve, it creates the playlist in your Spotify. It can also look up upcoming concerts for the artists.

> Still working on it. I update the list below as I finish each part, with the numbers I actually measured.

## What's in it

| Part | What I used | Status |
|---|---|---|
| Backend | Python, FastAPI, SSE streaming | started |
| RAG | pgvector + Postgres full text search, RRF to merge them, embeddings and reranker on CPU, whole song vs stanza chunks, shows where each match came from | done (numbers below) |
| LLM | you pick the provider: Groq / Gemini (free), Claude or OpenAI. your key only stays in RAM | not yet |
| Agent | LangGraph, plans in steps, guardrails, asks you before doing anything, logs each step | not yet |
| MCP | `wavelength-mcp` server so other MCP clients can use the same tools | not yet |
| Fine-tuning | QLoRA on a small open model (turn a request into filters), base vs fine-tuned vs Claude | not yet |
| Self-hosting | vLLM on free Kaggle GPUs, streaming, load test, cost per 1M tokens compared to an API | not yet |
| Evals | test set, hit@k / MRR for retrieval, LLM-as-judge checked against my own labels, prompt injection tests, all in CI | retrieval done |
| Ops | Docker Compose, GitHub Actions CI, Phoenix tracing locally | CI done |
| Frontend | React, TypeScript, Framer Motion | not yet |

## How good is the search?

I wrote 58 test queries (`evals/datasets/golden.jsonl`, 49 English and 9 Greek). For each one I picked a song from the database and described its mood or story the way a user would, without using words from the title. Then I check where that song shows up in the top 10.

`cd backend && uv run python ../evals/run_retrieval.py`

| Setup | hit@1 | hit@10 | MRR |
|---|---|---|---|
| keyword only | 0.02 | 0.02 | 0.02 |
| vector only (whole song) | 0.07 | 0.24 | 0.12 |
| vector only (stanzas) | 0.07 | 0.14 | 0.09 |
| hybrid + rerank (whole song) | 0.34 | 0.38 | 0.36 |
| hybrid + rerank (stanzas) | 0.24 | 0.33 | 0.28 |
| hybrid + rerank (song + stanzas), the default | 0.38 | 0.45 | 0.40 |

What I learned:

- The reranker makes the biggest difference. Without it the right song is rarely first.
- Keyword search is almost useless for mood queries, since people don't use the same words as the lyrics. At first it actually made things worse: when the full phrase didn't match, it fell back to matching any word, which pulled in random popular songs with words like "night". I removed that fallback and kept keyword search only for exact matches like titles and artists.
- Searching song chunks and stanza chunks together and letting the reranker pick gave the best result (MRR 0.27 → 0.40 after these changes).
- I also tried 60 word windows with overlap, but they made about 500k chunks, which took hours to embed on my laptop CPU, so I dropped them.
- Greek queries score higher (MRR 0.78) but there are only 9 of them and fewer Greek songs to choose from, so I don't trust that number much yet.
- Speed was the problem. I timed each step and the reranker was 97% of the search time (the vector and keyword parts take under 0.1s). Giving it fewer candidates made it faster but worse, so instead I tried other reranker models:

| Reranker (50 candidates) | MRR | time per search |
|---|---|---|
| bge-reranker-v2-m3 (int8) | 0.40 | 5.4s |
| jina-reranker-v2-base-multilingual | 0.41 | 2.6s |
| ms-marco-MiniLM-L-12 (english only) | 0.28 | 2.6s |

  I switched to the jina one: same quality, half the time, and it still understands Greek. Cutting the text it reads to 300 chars gets it to 1.4s but MRR drops to 0.37, so I kept the full text. All the runs are in `evals/results/reranker.json`.

The full numbers are in `evals/results/retrieval.json`. The metric code has unit tests in CI. The eval itself needs the local database, so it doesn't run in CI.

## Runs locally, free, stores nothing

The database, the API and the UI all run on your machine. There's no server of mine in the middle.

- Your LLM key: you pick a provider and paste your own key in the UI. The backend keeps it in RAM for that session and that's it. It doesn't get saved to disk, the database, the logs or the browser, and it's gone when you close the app.
- Your Spotify login: you make your own free Spotify app (you only need the public Client ID) and log in with OAuth PKCE. The token stays in the page memory. The agent suggests a playlist, you approve it, and your browser creates it through the Spotify API. The backend never gets the token.
- No accounts, no analytics. The database only has songs and embeddings, and tracing runs locally.
- It costs €0. Embeddings and reranking run on CPU with small open models. I ran the fine-tuning and the vLLM tests once on free Kaggle GPUs and put the results below.
- gitleaks checks for secrets before every commit and in CI, and there are tests that make sure keys never show up in responses or logs.

## How to run it

```bash
git clone https://github.com/Giannischiras/wavelength-songfind-ai && cd wavelength-songfind-ai
cp .env.example .env               # contains no secrets
docker compose -f infra/docker-compose.yml up --build
```

Only the backend:

```bash
cd backend && uv sync && uv run uvicorn app.main:app --reload
uv run pytest
```

## Data

Song lyrics are copyrighted so I didn't put them in the repo. `data/` only has the scripts that download and clean them, so you can build the database yourself.
