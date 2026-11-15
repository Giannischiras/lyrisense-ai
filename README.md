# Wavelength

**Describe your mood, get a playlist and see who's playing live.** Wavelength is an AI music agent. It searches a large song database with hybrid RAG, builds a playlist with an explanation for every track and, once you approve, creates it in your Spotify account. It can also find concerts by those artists and add them to your Google Calendar.

> 🚧 Work in progress. The checklist below is updated as each phase lands, with measured numbers.

## What it demonstrates

| Area | Implementation | Status |
|---|---|---|
| Backend | Python, FastAPI, SSE streaming | 🟡 skeleton |
| RAG | pgvector + Postgres full-text hybrid search, RRF fusion, reranker, chunk-size experiments, citations | ⬜ |
| LLM | Claude API (provider-swappable to OpenAI) | ⬜ |
| Agent | LangGraph, multi-step planning, guardrails, human-in-the-loop approval, step logging | ⬜ |
| MCP | `wavelength-mcp` server exposing the same tools to any MCP client | ⬜ |
| Fine-tuning | QLoRA on a small open model (request → structured filters), base vs fine-tuned vs Claude | ⬜ |
| Self-hosting | vLLM on Modal GPUs, streaming, load test, cost per 1M tokens vs API | ⬜ |
| Evaluation | golden set, retrieval hit@k/MRR, LLM-as-judge calibrated on human labels, prompt-injection suite, runs in CI | ⬜ |
| Ops | Docker, GitHub Actions CI/CD, Azure Container Apps, Langfuse tracing | 🟡 CI |
| Frontend | React, TypeScript, Framer Motion | ⬜ |

## Security model

- **No secrets in the database, ever.** Postgres holds songs, embeddings, eval results and anonymous logs only.
- **Server keys** (Claude, Voyage, Spotify app) live only in environment secrets. They are never sent to the browser or committed: `.env` is git-ignored, and gitleaks runs both pre-commit and in CI.
- **User logins stay in the user's browser.** Spotify and Google sign-in use OAuth PKCE in the frontend, and the access token lives only in page memory. The agent proposes actions, and after the user approves, the browser executes them directly against Spotify or Google. The server never sees a user token.
- **No user accounts**, rate limiting per IP, and a provider-side spend cap.

## Run locally

```bash
cp .env.example .env               # fill in your own keys
docker compose -f infra/docker-compose.yml up --build
curl localhost:8000/health
```

Backend only:

```bash
cd backend && uv sync && uv run uvicorn app.main:app --reload
uv run pytest
```

## Data & licensing

Song lyrics are copyrighted, so they are **not** included in this repository. `data/` contains only download and processing scripts. Run them to build your own local database.
