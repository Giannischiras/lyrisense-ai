# Wavelength

You tell it how you feel, it makes you a playlist and shows you if any of those artists are playing live soon.

It's an AI music agent that runs on your own computer. It searches a big song database (hybrid RAG), picks songs and says why it picked each one, and if you approve, it creates the playlist in your Spotify. It can also look up upcoming concerts for the artists.

> Still working on it. I update the list below as I finish each part, with the numbers I actually measured.

## What's in it

| Part | What I used | Status |
|---|---|---|
| Backend | Python, FastAPI, SSE streaming | started |
| RAG | pgvector + Postgres full text search, RRF to merge them, embeddings and reranker on CPU, comparing chunk sizes, shows where each match came from | in progress |
| LLM | you pick the provider: Groq / Gemini (free), Claude or OpenAI. your key only stays in RAM | not yet |
| Agent | LangGraph, plans in steps, guardrails, asks you before doing anything, logs each step | not yet |
| MCP | `wavelength-mcp` server so other MCP clients can use the same tools | not yet |
| Fine-tuning | QLoRA on a small open model (turn a request into filters), base vs fine-tuned vs Claude | not yet |
| Self-hosting | vLLM on free Kaggle GPUs, streaming, load test, cost per 1M tokens compared to an API | not yet |
| Evals | test set, hit@k / MRR for retrieval, LLM-as-judge checked against my own labels, prompt injection tests, all in CI | not yet |
| Ops | Docker Compose, GitHub Actions CI, Phoenix tracing locally | CI done |
| Frontend | React, TypeScript, Framer Motion | not yet |

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
