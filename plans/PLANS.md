# PLANS.md — Status of all plans

Update the **Status** column whenever a plan starts or finishes. Statuses: `Reference` (a design doc, nothing to build), `Not started`, `In progress`, `Blocked`, `Done`.

Every buildable plan has the same header: **Depends on**, **Drift check**, **Allowed dependencies**, **Done when**. Drift checks are Git Bash commands run from the repo root. Each one prints `OK` or stops at the first missing prerequisite.

| # | Plan | Review | Depends on | Status |
|---|---|---|---|---|
| 001 | [Project overview & scope](001-project-overview.md) | Phase 1 | — | Reference |
| 002 | [Architecture, tech stack & shared schema](002-architecture-and-tech-stack.md) | Phase 1 | — | Reference |
| 003 | [Repo setup & conventions](003-repo-setup-and-conventions.md) | Phase 1 (Part A) | — | In progress |
| 004 | [Frontend shell + mock debate](004-frontend-shell-and-mock-debate.md) | **Phase 1** | 003-A | Done |
| 005 | [Debate engine MVP (CLI)](005-debate-engine-mvp.md) | **Phase 1** | 003-A, 004 (schema types) | Done |
| 006 | [Personality-shaped agents](006-personality-shaped-agents.md) | Phase 1 / 2 | 005 | Done |
| 007 | [Backend API & live streaming](007-backend-api-and-streaming.md) | Phase 2 | 005, 006, 003-B | Not started |
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

## Phase 1 critical path
003-A → 004 → 005. Together these are estimated at about 6 days of work, and the review is a couple of days away. Both 004 and 005 therefore have a **Phase 1 cut** listing what is essential for the review. Everything else in them can follow afterwards.

## Decisions made
| Date | Decision |
|---|---|
| 2026-11-24 | **LLM provider for 005–011 = Groq free tier** (no Anthropic key). Calls go through LiteLLM, so changing provider later only means editing config. |
| 2026-11-24 | One shared transcript JSON schema (002 §Shared schema), used by the 004 mock data, the 005 output and the 007 API. |
| 2026-11-24 | Backend tooling: `uv` + `ruff` (lint + format) + `pytest`. Poetry and Black are dropped. |
| 2026-11-24 | Plan 003 is split into Part A (local setup, before Phase 1) and Part B (GitHub repo, Docker, CI, deferred until 007). |
| 2026-11-24 | **No paid API keys, ever.** The model backend is chosen by profile (002 §Model backends): `groq` free tier for 005–011 and demos, `kaggle` (vLLM + open 7–8B models on free GPUs) for 012–014, `local` (Ollama, 3B) for offline use. |
| 2026-11-24 | Own-work contribution = **both** the own model (`mad-verifier`, 013, primary) and the own dataset (MAD-Transcripts, 012). |
| 2026-11-24 | 012/014 retrieval runs over the datasets' own corpora (FEVER Wikipedia, SciFact abstracts), not paid web search. Tavily's free credits are reserved for live demos. |

## Open questions
1. **Dev database:** 002 says to use SQLite in dev, but 008 needs pgvector, which only runs on Postgres. Recommendation: use Postgres + pgvector through Docker from 007 onwards and drop both SQLite and Chroma.
2. **Team split:** 003 assumes 3–4 people. Confirm the team members and their areas.
3. **Kaggle account:** 012/014 need a Kaggle account with phone verification, which is required to enable GPUs and internet in notebooks. Set this up before plan 012.
