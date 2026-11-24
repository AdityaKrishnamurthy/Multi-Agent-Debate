# 015 — Persistence, Deployment & Demo

**Goal:** a stable, hosted demo for the final review, plus a fallback that works offline.

**Depends on:** 007, 011
**Drift check:**
```bash
test -f docker-compose.yml && test -d backend/alembic && test -d .github/workflows && echo OK
```
**Allowed dependencies:** none new. Hosting accounts are outward-facing, so confirm with the team before creating them.
**Done when:** the hosted URL runs a live debate, and replay mode works with the network off.

## Persistence
- Postgres stores every debate, argument, piece of evidence, critique, vote and verdict (002 schema).
- Any past debate can be replayed in the UI from the DB, with no new LLM calls.

## Deployment
| Part | Host (free/cheap) |
|---|---|
| Frontend | Vercel |
| Backend (FastAPI) | Render / Railway / Fly.io (Docker) |
| Postgres + pgvector | Neon / Supabase |
| Redis (if used) | Upstash |
| Verifier model | bundled in the backend (CPU) or a HF Inference Endpoint |

- Secrets (`GROQ_API_KEY`, `TAVILY_API_KEY`, `DATABASE_URL`) go in the host's environment variables.
- **Demo mode** limits rounds and agents and adds a per-IP rate limit. This matters because Groq limits are per organization, so one public visitor could use up the quota for the live review.
- GitHub Actions: tests → deploy on merge to `main`.

## Demo plan
- **Live mode:** a reviewer types a fresh question.
- **Replay mode (fallback 1):** 5 strong pre-run debates stored in the DB/JSON. These work if the Wi-Fi, Groq or the rate limit fails.
- **Local mode (fallback 2):** `LLM_PROFILE=local` runs a short live debate on the laptop through Ollama (3B model, no internet). It is slower and weaker, but it is real.
- A 3-minute demo video, recorded in advance.

## Steps
- [ ] Dockerfiles + compose prod profile.
- [ ] Deploy frontend + backend + DB.
- [ ] Demo mode + rate limits.
- [ ] Curate replay debates.
- [ ] Record the demo video.
