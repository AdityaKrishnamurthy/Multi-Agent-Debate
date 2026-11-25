# PLANS.md — Status of all plans

Update the **Status** column whenever a plan starts or finishes. Statuses: `Reference` (a design doc, nothing to build), `Not started`, `In progress`, `Blocked`, `Done`.

Every buildable plan has the same header: **Depends on**, **Drift check**, **Allowed dependencies**, **Done when**. Drift checks are Git Bash commands run from the repo root. Each one prints `OK` or stops at the first missing prerequisite.

| # | Plan | Review | Depends on | Status |
|---|---|---|---|---|
| 001 | [Project overview & scope](001-project-overview.md) | Phase 1 | — | Reference |
| 002 | [Architecture, tech stack & shared schema](002-architecture-and-tech-stack.md) | Phase 1 | — | Reference |
| 003 | [Repo setup & conventions](003-repo-setup-and-conventions.md) | Phase 1 (Part A) | — | Done (branch protection skipped: not available for private repos on a free GitHub plan) |
| 004 | [Frontend shell + mock debate](004-frontend-shell-and-mock-debate.md) | **Phase 1** | 003-A | Done |
| 005 | [Debate engine MVP (CLI)](005-debate-engine-mvp.md) | **Phase 1** | 003-A, 004 (schema types) | Done (Phase 1 cut; step 8 has 2 of 5 saved runs) |
| 006 | [Personality-shaped agents](006-personality-shaped-agents.md) | Phase 1 / 2 | 005 | Done |
| 007 | [Backend API & live streaming](007-backend-api-and-streaming.md) | Phase 2 | 005, 006, 003-B | Done |
| 008 | [Evidence retrieval (RAG)](008-evidence-retrieval-rag.md) | Phase 2 | 007 | Not started |
| 009 | [Critic & citation verification](009-critic-and-citation-verification.md) | Phase 2 | 006, 008 | Not started |
| 010 | [Aggregation & collective decision](010-aggregation-and-collective-decision.md) | Phase 2 | 009 | Not started |
| 011 | [Full frontend experience](011-frontend-full-experience.md) | Phase 2 | 007, 010 | Not started |
| 012 | [Dataset construction](012-dataset-construction.md) | Phase 2 / 3 | 010 | Not started |
| 013 | [Verifier model fine-tuning](013-verifier-model-finetuning.md) | Phase 3 | 012 | Not started |
| 014 | [Evaluation, baselines & ablations](014-evaluation-baselines-ablations.md) | Phase 3 | 010, 013 | Not started |
| 015 | [Persistence, deployment & demo](015-persistence-deployment-demo.md) | Phase 3 | 007, 011 | Not started |
| 016 | [Stretch goals](016-stretch-goals.md) | Optional | 001–015 | Not started |
| 017 | [Reviews, report & timeline](017-reviews-report-timeline.md) | All | — | Reference |

## Before you start (for whoever implements)
1. Read `AGENTS.md`, which sets the workflow and the stop conditions.
2. Do the **one-time machine setup** in [003 §Prerequisites](003-repo-setup-and-conventions.md): Git/Git Bash, Node 20+, **uv**, Docker (from 007) and the free Groq/Tavily keys. Nothing in plans 003–011 works without `uv`.
3. Run every drift check in **Git Bash** from the repo root, and every `uv ...` command from `backend/`.
4. When a plan is finished, update its row in the table below.

## Current position (2026-11-25)
- **Implemented through plan 007.** 003 (Parts A and B), 004, 005, 006 and 007 are done on `main`.
- **Next up: 008, evidence retrieval.** It needs a free `TAVILY_API_KEY` in `.env` (the 008 drift check looks for it), plus a one-time download of the local embedding and reranker models.
- **Verified on 2026-11-25:**
  - Backend: ruff passes, and pytest passes 19 tests, including the API tests with a fake LLM and the Postgres round trip.
  - `alembic upgrade head` creates every table in the Docker database.
  - Frontend: lint, type check and build pass.
  - In the browser, Start debate ran a live Groq debate (2 agents, 2 rebuttals, about 2.5 minutes) that streamed round by round into the UI and ended in a verdict. After a page refresh it replays from Postgres.
  - If the API is unreachable, the home page explains this and offers a sample replay.
- **Not yet verified:** CI on GitHub runs only after the next push.
- **Outside the numbered plans:**
  - Frontend redesign: light default theme, facing Pro/Con columns, a verdict rail, honest sample labels and a favicon, recorded in `PRODUCT.md` and `DESIGN.md`.
  - Header nav fix: reliable smooth scrolling.
  - README rewritten with setup steps and screenshots.

## Phase 1 critical path (done)
003-A → 004 → 005 (+ 006) are complete for the Phase 1 review.

## Decisions made
| Date | Decision |
|---|---|
| 2026-11-24 | **LLM provider for 005–011 = Groq free tier** (no Anthropic key). Calls go through LiteLLM, so changing provider later only means editing config. |
| 2026-11-24 | One shared transcript JSON schema (002 §Shared schema), used by the 004 mock data, the 005 output and the 007 API. |
| 2026-11-24 | Backend tooling: `uv` + `ruff` (lint + format) + `pytest`. Poetry and Black are dropped. |
| 2026-11-24 | Plan 003 is split into Part A (local setup, before Phase 1) and Part B (GitHub repo, Docker, CI, deferred until 007). |
| 2026-11-24 | **No paid API keys, ever.** The model backend is chosen by profile (002 §Model backends): `groq` free tier for 005–011 and demos, `kaggle` (vLLM + open 7–8B models on free GPUs) for 012–014, `local` (Ollama, 3B) for offline use. |
| 2026-11-24 | Own-work contribution = **both** the own model (`mad-verifier`, 013, primary) and the own dataset (MAD-Transcripts, 012). |
| 2026-11-25 | Frontend design system recorded in `DESIGN.md` (light default; cobalt = Pro, burnt orange = Con; Public Sans + Source Serif 4). Future UI work (007 live mode, 011) must follow it. |
| 2026-11-25 | **Database = Postgres + pgvector through Docker in every environment** (resolves the old SQLite and Chroma question). `docker compose up -d db`, then `uv run alembic upgrade head`. |
| 2026-11-25 | The API runs one debate at a time (`MAX_CONCURRENT_DEBATES=1`) because Groq free-tier limits are per organisation. Every event is persisted, so a stream can be replayed after the debate ends or after a restart. |
| 2026-11-24 | 012/014 retrieval runs over the datasets' own corpora (FEVER Wikipedia, SciFact abstracts), not paid web search. Tavily's free credits are reserved for live demos. |

## Open questions
1. **Team split:** 003 assumes 3–4 people. Confirm the team members and their areas.
2. **Kaggle account:** 012/014 need a Kaggle account with phone verification, which is required to enable GPUs and internet in notebooks. Set this up before plan 012.
