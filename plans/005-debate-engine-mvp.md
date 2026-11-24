# 005 — Debate Engine MVP (CLI)

**Goal:** a real (non-mock) debate running from the terminal with actual **Groq** LLM calls, as proof for Phase 1 that the core idea works. There is no retrieval yet: the agents use what the models already know, and `evidence` stays empty.

**Depends on:** 003 Part A, 004 step 2 (`frontend/lib/types.ts` defines the schema to mirror)
**Drift check:**
```bash
test -f backend/pyproject.toml && test -d backend/app && test -f frontend/lib/types.ts \
  && grep -q GROQ_API_KEY .env.example && test -f .env && grep -q '^GROQ_API_KEY=.' .env && echo OK
```
**Allowed dependencies:** `litellm`, `pydantic`, `pyyaml` (for `models.yaml`), `python-dotenv`, `rich` (coloured transcript); dev: `pytest-asyncio`.
**Done when:** one command produces a full debate and verdict as schema-valid JSON, and copying that file into `frontend/mock/` replays it in the 004 UI.
**Effort:** about 2–3 days.

## Phase 1 cut
Steps 1–7 are essential, along with **at least 2** saved runs (step 8). The full set of 5 runs can be completed after the review.

## Minimal protocol
1. The Moderator restates the question and assigns stances (Pro / Con).
2. **Opening round:** each advocate gives a position and 3 key points.
3. **Rebuttal rounds (default 2):** each advocate sees the transcript and attacks the opponent's weakest point.
4. **Judge:** reads the transcript and outputs a `Verdict`.

That is 1 + 2 + 4 + 1 = **8 LLM calls per debate** (with 2 agents and 2 rounds).

## Groq budget check
A debate uses roughly 15–30k tokens in total, because the transcript grows each round. On free-tier limits of a few thousand tokens/min per model, one debate can take **1–4 minutes**, and a model allows only a handful of debates per day. That is enough for Phase 1 (2–5 sample runs). To stay inside the limits:
- Debaters and the judge use **different models**, because each model has its own quota.
- The wrapper reads Groq's `retry-after` header and waits when it gets HTTP 429, rather than failing.
- Every call logs its tokens to the run JSON's `meta.usage`, so real usage is measured.

## Schemas
Use `backend/app/schemas.py` = **002 §Shared schema** in Pydantic v2, field for field with `frontend/lib/types.ts`. LLM calls return small, role-specific output models (e.g. `AdvocateOutput{text, claims, rebuts, confidence}`), and the engine wraps those into `Argument`/`Verdict`.

## Steps
| # | Step | Expected result |
|---|---|---|
| 1 | Branch `feat/engine-mvp`; `uv add litellm pydantic pyyaml python-dotenv rich` | `uv run python -c "import litellm"` works |
| 2 | `app/schemas.py` (shared schema) + a test that loads `frontend/mock/debate-4day-week.json` into `Debate` | the test passes, so the Python and TS schemas agree |
| 3 | `app/config/models.yaml` with a `profiles:` section (only `groq` filled in for now; see 002 §Model backends) and a model for each role. Confirm the IDs against the Groq console | the file loads; every ID is listed in the console. Adding `kaggle`/`local` later requires no code change |
| 4 | `app/llm.py`: `complete(role, system, messages, schema) -> BaseModel` using LiteLLM `groq/<id>`, `response_format` JSON schema (strict on GPT-OSS), a Pydantic validation step, 1 retry on a parse error, backoff on 429, and token logging | a unit test with a mocked LiteLLM response parses; one live call returns a valid object |
| 5 | Prompts `app/agents/prompts/{moderator,advocate,judge}.md` | the files exist; the prompts ask for JSON matching the output model |
| 6 | `app/engine/debate.py`: a plain async loop implementing the protocol, building a `Debate` | a test with a fake `complete()` produces a schema-valid `Debate` |
| 7 | `app/cli.py`: `uv run python -m app.cli "question" --rounds 2 --agents 2 [--profile groq]` → coloured transcript (rich) and `backend/runs/<timestamp>-<slug>.json` | a live run finishes with a verdict; the JSON validates |
| 8 | Save 5 sample runs (including both 004 questions); copy the best ones into `frontend/mock/` | they replay in the 004 UI without code changes |

## Later
LangGraph replaces the plain loop in 010, once the flow is stable.
