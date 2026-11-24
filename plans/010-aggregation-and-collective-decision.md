# 010 — Aggregation & Collective Decision

**Goal:** turn many arguing agents into **one calibrated decision**. This is the "collective decision making" part of the title; MAPS has no aggregation.

**Depends on:** 009
**Drift check:**
```bash
test -d backend/app/verifier && grep -rq "strength" backend/app/schemas.py && echo OK
```
**Allowed dependencies:** `langgraph`, `numpy`, `scipy` (temperature scaling).
**Done when:** all 5 aggregators run on one saved debate and return different, schema-valid verdicts, and the LangGraph engine reproduces a 005-style debate end to end.

## Stopping rule
Stop the rounds early when positions converge: no stance changed in a round **and** the mean argument-embedding change is below ε (reusing the 008 embedder). The maximum number of rounds is configurable (default 3).

## Aggregation methods (implement all, compare in 014)
| Method | How |
|---|---|
| Majority vote | each agent's final stance, equal weight |
| Confidence-weighted vote | weight = the agent's self-reported confidence |
| **Evidence-weighted vote (ours)** | weight = Σ argument strength (critic × verifier, from 009) |
| Judge panel | 3 judges from **different Groq model families** (e.g. GPT-OSS, Llama, Qwen) vote, and the majority wins |
| Bayesian per sub-claim | prior 0.5, updated per verified piece of evidence (log-odds from the verifier probabilities), then the sub-claims are combined |

## Confidence calibration
- Final confidence = the weighted vote share, then **temperature scaling** fitted on a validation split (from 014).
- Report ECE and a reliability diagram.

## Engine move to LangGraph
Nodes: `decompose → retrieve → opening → [critic → verify → revise] → rebuttal(loop) → converge? → aggregate → verdict`. State is checkpointed after each node, so a debate can be resumed or replayed in the UI. The event names emitted stay the same as in 007.

## Steps
- [ ] Convergence detector.
- [ ] 5 aggregators behind one interface, `aggregate(debate, method) -> Verdict`.
- [ ] Temperature-scaling calibration.
- [ ] LangGraph graph in `backend/app/engine/graph.py` replacing the plain loop (the old loop is kept until parity tests pass).
- [ ] UI: method selector + vote breakdown chart.
