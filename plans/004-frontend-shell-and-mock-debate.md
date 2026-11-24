# 004 — Frontend Shell + Mock Debate (Phase 1 visual demo)

**Goal:** a polished, clickable UI that shows the *whole idea* at the Phase 1 review. It runs on mock (pre-recorded) debate data, so it works without the backend or the internet.

**Depends on:** 003 Part A
**Drift check:**
```bash
test -f frontend/package.json && grep -q '"next"' frontend/package.json \
  && test -f frontend/components.json && test ! -f frontend/lib/types.ts && echo OK
```
**Allowed dependencies:** `motion` (formerly Framer Motion), `recharts`. shadcn/ui components added through the CLI: `button card badge tabs sheet progress input textarea select slider label separator scroll-area tooltip`.
**Done when:** in the review, you can open the app, type a question, press Start and watch a full mock debate end in a verdict. It also has to work offline (`npm run build && npm start`).
**Effort:** about 3–4 days for one person.

## Phase 1 cut (essential for the review)
Steps 1–6 and 9 are essential. Steps 7–8 (the settings drawer and the second sample debate) are nice to have, so drop them first if time runs short.

## Pages
1. **Landing / New Debate** (`/`): question textbox, an optional PDF upload (UI only, disabled with a "coming in Phase 2" tooltip) and a settings drawer. "Start Debate" goes to `/debate/[id]`.
2. **Live Debate** (`/debate/[id]`)
   - One lane per agent, showing an avatar, role, personality badge (e.g. "Skeptic · Neuroticism") and a stance chip (Pro/Con, shown with both text and colour).
   - A round timeline at the top: Opening → Rebuttal 1 → Rebuttal 2 → Verdict.
   - Messages "type in" one at a time, replayed from JSON with delays.
   - Inline citation chips `[E3]`, plus Critic remarks as a flagged sub-card under the argument.
3. **Evidence panel** (Sheet): cards with source, quote, URL and a credibility bar. Clicking `[E3]` opens the panel and highlights that card.
4. **Verdict view**: final decision, a confidence gauge (Recharts `RadialBarChart`), a vote breakdown bar chart and a list of "key disputed points".

**Mock question → id mapping:** any typed question replays the closest sample, chosen by simple keyword match, and falls back to sample 1. The UI says "Demo mode — replaying a recorded debate" so this is presented honestly.

## Steps
| # | Step | Expected result |
|---|---|---|
| 1 | Branch `feat/frontend-mock`; add the shadcn components listed above; `npm i motion recharts` | `npm run build` passes |
| 2 | Write `frontend/lib/types.ts` exactly matching **002 §Shared schema** (`schema_version: "1"`) | `tsc --noEmit` passes |
| 3 | Write `frontend/mock/debate-4day-week.json` ("Should our college switch to a 4-day week?") with 2 advocates, a critic remark, 5+ evidence items and a verdict | the file type-checks when imported as `Debate` |
| 4 | Build the layout, theme (light + dark) and nav | the app shell renders at `/` |
| 5 | Build the New Debate form → navigate to `/debate/[id]` | Start goes to the debate page |
| 6 | `useDebateStream(id)` hook in `frontend/hooks/useDebateStream.ts`: replays the JSON as events (`round_started`, `argument`, `evidence_added`, `critique`, `verdict`) using the same event names as 007, with delays. Then build the agent lanes and timeline | the debate plays out message by message |
| 7 | Settings drawer: agents (2–5), rounds (1–4), personality per agent, model and aggregation method (stored in the URL query; mock ignores them) | values persist when navigating to the debate page |
| 8 | Second sample, `debate-fasting.json` ("Does intermittent fasting improve long-term weight loss?") | keyword match picks the right sample |
| 9 | Evidence Sheet + citation highlight; Verdict view with gauge and chart | clicking `[E#]` highlights its card, and the verdict renders at the end |
| 10 | Responsive check at 1366×768 (laptop) and 1280×720 (projector) | no horizontal scroll and text is readable |

Mock content may be written by hand or generated once with Groq. Either way, the evidence URLs must be **real, checkable sources**, never invented ones.

## Hand-off to later plans
- 005 writes the same JSON → copy a real run into `frontend/mock/` to replay it.
- 007 replaces the replay inside `useDebateStream` with `EventSource`. The components don't change.
