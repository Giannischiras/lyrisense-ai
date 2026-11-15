# Wavelength

**Describe your mood, get a playlist and see who's playing live.** Wavelength is a local-first AI music agent. It searches a large song database with hybrid RAG, builds a playlist with an explanation for every track and, once you approve, creates it in your Spotify account. It can also find upcoming concerts by those artists.

> 🚧 Work in progress. The checklist below is updated as each phase lands, with measured numbers.

## What it demonstrates

| Area | Implementation | Status |
|---|---|---|
| Backend | Python, FastAPI, SSE streaming | 🟡 skeleton |
| RAG | pgvector + Postgres full-text hybrid search, RRF fusion, local CPU embeddings + reranker, chunk-size experiments, citations | ⬜ |
| LLM | Provider-swappable: Groq / Gemini (free tiers), Claude, OpenAI — user key held in RAM only | ⬜ |
| Agent | LangGraph, multi-step planning, guardrails, human-in-the-loop approval, step logging | ⬜ |
| MCP | `wavelength-mcp` server exposing the same tools to any MCP client | ⬜ |
| Fine-tuning | QLoRA on a small open model (request → structured filters), base vs fine-tuned vs Claude | ⬜ |
| Self-hosting | vLLM on free Kaggle GPUs, streaming, load test, cost per 1M tokens vs API | ⬜ |
| Evaluation | golden set, retrieval hit@k/MRR, LLM-as-judge calibrated on human labels, prompt-injection suite, runs in CI | ⬜ |
| Ops | Docker Compose (one command), GitHub Actions CI, local Phoenix tracing | 🟡 CI |
| Frontend | React, TypeScript, Framer Motion | ⬜ |

## Local-first, zero-cost, nothing stored

Wavelength runs **entirely on your machine**: the database, the API and the UI. There is no hosted server, so nothing you do passes through anyone else.

- **Your LLM key stays in memory.** Choose a provider (Groq or Gemini on their free tiers, or Claude/OpenAI) and paste your own key into the UI. The local backend holds it in RAM for the session only. It is never written to disk, the database, logs or browser storage, and it is gone when you close the app.
- **Your Spotify login stays in your browser.** You register your own free Spotify app (only the public Client ID is needed) and sign in with OAuth PKCE. The access token lives only in page memory. The agent proposes a playlist, and after you approve, your browser creates it directly through Spotify's API. The backend never sees the token.
- **No accounts, no telemetry, no analytics.** The database holds songs and embeddings only, and tracing runs locally.
- **€0.** Embeddings and reranking run on CPU with small open models. Fine-tuning and vLLM benchmarks were done once on free Kaggle GPUs, and the results are below.
- Secret scanning (gitleaks) runs pre-commit and in CI, and tests assert that keys never appear in responses or logs.

## Run locally

```bash
git clone https://github.com/Giannischiras/wavelength && cd wavelength
cp .env.example .env               # contains no secrets
docker compose -f infra/docker-compose.yml up --build
```

Backend only:

```bash
cd backend && uv sync && uv run uvicorn app.main:app --reload
uv run pytest
```

## Data & licensing

Song lyrics are copyrighted, so they are **not** included in this repository. `data/` contains only download and processing scripts. Run them to build your own local database.
