# 011 — Full Frontend: Live Debate, Argument Graph, Verdict

**Goal:** turn the Phase 1 mock UI (004) into the complete, explainable product.

**Depends on:** 007 (live API), 010 (aggregators, strength)
**Drift check:**
```bash
grep -rq "EventSource" frontend && grep -rq "def aggregate" backend/app/engine && echo OK
```
**Allowed dependencies:** `@xyflow/react` (React Flow). Export uses Markdown plus the browser's print-to-PDF, so no PDF library is needed.
**Done when:** each of the 7 additions below works against a live debate, and the app is usable at 1280×720.

## Additions over 004
1. **Argument graph** (React Flow)
   - Nodes are claims (colour = stance, size = strength), with evidence nodes attached. Edges are supports / attacks / rebuts and animate as the debate streams.
   - Clicking a node opens a side panel with the text, citations, critique and verifier result.
2. **Stance-shift chart**: each agent's stance and confidence per round, as a line chart. This shows *how* consensus formed.
3. **Verdict dashboard**: the decision with a calibrated confidence gauge, the vote breakdown per aggregation method (toggle), a sub-claim table, disputed points and "what evidence would change the result".
4. **Document upload** wired to `/api/documents`, with indexing progress.
5. **History page**: past debates, search, re-open, and comparing two debates.
6. **Export**: a Markdown report plus a print stylesheet for PDF.
7. **Experiment view (for reviewers)**: the 014 results table, loaded from `eval/results/*.json`.

## Quality
- Dark and light theme, loading skeletons, and error states (API key missing, Groq rate-limited with a countdown taken from `retry-after`).
- Accessible colours: stance is never shown by colour alone.
- Works on a projector at 1280×720.

## Steps
- [ ] React Flow graph + live updates.
- [ ] Stance-shift chart.
- [ ] Verdict dashboard + method toggle.
- [ ] Upload, history, export.
- [ ] Results page.
