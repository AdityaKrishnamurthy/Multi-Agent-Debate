# 007 — Backend API & Live Streaming

**Goal:** expose the engine as a web API and stream every agent message to the frontend in real time.

**Depends on:** 005, 006, 003 Part B (Docker Postgres)
**Drift check:**
```bash
test -f backend/app/config/personalities.yaml && test -f docker-compose.yml \
  && grep -q pgvector docker-compose.yml && grep -q useDebateStream -r frontend/lib frontend/hooks 2>/dev/null && echo OK
```
**Allowed dependencies:** `fastapi`, `uvicorn[standard]`, `sqlalchemy[asyncio]`, `asyncpg`, `alembic`, `pgvector` (Python package, for the column type used in 008); dev: `httpx`.
**Done when:** pressing "Start Debate" in the UI shows a real Groq debate streaming live, and the debate can be re-opened after a page refresh.

## Endpoints (FastAPI)
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/debates` | create a debate from `{question, config}` → `{id}`; starts a background task |
| GET | `/api/debates/{id}` | full `Debate` (002 schema) |
| GET | `/api/debates/{id}/stream` | **SSE** event stream |
| GET | `/api/debates` | history list |
| POST | `/api/documents` | upload a PDF → parsed and indexed (implemented in 008; returns 501 until then) |
| GET | `/api/config/options` | available models (from `models.yaml`), personalities and aggregation methods |

## Stream events (the same names the 004 mock replay uses)
```
round_started   {round, kind}
agent_thinking  {agent_id}
token           {agent_id, delta}      # optional, see note
argument        {Argument}
evidence_added  {Evidence}
critique        {argument_id, Critique}
vote            {agent_id, choice, weight}
verdict         {Verdict}
error           {message, retry_after?}
```
**Groq note:** structured output and streaming can't be combined in one call. The `token` event is therefore optional: either make a second, plain streaming call for display, or skip `token` and send whole `argument` events, which is the recommended default.

## Implementation
- The engine emits events to an `asyncio.Queue` per debate, and the SSE endpoint (`StreamingResponse`, `text/event-stream`) drains it. Events are also stored, so a late client can replay them.
- SQLAlchemy async models from 002 §Database tables, with Alembic migrations.
- CORS for the Next.js dev server.
- Cost guard: maximum agents, rounds and concurrent debates set in config. When Groq returns 429, send an `error` event with `retry_after` rather than crashing.

## Steps
- [ ] FastAPI app + routes + schemas → `uv run uvicorn app.main:app` serves `/docs`.
- [ ] DB models + first migration → `alembic upgrade head` creates the tables in Docker Postgres.
- [ ] Background task + queue + SSE → `curl -N .../stream` prints events during a live debate.
- [ ] Frontend `useDebateStream` switched to `EventSource` (the mock remains available via `?demo=1`) → the UI shows the live debate.
- [ ] API tests (pytest + httpx, fake LLM) → green in CI.
