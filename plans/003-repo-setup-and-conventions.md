# 003 — Repo Setup & Conventions

**Goal:** a clean, reproducible repo that every team member can run within 10 minutes.

**Depends on:** —

## Prerequisites: one-time machine setup (do this before the drift check)
These are **tools on your machine, not project dependencies**. Install them once on each machine that will run the plans.

| Tool | Needed for | Install | Verify |
|---|---|---|---|
| **Git** + **Git Bash** (Windows) | repo, drift checks | https://git-scm.com/downloads (Git Bash is included on Windows) | `git --version` |
| **Node.js 20+** (LTS) | frontend (003, 004, 011) | https://nodejs.org (LTS installer) | `node -v` → v20 or later |
| **uv** (Python package/project manager) | backend (003, 005–010) | see below | `uv --version` |
| **Python 3.11+** | backend | not separate: uv downloads it automatically (`uv python install 3.11`) | `uv run python --version` |
| **Docker Desktop** | Postgres + pgvector (003 Part B, 007+) | https://www.docker.com/products/docker-desktop | `docker compose version` |
| **Groq API key** (free) | live debates (005+) | sign up at https://console.groq.com → API Keys → create a key → put it in `.env` as `GROQ_API_KEY=...` | 005 drift check |
| **Tavily API key** (free) | web search (008+) | https://tavily.com → put it in `.env` as `TAVILY_API_KEY=...` | 008 drift check |

**Installing uv.** Pick one option:
- Windows (PowerShell): `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`
- Windows (winget): `winget install --id=astral-sh.uv -e`
- macOS / Linux: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- Any OS that already has Python: `pip install uv`

Then **close and reopen the terminal** so `uv` is on your PATH, and run `uv --version`. Docs: https://docs.astral.sh/uv/getting-started/installation/

**How uv is used in these plans** (the only commands you need):
- `uv sync`: create `.venv` and install everything in `pyproject.toml`. Run it after every pull.
- `uv add <pkg>` / `uv add --dev <pkg>`: add a dependency. Only add packages named in the plan's **Allowed dependencies**.
- `uv run <cmd>`: run inside the project environment, e.g. `uv run pytest` or `uv run python -m app.cli "..."`. There is no need to activate the venv manually.
- Run all of these from inside `backend/`.

**Drift check (Part A):**
```bash
git rev-parse --git-dir >/dev/null && test -f README.md && test ! -d frontend && test ! -d backend \
  && command -v node >/dev/null && command -v uv >/dev/null && echo OK
```
(The check expects a fresh repo containing only README/plans/AGENTS, with Node 20+ and `uv` installed. If it fails on `uv` or `node`, do the **Prerequisites** section above and re-run it. A missing tool is not plan drift.)

**Allowed dependencies:**
- Frontend: whatever `create-next-app` generates (Next.js, React, Tailwind, ESLint, TypeScript), the shadcn/ui CLI and the packages it adds (Radix primitives, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`), and `prettier`.
- Backend: `ruff`, `pytest` (dev only).

---

## Part A — local setup (before Phase 1)

| # | Step | Expected result |
|---|---|---|
| A1 | Create branch `chore/repo-setup` | `git branch --show-current` prints it |
| A2 | Expand `README.md` with a quick-start section | the README still starts with the title and pitch |
| A3 | Add `.gitignore` covering Python (`__pycache__`, `.venv`), Node (`node_modules`, `.next`), `.env`, `*.ckpt`, `ml/data/raw/`, `backend/runs/` | `git status` shows no junk after the steps below |
| A4 | Add `.env.example` with `GROQ_API_KEY=`, `TAVILY_API_KEY=` (used from 008), `DATABASE_URL=` (used from 007) | the file exists; no real keys |
| A5 | `npx create-next-app@latest frontend --ts --tailwind --eslint --app --src-dir=false --import-alias "@/*"` | `cd frontend && npm run dev` serves the default page |
| A6 | `npx shadcn@latest init` in `frontend/` | `frontend/components.json` exists |
| A7 | Add Prettier (`.prettierrc`, `format` script) | `npm run lint` and `npm run format` both pass |
| A8 | `uv init backend --app --python 3.11`; create `backend/app/__init__.py` and `backend/tests/test_smoke.py` | `cd backend && uv run pytest` → 1 passed |
| A9 | `uv add --dev ruff pytest`; add a ruff config to `pyproject.toml` | `uv run ruff check . && uv run ruff format --check .` passes |
| A10 | Commit with `chore: initial repo setup` | `git log` shows one commit; `resources/` is not tracked |

**Part A is done when:** a fresh clone → `npm install && npm run dev` (frontend) and `uv sync && uv run pytest` (backend) both work.

## Part B — sharing & infra (deferred; do before 007)
- [ ] Create the GitHub repo `Multi-Agent-Debate` (private until the team decides otherwise), push, add teammates and protect `main`. *This is outward-facing, so confirm with the owner first.*
- [ ] `docker-compose.yml`: `pgvector/pgvector` Postgres image (+ Redis only if 007 needs it).
- [ ] GitHub Actions: ruff + pytest (backend) and lint + build (frontend) on push and PR.

**Part B is done when:** a fresh clone → `docker compose up -d db` gives a reachable Postgres with the `vector` extension, and CI is green on `main`.

---

## Conventions
- Branches: `feat/<area>-<short>`, `fix/...`, `chore/...`. Open a PR into `main` with one reviewer once Part B exists.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
- Never commit API keys. All secrets go in `.env`, which is git-ignored.
- Every LLM prompt lives in a versioned file (`backend/app/agents/prompts/*.md`), which the report needs for reproducibility.
- Model IDs live only in `backend/app/config/models.yaml`.
- Experiments log their config, seed, model ID and token usage alongside the results.

## Team split (suggested, 3–4 people; see PLANS.md open question 1)
| Person | Area |
|---|---|
| A | Frontend (004, 011) |
| B | Debate engine + agents (005, 006, 010) |
| C | Retrieval + backend API (007, 008, 009) |
| D | Dataset, verifier, evaluation (012–014) |
