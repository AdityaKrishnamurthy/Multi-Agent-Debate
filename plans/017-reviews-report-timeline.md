# 017 — Reviews, Report & Timeline

> **Type:** Reference. Fill in the real review dates once the college confirms them.

| Review | Date |
|---|---|
| Phase 1 | TBD (a couple of days after 2026-11-24) |
| Phase 2 | TBD |
| Final | TBD |

## Timeline (~14–16 weeks; adjust to the college calendar)
| Weeks | Work | Plans |
|---|---|---|
| 0 (now) | Setup, paper study, mock UI, CLI MVP | 001–005 |
| 1–2 | Personality agents, repo infra, API + streaming | 006, 003-B, 007 |
| 3–4 | Retrieval, Critic + NLI verifier | 008, 009 |
| 5–6 | Aggregation, LangGraph, full UI | 010, 011 |
| 7–8 | Dataset runs on Kaggle (vLLM, open 7B) + human labels | 012 |
| 9–10 | Verifier fine-tuning (DeBERTa; optional Qwen LoRA) + integration | 013 |
| 11–12 | Benchmarks, baselines, ablations on Kaggle (~2 weeks of free GPU quota) | 014 |
| 13–14 | Deploy, demo, report, paper | 015, 017 |

## Phase 1 review: what to show
1. **Problem & motivation**: single-LLM hallucination, and the need for evidence and collective decisions.
2. **Literature**: a summary of MAPS (the base paper) and its gaps; Du et al. 2023, "Improving Factuality and Reasoning in Language Models through Multiagent Debate"; Liang et al. 2023 (MAD, divergent thinking); Irving et al. 2018, "AI Safety via Debate"; Khan et al. 2024, "Debating with More Persuasive LLMs Leads to More Truthful Answers"; and the FEVER fact-verification line of work.
3. **Proposed system**: the architecture diagram (002), the personality-role mapping (006) and the novelty table (001).
4. **Live demo**: the mock UI (004) replaying a debate, plus one real CLI debate on Groq (005). Have a pre-saved run ready in case of rate limits or no Wi-Fi.
5. **Plan**: timeline, datasets, evaluation metrics and team split. Cover the own-work contributions (**own model** `mad-verifier` + **own dataset** MAD-Transcripts) and the zero-cost compute plan (Groq free tier for demos, open models on Kaggle for experiments, Ollama offline).

Slides: about 12. Each member presents their own part.

## Phase 2 review
A working end-to-end app with real retrieval, the Critic, the zero-shot verifier, aggregation and the live UI, plus the first benchmark numbers on 1 dataset.

## Final review
The trained verifier, full results and ablation tables, the deployed demo, the report, the demo video and (optionally) a paper draft.

## Report outline
1. Introduction 2. Literature survey 3. Problem statement & objectives 4. System design 5. Methodology (debate protocol, personalities, retrieval, verification, aggregation, verifier training) 6. Implementation 7. Datasets 8. Experiments & results 9. Ablations & error analysis 10. Limitations & ethics (cost, rate limits, bias in sources, persuasion ≠ truth, open-weight models vs GPT-4o in the base paper) 11. Conclusion & future work. References.
