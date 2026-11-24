# 012 — Dataset Construction (our own dataset: MAD-Transcripts)

**Goal:** (a) benchmark sets to evaluate on, and (b) our **own dataset** of debate transcripts with labelled claim–evidence pairs, used to train the verifier (013) and to publish. This is one of the two "own work" contributions; the other is the model (013).

**Depends on:** 010
**Drift check:**
```bash
test -f backend/app/engine/graph.py && grep -rq "def aggregate" backend/app/engine \
  && grep -q "profiles:" backend/app/config/models.yaml && echo OK
```
**Allowed dependencies:** `datasets` (HF), `pandas`. In the Kaggle notebook environment only: `vllm`.
**Done when:** `ml/data/` holds the benchmark subsets, a MAD-Transcripts JSONL with train/val/test splits, 500 human-labelled pairs with κ reported, and `DATASHEET.md`.

## Compute: no paid API, only free open-source models
| Where | What runs there | Why |
|---|---|---|
| **Kaggle notebook** (free 2×T4, ~30 GPU-h/week, 12 h sessions, internet on) | **vLLM** serving an open model such as `Qwen2.5-7B-Instruct` (AWQ 4-bit) with an OpenAI-compatible API → LiteLLM profile `kaggle` | the only free option fast enough for hundreds of debates |
| Colab free T4 | the same setup, as a backup when the Kaggle quota runs out | |
| Laptop (RTX 3050, 4 GB) | Ollama + a 3B model (`qwen2.5:3b`) → profile `local`, for **pipeline testing only** | 7–8B models don't fit in 4 GB VRAM, and CPU offload is too slow for batch runs |
| Groq free tier | not used for bulk runs | daily token cap per model |

The engine needs no code changes: it already calls models through LiteLLM and `models.yaml` (see 002 §Model backends). Run with `--profile kaggle`.

**Sizing:** use a vLLM throughput of roughly 300–800 output tokens/s on a T4 for a 7B model, and measure it in the pilot (step 3). A debate produces about 5k output tokens, so it takes **10–20 s**, and **1,000 debates take about 3–6 GPU-hours**. That fits in one week of Kaggle quota.

**Evidence without paid search:** Tavily's free credits are reserved for the live demo. For dataset runs, retrieval (008) runs over the **dataset's own corpus**: the FEVER Wikipedia pages and the SciFact abstracts, indexed locally in pgvector, or in a local file index inside the Kaggle notebook. This is also more faithful to how these benchmarks are meant to be used.

## A. Public datasets (evaluation + verifier pre-training)
| Dataset | Type | Use |
|---|---|---|
| FEVER | claim + Wikipedia evidence, S/R/NEI | verifier training, fact-check eval |
| SciFact | scientific claims + abstracts | verifier, scientific eval |
| AVeriTeC | real-world claims + web evidence (shipped with the dataset) | realistic eval |
| StrategyQA | yes/no multi-hop questions | reasoning/decision eval |
| TruthfulQA | misconception questions | hallucination eval |
| (optional) MathVista subset | MAPS's benchmark | comparison with the base paper (needs vision; see 016) |

Sample fixed subsets with a fixed seed: 300 test / 200 val per dataset. Store them under `ml/data/`: raw data is git-ignored, and the scripts are committed. Check each licence before redistributing.

## B. Our dataset: **MAD-Transcripts**
1. Run the full system on about **1,000 training-split questions** from FEVER, SciFact and StrategyQA.
2. Log every `(claim, cited evidence, verifier prob, critic tags, revised?, final verdict, gold label, model id)`.
3. **Auto-labels:** the claim support label, derived from the gold dataset labels plus evidence overlap.
4. **Human labels:** the team annotates about 500 claim–evidence pairs (supports / refutes / NEI / fabricated) in a Google Sheet or Label Studio. Measure Cohen's κ on 100 shared pairs.
5. Hard negatives: fabricated or misquoted citations produced by the agents. These are very valuable for training, and a 7B model produces plenty of them.

## Format
JSONL with one row per claim–evidence pair, plus one file per debate transcript (002 schema). `ml/data/DATASHEET.md` covers the sources, licence, collection process (including the model ids used), label definitions and statistics.

## Steps
| # | Step | Expected result |
|---|---|---|
| 1 | Download + subset scripts | fixed subsets under `ml/data/`, with the seed logged |
| 2 | Local corpus index for FEVER/SciFact | a test query returns gold evidence in the top 5 for most samples |
| 3 | Kaggle notebook: vLLM + 10-debate pilot via `--profile kaggle` | 10 schema-valid debates, with tokens/s measured and recorded here |
| 4 | Batch-run harness: resumable (skips finished ids), checkpoints to the Kaggle output dir | a killed session resumes without redoing finished debates |
| 5 | Full run (~1,000 debates, spread over sessions) + export pairs to JSONL | JSONL row count logged in `DATASHEET.md` |
| 6 | Annotation guideline + 500 human labels + κ | κ reported |
| 7 | Train/val/test split, by debate, with no leakage | no debate id appears in two splits (checked by a script) |

If step 3's measured throughput is below 200 tok/s, stop and re-size: use fewer debates, or switch to a smaller model.
