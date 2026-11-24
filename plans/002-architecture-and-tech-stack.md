# 002 — Architecture, Tech Stack & Shared Schema

> **Type:** Reference. Other plans point here for the stack and the data shapes.
> **Dependency rule:** the stack below is the *approved pool*. A package may only be installed by a plan that names it in its **Allowed dependencies** section (see AGENTS.md).

## High-level flow
```
User question (+ optional PDFs)
        │
        ▼
 Moderator ── decomposes into sub-claims
        │
        ▼
 Researchers ── retrieve evidence ──► Evidence Pool (pgvector)
        │
        ▼
 Debate rounds (personality-shaped advocates, Pro/Con/…)
   ├─ opening → rebuttal × N
   ├─ Critic: Socratic scoring per argument (MAPS-style)
   └─ Verifier model: does cited evidence support the claim?
        │
        ▼
 Aggregator ── evidence-weighted vote / judge panel
        │
        ▼
 Verdict + confidence + argument graph + sources ──► Frontend (live stream)
```

## Stack
| Layer | Choice | Introduced in |
|---|---|---|
| Language | Python 3.11+ (backend/ML), TypeScript (frontend) | 003 |
| Python tooling | **uv**, **ruff** (lint + format), **pytest** | 003 |
| LLM access | **LiteLLM** → Groq free tier (interactive), vLLM on Kaggle (bulk), Ollama (local), chosen by profile; see §Model backends | 005 |
| Orchestration | Plain async loop (005) → **LangGraph** (010) | 005 / 010 |
| Structured output | **Pydantic** v2 models + Groq JSON-schema output | 005 |
| API | **FastAPI** + SSE (`StreamingResponse`) | 007 |
| Jobs | asyncio tasks → Arq/Redis only if needed | 007 |
| DB | **PostgreSQL + pgvector** through Docker (see PLANS.md open question 1) | 007 |
| Embeddings | `bge-small-en-v1.5` or `all-MiniLM-L6-v2` (sentence-transformers, run locally) | 008 |
| Search | Tavily API, Wikipedia, arXiv, Semantic Scholar | 008 |
| PDF parsing | PyMuPDF | 008 |
| Verifier model | **DeBERTa-v3** (HF Transformers); optional LoRA on Qwen2.5 | 009 / 013 |
| Frontend | **Next.js (latest stable, version pinned at scaffold time) + React + Tailwind + shadcn/ui** | 003 |
| Viz | **Recharts** (004), **React Flow** (`@xyflow/react`, 011) | 004 / 011 |
| Eval | pandas, scikit-learn, matplotlib; W&B optional | 014 |
| DevOps | Docker Compose, GitHub Actions | 003-B |

## LLM models (Groq)
Model IDs live in **one config file** (`backend/app/config/models.yaml`) and are never hard-coded. Groq adds and retires models often, so confirm the IDs in the Groq console when implementing. Starting candidates:

| Role | Candidate | Why |
|---|---|---|
| Judge / anything needing strict JSON | `openai/gpt-oss-120b` | strongest reasoning; supports *strict* JSON-schema output |
| Debaters | `openai/gpt-oss-20b` or `llama-3.3-70b-versatile` | fast; low token cost |
| Model diversity (006, 010 judge panel) | `qwen/qwen3-32b`, `meta-llama/llama-4-scout-17b-16e-instruct`, `moonshotai/kimi-k2-instruct` | different model families |

**Groq-specific constraints that the plans account for:**
- Strict structured output is only guaranteed on GPT-OSS models. Other models get *best-effort* JSON, so the LLM wrapper must validate with Pydantic and retry once on a parse failure.
- Structured output can't be combined with streaming or tool use in the same call. Token streaming (007) and tool calling (008) are therefore separate call types.
- Free-tier limits apply **per model and per organization**, and adding more keys doesn't raise them. The order of magnitude is about 30 requests/min, about 1k requests/day and a few thousand tokens/min. Check your actual limits on the console's limits page. The wrapper must back off when it gets HTTP 429.

## Model backends (no paid API anywhere)
The same code serves every backend. `models.yaml` has a `profiles:` section, and the engine takes `--profile` (CLI) or `LLM_PROFILE` (env). LiteLLM handles each one:

| Profile | Backend | Used for | LiteLLM prefix |
|---|---|---|---|
| `groq` (default) | Groq free tier | interactive debates, Phase 1/2 demos (005–011) | `groq/` |
| `kaggle` | **vLLM** on a free Kaggle/Colab T4, serving open 7–8B models (Qwen2.5-7B, Llama-3.1-8B) | bulk dataset runs and evaluation (012, 014) | `hosted_vllm/` (OpenAI-compatible) |
| `local` | **Ollama** on the laptop (RTX 3050, 4 GB → 3B models such as `qwen2.5:3b`) | offline tests, demo fallback | `ollama/` |

Structured output works on all three: Groq JSON schema, vLLM guided/structured decoding and Ollama's `format` schema. The Pydantic validate-and-retry step in the wrapper stays in place regardless.

## Repo layout (monorepo)
```
Multi-Agent-Debate/
├─ backend/              FastAPI app, debate engine, agents, retrieval
│  ├─ app/schemas.py     Pydantic version of the shared schema (below)
│  ├─ app/config/        models.yaml, personalities.yaml
│  ├─ app/api/           routes, SSE
│  ├─ app/engine/        debate loop / LangGraph graph, aggregation
│  ├─ app/agents/        prompts/*.md, agent factory
│  ├─ app/retrieval/     search, PDF, vector store
│  ├─ app/verifier/      NLI / fine-tuned verifier
│  ├─ runs/              CLI outputs (git-ignored)
│  └─ tests/
├─ frontend/             Next.js app
│  ├─ lib/types.ts       TypeScript version of the shared schema
│  └─ mock/              sample debates (committed)
├─ ml/                   dataset scripts, verifier training, notebooks
├─ eval/                 benchmark runners, baselines, results
├─ plans/                these plans
└─ resources/            papers (git-excluded)
```

## Shared schema — Transcript JSON v1
This **one shape** is used by the 004 mock files, the 005 CLI output, the 007 API responses and the database rows. `backend/app/schemas.py` (Pydantic) and `frontend/lib/types.ts` (TypeScript) must match it field for field. A schema change bumps `schema_version` and both files are updated in the same commit.

```
Debate {
  schema_version: "1"
  id: str
  question: str
  config: { num_agents: int, rounds: int, models: {role: model_id}, aggregation: str }
  agents: Agent[]
  rounds: Round[]
  evidence: Evidence[]          # empty until 008
  verdict: Verdict | null
  created_at: ISO-8601 str
}
Agent     { id, name, role: "moderator"|"advocate"|"critic"|"scholar"|"explorer"|"judge",
            personality: { trait, level } | null, stance: "pro"|"con"|"neutral", model }
Round     { number: int, kind: "opening"|"rebuttal"|"closing", arguments: Argument[] }
Argument  { id, agent_id, stance, text, claims: str[], rebuts: str[] (argument ids),
            evidence_ids: str[] (e.g. "E3"), confidence: float 0–1,
            critique: Critique | null, strength: float 0–1 | null }
Evidence  { id ("E1"…), source, url, quote, credibility: float 0–1 }
Critique  { by_agent, score: 0–5, issues: [{ type, note }] }
Verdict   { decision, confidence: float 0–1, reasoning, winning_points: str[],
            open_disagreements: str[], votes: [{ agent_id, choice, weight }] }
```

## Database tables (007+)
These are the same entities with foreign keys: `debates`, `agents`, `rounds`, `arguments`, `evidence` (+ `embedding vector`), `critiques`, `votes`. The verdict is stored as JSON on `debates`.
