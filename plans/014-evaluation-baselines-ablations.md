# 014 — Evaluation, Baselines & Ablations

**Goal:** prove with numbers that Multi-Agent-Debate beats simpler approaches, and explain *why* through ablations, like MAPS Table 1 and its ablation table.

**Depends on:** 010, 013 (013 is only needed for the "trained verifier" rows; every other row can run earlier)
**Drift check:**
```bash
ls ml/data/*/test*.jsonl >/dev/null 2>&1 && grep -rq "def aggregate" backend/app/engine \
  && grep -q "kaggle" backend/app/config/models.yaml && echo OK
```
**Allowed dependencies (in `eval/`):** `pandas`, `scikit-learn`, `matplotlib`, `scipy`. In the Kaggle notebook: `vllm`.
**Done when:** the main results table, the ablation table, the reliability diagrams and the cost-vs-accuracy plot are generated from `eval/results/*.json` by a single script.

## Compute: free open models only
- **All systems are run on the same open model** (e.g. `Qwen2.5-7B-Instruct`), served by vLLM on Kaggle (profile `kaggle`; see 012). This makes the comparison fair and fully reproducible: anyone can rerun it with the same open weights.
- Mixed-model runs (the judge panel, the heterogeneity ablation) add a second 7–8B model, such as `Llama-3.1-8B-Instruct`, on the second T4.
- **Optional scale check:** 50 questions × {best baseline, full system} on a large model via the **Groq free tier**, spread over several days. This shows whether the improvement still holds at about 100B scale. Do it only if time allows.

### Will results be "good" on a 7B model?
Absolute accuracy will be lower than GPT-4o's in the MAPS paper. Our claim, though, is **relative**: debate + evidence + verifier vs the baselines **on the same model**. Retrieval and verification usually help smaller models *more*, because those models hallucinate more. Report that honestly, together with the optional scale check.

## Baselines (same model)
1. Single LLM, direct answer
2. Chain-of-Thought
3. Self-consistency (5 samples, majority)
4. **MAPS-style pipeline**: 5 cooperative personality agents + Critic, with no debate and no retrieval. This re-implements the base paper on our model.
5. Plain multi-agent debate (Du et al. 2023 style; no evidence, no personalities)
6. **Multi-Agent-Debate (full)**

## Metrics
| Metric | What it shows |
|---|---|
| Accuracy / macro-F1 | correctness of the verdict |
| ECE + Brier score | calibration of the confidence |
| Citation precision | % of cited evidence that truly supports its claim |
| Hallucinated-citation rate | % of fabricated or misquoted citations |
| Rounds to converge | efficiency |
| Tokens, GPU-seconds, latency per question | practicality (no $; everything is free) |

## Ablations (drop one thing at a time)
- − retrieval; − Critic / − revise loop; − trained verifier (zero-shot NLI / none); − personalities
- each Big Five trait removed (mirroring MAPS)
- number of agents: 2 / 3 / 5; number of rounds: 1 / 2 / 3 / 4
- aggregation: majority vs confidence vs evidence-weighted vs judge vs Bayesian (no extra LLM calls, because these re-aggregate saved debates)
- same model for all agents vs mixed model families

## Sizing (Kaggle, ~30 GPU-h/week)
| Run | Size | Approx. GPU time |
|---|---|---|
| Headline table | 3 datasets (FEVER, SciFact, StrategyQA) × 300 questions × 6 systems | ~6–8 h |
| Ablations | 1 dataset × 150 questions × ~12 configs | ~6–10 h |
| Re-aggregation ablations | saved transcripts | ~0 |

That is about **2 weeks of free quota**, in line with the timeline (017). `eval/run.py --dry-run` prints the estimated tokens and GPU time before launching anything. Retrieval uses the local dataset corpora (012), not paid search.

## Setup
- `eval/run.py --system mad --dataset fever --n 300 --seed 0 --profile kaggle` → `eval/results/*.json` (config, model ids, seed, usage, predictions).
- Fixed seeds, temperature 0 wherever the method allows, fixed subsets and cached retrieval make runs reproducible.
- Significance: bootstrap 95% CI, or a McNemar test against the best baseline.

## Deliverables
- Main results table, ablation table, reliability diagrams, cost-vs-accuracy plot.
- Error analysis: 20 failure cases, categorised (bad retrieval, verifier error, groupthink, judge error).
