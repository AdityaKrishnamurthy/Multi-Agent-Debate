<div align="center">

# Multi-Agent Debate

**Evidence-based reasoning and collective decision making with personality-shaped AI agents.**

AI agents with different Big Five personalities argue a question over several rounds. A Critic audits every claim, and the group reaches one verdict with a confidence score you can trace back to the arguments.

[![CI](https://github.com/AdityaKrishnamurthy/Multi-Agent-Debate/actions/workflows/ci.yml/badge.svg)](https://github.com/AdityaKrishnamurthy/Multi-Agent-Debate/actions/workflows/ci.yml)
![Python](https://img.shields.io/badge/Python-3.11+-1f4fd1)
![Next.js](https://img.shields.io/badge/Next.js-16-16181d)
![FastAPI](https://img.shields.io/badge/FastAPI-SSE-c2410c)

</div>

![A debate replay: Pro and Con arguments face each other, with the verdict and sources in the side panel](docs/images/debate.png)

## What it does

| | |
|---|---|
| **Debate, not just agreement** | Pro and Con advocates take opposing sides and attack each other's weakest points across an opening round and rebuttals. |
| **A Critic that pushes back** | A skeptical Critic scores every argument from 0 to 5 and flags unsupported claims and fallacies. Weak arguments must be revised. |
| **One verdict you can audit** | A judge rules on the full transcript. The verdict shows its confidence, the vote split, why it won and what is still disputed. |
| **Watch it live** | Arguments stream into the browser round by round as the agents write them. |

The project builds on **MAPS** ([arXiv:2503.16905](https://arxiv.org/abs/2503.16905)), which shapes agents with Big Five personality traits in a cooperative pipeline. Multi-Agent Debate adds adversarial debate, evidence citations, a Critic revision loop and a calibrated collective verdict.

<p align="center"><img src="docs/images/home.png" alt="Home page with the question box and sample debates" width="80%"></p>

## Quick start

### Prerequisites

| Tool | Used for | Get it |
|---|---|---|
| Node.js 20+ | frontend | [nodejs.org](https://nodejs.org) |
| uv | backend (Python 3.11 is downloaded automatically) | [docs.astral.sh/uv](https://docs.astral.sh/uv/getting-started/installation/) |
| Docker Desktop | Postgres + pgvector | [docker.com](https://www.docker.com/products/docker-desktop) |
| Groq API key (free) | the default debate models (required) | [console.groq.com](https://console.groq.com) |
| More free keys (optional) | extra models and rate-limit fallback | [NVIDIA NIM](https://build.nvidia.com), [TokenHarbor](https://tokenharbor.ai), [Mistral](https://console.mistral.ai) |

### 1. Configure

```bash
git clone https://github.com/AdityaKrishnamurthy/Multi-Agent-Debate.git
cd Multi-Agent-Debate
cp .env.example .env        # set GROQ_API_KEY=gsk_...; the other keys are optional
```

### 2. Start the database

```bash
docker compose up -d db
```

### 3. Start the API (terminal 1)

```bash
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload     # http://localhost:8000/docs
```

### 4. Start the web app (terminal 2)

```bash
cd frontend
npm install
npm run dev                               # http://localhost:3000
```

Open **http://localhost:3000**, type a question and press **Start debate**. Under **Settings** you can choose which model argues the debate. A live debate takes about 2–4 minutes on the Groq free tier. The **Sample debates** on the home page replay instantly and work without the backend.

### Run a debate from the terminal

```bash
cd backend
uv run python -m app.cli "Should our college switch to a 4-day week?" --rounds 2 --agents 2
uv run python -m app.cli "Is nuclear power essential for net zero?" --all-roles   # all 5 MAPS roles
```

Transcripts are saved to `backend/runs/` in the same JSON shape the web app replays.

## Models and rate-limit fallback

Everything runs on free tiers, which have strict rate limits. Calls go through LiteLLM, and `backend/app/config/models.yaml` decides what happens when a limit is hit:

1. **Rotate keys.** Each provider can hold several keys (`GROQ_API_KEY`, `GROQ_API_KEY_2`, ...). A key that gets HTTP 429 cools down and the next key takes over immediately.
2. **Switch provider.** If every key for a provider is cooling down, the call moves along a fallback chain, e.g. Groq → NVIDIA NIM → TokenHarbor → Mistral. This also happens on timeouts, connection errors, bad keys, and models that return empty or invalid JSON. Each call tries a model at most once.
3. **Pace and wait.** Models with tiny limits are spaced out on the client (NVIDIA NIM 40 requests/min, Ministral 2/min). Only when every option is exhausted does a call wait for the limit to reset.

Models offered in the UI (each passed structured debate tests; a provider's models only appear when its key is set):

| Provider | Models |
|---|---|
| Groq | GPT-OSS 20B (default), GPT-OSS 120B, Qwen 3.8 27B |
| NVIDIA NIM | Nemotron 3.5 Lightning 30B, Nemotron 3.5 Super 120B, Nemotron 3 Ultra 550B, MiniMax M3.1 Flash |
| TokenHarbor | DeepSeek V4 Flash, DeepSeek V4.1 Flash (free models) |
| Mistral | Ministral 14B (free tier allows 2 calls a minute, so debates are slower) |

The chosen model argues every side. The moderator, Critic and judge keep their configured models so the referee stays constant.

## How a debate runs

```
Question ──► Moderator assigns Pro / Con
               │
               ▼
         Opening round ──► Critic scores each argument ──► weak ones are revised
               │
               ▼
         Rebuttal rounds (each side answers the other's weakest point, Critic again)
               │
               ▼
         Judge ──► Verdict: decision · confidence · why it won · still disputed
```

| Role | Big Five trait | Job |
|---|---|---|
| Moderator | Agreeableness | Restates the question, splits it into sub-claims, assigns sides |
| Advocate | Extraversion | Commits to a side and argues it persuasively |
| Scholar | Conscientiousness | Argues from precise, verifiable detail |
| Explorer | Openness | Brings alternative angles and edge cases |
| Critic | Neuroticism | Asks Socratic questions and flags weak or unsupported steps |
| Judge | Agreeableness | Weighs the full transcript and rules |

## API

The FastAPI backend streams every step of a debate as Server-Sent Events. Interactive docs are at `http://localhost:8000/docs`.

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/debates` | Start a debate `{question, num_agents, rebuttals, model}` and return its `id` |
| `GET` | `/api/debates/{id}/stream` | Live event stream: `debate_started`, `round_started`, `argument`, `critique`, `verdict`, `error` |
| `GET` | `/api/debates/{id}` | Full transcript (or the transcript so far while it runs) |
| `GET` | `/api/debates` | Past debates |
| `GET` | `/api/config/options` | Debate models available with your keys, personalities, aggregation methods, limits |
| `GET` | `/api/health` | API and database status |

Finished debates are stored in Postgres, so a stream can be replayed later. Only one debate runs at a time, to stay within free-tier rate limits.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, Motion |
| Backend | Python 3.11, FastAPI, Server-Sent Events, Pydantic v2 |
| LLM access | LiteLLM → Groq, NVIDIA NIM, TokenHarbor and Mistral free tiers, with key rotation and provider fallback; profiles for local Ollama and vLLM on Kaggle |
| Data | PostgreSQL 17 + pgvector, SQLAlchemy (async), Alembic |
| Tooling | uv, ruff, pytest, ESLint, Prettier, GitHub Actions |

## Project structure

```
Multi-Agent-Debate/
├─ backend/
│  ├─ app/
│  │  ├─ agents/        prompts and personality-shaped agent factory
│  │  ├─ api/           routes, debate runner, SSE streaming
│  │  ├─ config/        models.yaml (models, fallbacks, limits), personalities.yaml
│  │  ├─ db/            SQLAlchemy models and storage
│  │  ├─ engine/        the debate loop and Critic revision loop
│  │  ├─ cli.py         terminal debates
│  │  └─ main.py        FastAPI app
│  ├─ alembic/          database migrations
│  └─ tests/
├─ frontend/
│  ├─ app/              pages: new debate, debate view
│  ├─ components/       debate UI (arguments, verdict, sources, timeline)
│  ├─ hooks/            useDebateStream: live SSE or sample replay
│  ├─ lib/              shared types (mirror backend schemas), API client
│  └─ mock/             sample debates
├─ docker-compose.yml   Postgres + pgvector
└─ DESIGN.md            design system (colours, type, components)
```

## Development

```bash
# backend
cd backend
uv run ruff check . && uv run ruff format --check .
uv run pytest -q                      # add TEST_DATABASE_URL=... to include the Postgres test

# frontend
cd frontend
npm run lint && npx tsc --noEmit && npm run build
```

GitHub Actions runs the same checks, including migrations against Postgres, on every push and pull request. Contributors and coding agents should read [`AGENTS.md`](AGENTS.md) first.

## Deploying

### Frontend on Vercel

1. Import the repository at [vercel.com/new](https://vercel.com/new).
2. Set **Root Directory** to `frontend`. The framework (Next.js) and build settings come from `frontend/vercel.json`.
3. Add the environment variable `NEXT_PUBLIC_API_URL` with your backend's public **https** URL.
4. Deploy.

Without a backend URL the site still works: the sample debates replay from JSON, and **Start debate** explains that the server can't be reached.

### Backend

The API keeps a debate running in the background and streams it for several minutes, so it needs a long-running server rather than Vercel's serverless functions. Any host that runs a Python web service with Postgres works, such as Render, Railway or Fly.io:

```bash
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Set the provider keys from `.env.example`, plus:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://USER:PASSWORD@HOST:5432/DB`, on a Postgres with the `vector` extension (e.g. Neon or Supabase) |
| `CORS_ORIGINS` | your Vercel URL, e.g. `https://multi-agent-debate.vercel.app` |
| `CORS_ORIGIN_REGEX` | optional, to allow preview deployments: `https://.*\.vercel\.app` |

## Acknowledgements

Built on *MAPS: Multi-Agent Personality Shaping for Collaborative Reasoning* (arXiv:2503.16905). Debate design draws on Du et al. (2023), Liang et al. (2023), Irving et al. (2018) and Khan et al. (2024).
