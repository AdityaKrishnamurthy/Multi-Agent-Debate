# Multi-Agent-Debate

Multi-Agent Debate for Evidence-Based Reasoning and Collective Decision Making.

AI agents with different personalities argue a question using cited evidence, and the group reaches a single decision with a calibrated confidence score.

## Quick Start

### Prerequisites

- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **uv** (Python package manager) — `pip install uv` or see [docs](https://docs.astral.sh/uv/getting-started/installation/)
- **Docker Desktop** (for Phase 2+) — [docker.com](https://www.docker.com/products/docker-desktop)
- **Groq API key** (free) — [console.groq.com](https://console.groq.com)

### Setup

```bash
# 1. Clone
git clone https://github.com/<your-org>/Multi-Agent-Debate.git
cd Multi-Agent-Debate

# 2. Environment variables
cp .env.example .env
# Edit .env and add your GROQ_API_KEY

# 3. Frontend
cd frontend
npm install
npm run dev          # → http://localhost:3000

# 4. Backend
cd ../backend
uv sync
uv run pytest        # run tests
uv run python -m app.cli "Should we adopt a 4-day work week?" --rounds 2 --agents 2
```

### Running a Live Debate (Phase 2+)

```bash
# Start the database
docker compose up -d db

# Start the API server
cd backend
uv run uvicorn app.main:app --reload

# Start the frontend (in another terminal)
cd frontend
npm run dev
```

## Project Structure

```
Multi-Agent-Debate/
├─ backend/              FastAPI app, debate engine, agents, retrieval
│  ├─ app/               Application code
│  ├─ tests/             Backend tests
│  └─ runs/              CLI outputs (git-ignored)
├─ frontend/             Next.js app
│  ├─ lib/types.ts       Shared TypeScript schema
│  └─ mock/              Sample debates (committed)
├─ ml/                   Dataset scripts, verifier training, notebooks
├─ eval/                 Benchmark runners, baselines, results
├─ plans/                Numbered implementation plans
└─ resources/            Papers (git-excluded)
```

## Plans

See [`plans/PLANS.md`](plans/PLANS.md) for the full list and status.

## Conventions

- **Branches:** `feat/<area>-<short>`, `fix/...`, `chore/...`
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`)
- **Secrets:** never committed; all in `.env`
- **Prompts:** versioned in `backend/app/agents/prompts/*.md`
- **Model IDs:** only in `backend/app/config/models.yaml`
