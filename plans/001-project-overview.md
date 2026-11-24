# 001 — Project Overview & Scope

> **Type:** Reference. There is nothing to build here.

**Project:** Multi-Agent-Debate — *Multi-Agent Debate for Evidence-Based Reasoning and Collective Decision Making*
**Repo name:** `Multi-Agent-Debate`
**Base paper (from mentor):** MAPS: Multi-Agent Personality Shaping for Collaborative Reasoning (arXiv:2503.16905, AAAI 2026) — `resources/MAPS-2503.16905v2.pdf` (local only, not committed)

## Problem
When a single LLM answers a hard question, it tends to hallucinate, sound overconfident and cite nothing. Multi-agent systems help. However, most of them, MAPS included, are *cooperative pipelines*: the agents never argue, nobody verifies the evidence, and there is no calibrated group decision.

## What MAPS does (what we build on)
- 5 agents, each shaped by a Big Five personality trait:
  Interpreter (Openness), Aligner (Agreeableness), Scholar (Conscientiousness), Solver (Extraversion), Critic (Neuroticism).
- The agents run in a fixed order. The **Critic** scores every stage with Socratic questions, and the weakest stage is re-run if its score falls below a threshold.
- No training: prompts only, using GPT-4o, on multimodal math and science benchmarks. It scores about 15.8 points above the best baseline.

## What we add (our contribution)
| Gap in MAPS | Multi-Agent-Debate |
|---|---|
| Agents cooperate and never disagree | **Adversarial debate**: personality-shaped agents take stances and defend them over several rounds |
| Knowledge comes from the model itself | **Evidence retrieval** from the web, papers and uploaded PDFs; every claim must cite evidence |
| The Critic only scores reasoning | **Critic + citation verification**, which checks that quotes actually support the claims |
| No aggregation, just one answer | **Collective decision** by evidence-weighted voting or a judge panel, giving a verdict plus a **confidence** score |
| No training | **Our own trained verifier model** that labels claim and evidence pairs as supports / refutes / not enough info |
| No transparency UI | **Web app** showing the live debate, evidence cards, an argument graph and a verdict dashboard |

## Goals (measurable)
1. Higher accuracy than a single LLM, chain-of-thought, self-consistency and a MAPS-style pipeline on fact-checking and decision benchmarks, all using the **same base LLM**.
2. A lower rate of hallucinated citations.
3. Better calibration of the final confidence (lower ECE).
4. A released debate-with-evidence dataset and a fine-tuned verifier.

## Own work: model + dataset (the mentor's requirement)
The mentor asked us to build at least one of the two ourselves. We do **both**:
- **Own model (primary):** `mad-verifier`, an open-source DeBERTa-v3 that we fine-tune, plus an optional Qwen2.5 + LoRA variant (013).
- **Own dataset:** MAD-Transcripts, debate transcripts with auto- and human-labelled claim–evidence pairs, including fabricated-citation hard negatives (012).

If time runs short, the model stays and the dataset shrinks. The model can be trained on public FEVER/SciFact data alone.

## Constraints
- **No paid API keys.** Everything uses free tiers or open-source models:
  - **Groq free tier** for interactive debates and demos (005–011).
  - **Open models on free Kaggle/Colab GPUs** (vLLM) for dataset runs and evaluation (012–014).
  - **Ollama on the laptop** for offline testing and demos.
- The MAPS paper used GPT-4o, so our absolute numbers can't be compared with the paper's. Plan 014 re-implements MAPS-style behaviour on the **same open model** as our system, so the comparison is fair and reproducible.

## Out of scope
Training a foundation LLM. Multimodal (diagram) reasoning is an optional stretch goal only (see 016).

## Plan index
See [`PLANS.md`](PLANS.md) for the list of plans, their order and their status. That file is the single source of truth.
