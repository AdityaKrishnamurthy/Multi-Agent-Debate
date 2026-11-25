<div align="center">

# Multi-Agent Debate

**Evidence-based reasoning and collective decision making with personality-shaped AI agents.**

AI agents with different Big Five personalities argue a question over several rounds. A Critic audits every claim, and the group reaches one verdict with a confidence score you can trace back to the arguments.

[![CI](https://github.com/AdityaKrishnamurthy/Multi-Agent-Debate/actions/workflows/ci.yml/badge.svg)](https://github.com/AdityaKrishnamurthy/Multi-Agent-Debate/actions/workflows/ci.yml)
![Python](https://img.shields.io/badge/Python-3.11+-1f4fd1)
![Next.js](https://img.shields.io/badge/Next.js-16-16181d)
![FastAPI](https://img.shields.io/badge/FastAPI-SSE-c2410c)

**[Live demo: multi-agent-debate-eta.vercel.app](https://multi-agent-debate-eta.vercel.app)**

</div>

## What it does

| | |
|---|---|
| **Debate, not just agreement** | Pro and Con advocates take opposing sides and attack each other's weakest points across an opening round and rebuttals. |
| **A Critic that pushes back** | A skeptical Critic scores every argument from 0 to 5 and flags unsupported claims and fallacies. Weak arguments must be revised. |
| **One verdict you can audit** | A judge rules on the full transcript. The verdict shows its confidence, the vote split, why it won and what is still disputed. |
| **Watch it live** | Arguments stream into the browser round by round as the agents write them. |

The project builds on **MAPS** ([arXiv:2503.16905](https://arxiv.org/abs/2503.16905)), which shapes agents with Big Five personality traits in a cooperative pipeline. Multi-Agent Debate keeps MAPS's personality shaping and Socratic Critic, and turns the cooperative pipeline into an adversarial debate. Evidence citations, a trained verifier and a calibrated collective verdict come next (see [Roadmap](#roadmap)).

## Pro, Con and the agents

- **Pro** (blue) argues **for** the question, e.g. "yes, the college should switch to a 4-day week".
- **Con** (orange) argues **against** it.
- Sides are **assigned**, not chosen by the model. Each debater argues its side as well as it can, so both sides of the issue get heard.
- The **Moderator**, **Critic** and **Judge** are neutral.

| Agent | Big Five trait | Side | Job |
|---|---|---|---|
| Moderator | Agreeableness | Neutral | Restates the question, splits it into sub-claims, assigns sides |
| Advocate Alpha / Beta | Extraversion | Pro / Con | Commits to its side and argues it persuasively |
| Scholar | Conscientiousness | Con | Argues from precise, checkable detail (3+ agents) |
| Explorer | Openness | Pro | Brings alternative angles and edge cases (3+ agents) |
| Critic | Neuroticism | Neutral | Scores every argument 0–5 with Socratic questions; below 2.5 the author must rewrite it once |
| Judge | Agreeableness | Neutral | Reads the full transcript and gives the verdict and confidence |

## Using the website

1. Type a question (5–500 characters) and press **Start debate**.
2. Optionally open **Settings**:
   - **Agents** (2–5, default 2) counts the debaters only. With **2** it is one Pro advocate against one Con advocate. With **3 or more**, all five MAPS roles take part: Advocate (Pro), Scholar (Con), Explorer (Pro), and any extra advocates alternate Con, Pro. The Moderator, Critic and Judge always run on top.
   - **Rounds** (default 3) is one opening round plus rebuttal rounds (at most 3 rebuttals). In a rebuttal each side answers the other's weakest point.
   - **Debate model** picks the model the debaters use (see [Models](#models-and-rate-limit-fallback)).
3. Arguments stream in round by round. The Critic's score appears under each argument, and rewritten arguments are labelled as revised.
4. The verdict panel shows the winning side, confidence, vote split, why it won and what is still disputed.
5. Every debate is saved, so a refresh replays it. The **Sample debates** on the home page replay instantly and work without the backend.

Limits, to stay within free tiers: one debate runs at a time, each model call times out after 60 seconds, and a live debate takes about 2–4 minutes. On the hosted demo the free backend sleeps when idle, so the first request can take about 50 seconds.

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

Open **http://localhost:3000**, type a question and press **Start debate** (see [Using the website](#using-the-website)).

### Run a debate from the terminal

```bash
cd backend
uv run python -m app.cli "Should our college switch to a 4-day week?" --rounds 2 --agents 2
uv run python -m app.cli "Is nuclear power essential for net zero?" --all-roles   # all 5 MAPS roles
```

Transcripts are saved to `backend/runs/` in the same JSON shape the web app replays.

## Models and rate-limit fallback

This project does not train or host its own model yet. Every agent calls an existing free model through LiteLLM, and `backend/app/config/models.yaml` sets which model each role uses.

| Role | Default model (Groq) | Changed by the Settings menu? |
|---|---|---|
| Debaters (Advocates) | GPT-OSS 20B | Yes |
| Scholar | Qwen 3.8 27B | Yes |
| Explorer | GPT-OSS 20B | Yes |
| Moderator | GPT-OSS 20B | No |
| Critic | Qwen 3.8 27B | No |
| Judge | GPT-OSS 120B | No |

The model picked in **Settings** is used by all debaters. The Moderator, Critic and Judge keep their configured models, so the referees stay the same whichever debater model you pick. The Critic uses a different model family (Qwen) from the GPT-OSS debaters so it does not simply agree with them.

Free tiers have strict rate limits, so the backend switches models on its own when a limit is hit:

1. **Rotate keys.** Each provider can hold several keys (`GROQ_API_KEY`, `GROQ_API_KEY_2`, ...). A key that gets HTTP 429 cools down and the next key takes over immediately.
2. **Switch provider.** If every key for a provider is cooling down, the call moves along a fallback chain, e.g. Groq → NVIDIA NIM → TokenHarbor → Mistral. This also happens on timeouts, connection errors, bad keys, and models that return empty or invalid JSON. Each call tries a model at most once.
3. **Pace and wait.** Models with tiny limits are spaced out on the client (NVIDIA NIM 40 requests/min, Ministral 2/min). Only when every option is exhausted does a call wait for the limit to reset.

**10 debater models** are offered in the UI. Each passed structured debate tests, and a provider's models only appear when its key is set:

| Provider | Models |
|---|---|
| Groq | GPT-OSS 20B (default, fast), GPT-OSS 120B (strongest reasoning), Qwen 3.8 27B |
| NVIDIA NIM | Nemotron 3.5 Lightning 30B, Nemotron 3.5 Super 120B, Nemotron 3 Ultra 550B (largest, slowest), MiniMax M3.1 Flash |
| TokenHarbor | DeepSeek V4 Flash, DeepSeek V4.1 Flash (free models) |
| Mistral | Ministral 14B (free tier allows 2 calls a minute, so debates are slower) |

You never pick a backup model yourself: the debate keeps going, possibly on a different model for a single turn.

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

Each agent turn is one model call. Its prompt is built from a role, a personality block (`personalities.yaml`) and rules, and the answer must be strict JSON (text, claims, the point it rebuts, confidence). Answers are validated with Pydantic; an invalid answer is retried or sent to another model.

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
| `GET` | `/api/ping` | Lightweight liveness check (no database) |
| `POST` | `/api/documents` | Placeholder for PDF upload (plan 008); returns 501 for now |

Finished debates are stored in Postgres, so a stream can be replayed later. Only one debate runs at a time, to stay within free-tier rate limits.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, Motion |
| Backend | Python 3.11, FastAPI, Server-Sent Events, Pydantic v2 |
| LLM access | LiteLLM → Groq, NVIDIA NIM, TokenHarbor and Mistral free tiers, with key rotation and provider fallback; profiles for local Ollama and vLLM on Kaggle |
| Data | PostgreSQL 17 + pgvector, SQLAlchemy (async), Alembic |
| Tooling | uv, ruff, pytest, ESLint, Prettier, GitHub Actions |
| Hosting | Vercel (website), Render (API), Neon (Postgres) |

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
├─ plans/              numbered build plans and their status (PLANS.md)
├─ scripts/            render-env.ps1: builds a Render env file from .env
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

Tests use a **fake LLM**: a small test function that returns fixed answers, so the suite runs without API keys or internet. It exists only for testing, is not a trained model, and is never used by the running app.

GitHub Actions runs the same checks, including migrations against Postgres, on every push and pull request. Contributors and coding agents should read [`AGENTS.md`](AGENTS.md) first.

## Deploying

### Frontend on Vercel

1. Import the repository at [vercel.com/new](https://vercel.com/new).
2. Set **Root Directory** to `frontend`. The framework (Next.js) and build settings come from `frontend/vercel.json`.
3. Add the environment variable `NEXT_PUBLIC_API_URL` with your backend's public **https** URL.
4. Deploy.

Without a backend URL the site still works: the sample debates replay from JSON, and **Start debate** explains that the server can't be reached.

### Backend on Render

The API keeps a debate running in the background and streams it for several minutes, so it needs a long-running server rather than Vercel's serverless functions. The demo runs on Render's free plan with a Neon Postgres database; Railway or Fly.io also work.

| Setting | Value |
|---|---|
| Root directory | `backend` |
| Runtime | Python 3 |
| Build command | `pip install uv && uv sync --frozen` |
| Start command | `uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT` |

Set the provider keys from `.env.example`, plus:

| Variable | Value |
|---|---|
| `PYTHON_VERSION` | `3.11.9` |
| `DATABASE_URL` | a Postgres with the `vector` extension (e.g. Neon or Supabase). A standard `postgresql://...?sslmode=require` string works; it is converted for the async driver. |
| `CORS_ORIGINS` | your Vercel URL, e.g. `https://multi-agent-debate-eta.vercel.app` |
| `CORS_ORIGIN_REGEX` | optional, to allow preview deployments: `https://.*\.vercel\.app` |

`pwsh ./scripts/render-env.ps1 -DatabaseUrl "postgresql://..."` writes these, plus the provider keys from your `.env`, to a git-ignored `render.env` you can paste into Render's **Add from .env**. Check the deploy with `GET /api/ping` or `/api/health`; the API has no page at `/`.

## Own dataset and model (planned)

Nothing is trained yet. The plan builds both, and they connect:

- **Dataset, MAD-Transcripts (plan 012):** about 1,000 debates, with every claim paired with the evidence it cites and labelled *supports / refutes / not enough info*. About 500 pairs are checked by hand; the rest are labelled by a strong model. Saved debates in Postgres are the raw material.
- **Model, a verifier (plan 013):** a small model (DeBERTa-v3, optionally Qwen with LoRA) fine-tuned on that dataset on free Kaggle or Colab GPUs. Given a claim and a source, it says whether the source really supports the claim.
- **Use:** the verifier runs inside the debate to catch fabricated or weak citations, and its scores feed a better-calibrated confidence.
- **Fallback:** if time runs short, train on public datasets (FEVER, SciFact) first and add MAD-Transcripts later.

## Roadmap

Done (plans 001–007): repo and CI, website, debate engine, personality agents, Critic revision loop, live API with streaming, database, model selection with automatic fallback, and deployment. Full status is in [`plans/PLANS.md`](plans/PLANS.md).

| Plan | What it adds |
|---|---|
| 008 Evidence retrieval (RAG) | Web, Wikipedia, paper and PDF search; every claim must cite a source (E1, E2, ...) |
| 009 Citation checking | Check that each source really supports its claim; catch fabricated quotes |
| 010 Collective decision | Votes weighted by argument strength, a judge panel, calibrated confidence; move to LangGraph |
| 011 Full frontend | Argument graph, stance chart, history, export, results page |
| 012–013 Own dataset and model | MAD-Transcripts and the trained verifier |
| 014 Evaluation | Compare against single-model and MAPS-style baselines on accuracy, calibration and hallucination rate |
| 015–016 Demo and extras | Demo video, polish, stretch goals |

## References

1. Jian Zhang, Zhiyuan Wang, Zhangqi Wang, Fangzhi Xu, Qika Lin, Lingling Zhang, Rui Mao, Erik Cambria and Jun Liu. [*MAPS: Multi-Agent Personality Shaping for Collaborative Reasoning*](https://arxiv.org/abs/2503.16905). AAAI 2026. arXiv:2503.16905.
