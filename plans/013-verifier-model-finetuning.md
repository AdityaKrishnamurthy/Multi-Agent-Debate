# 013 — Verifier Model Fine-Tuning (our own model)

**Goal:** train a small, fast model that decides whether evidence **supports / refutes / doesn't address** a claim, and plug it into the debate (009, 010). This is the project's **own model** contribution: we fine-tune open-source models on our own dataset (012). We do **not** train an LLM from scratch. No API is used, and everything runs on free GPUs.

**Depends on:** 012
**Drift check:**
```bash
ls ml/data/*pairs*.jsonl >/dev/null 2>&1 && test -f ml/data/DATASHEET.md \
  && grep -rq "def verify" backend/app/verifier && echo OK
```
**Allowed dependencies (in `ml/`, separate from the backend):** `transformers`, `datasets`, `accelerate`, `scikit-learn`, `torch`, `peft` (LoRA), `bitsandbytes` (4-bit for option B); optional: `wandb`.
**Done when:** the fine-tuned model beats the zero-shot NLI baseline on macro-F1 on our test split, and is loaded by `backend/app/verifier` through the same `verify()` interface.

## Model options
| Option | Size | Compute | Role |
|---|---|---|---|
| **A. DeBERTa-v3-base, full fine-tune** (primary) | 184M | free Colab/Kaggle T4, ~1–2 h | the main verifier; fast enough for CPU inference in the backend |
| A+. DeBERTa-v3-large | 435M | Kaggle T4 (fp16, small batch + gradient accumulation) | extra accuracy if time allows |
| **B. Qwen2.5-1.5B or 3B + LoRA (QLoRA 4-bit)** | 1.5–3B | Kaggle T4 | "modify an open model": labels and writes a one-line rationale; compared against A in 014 |

Do at least A. B is the LoRA work and is recommended if there is time, because it gives the report a "classifier vs small generative LLM" comparison. The laptop (4 GB VRAM) is only for inference tests; train on Kaggle/Colab.

## Training recipe (A)
1. Start from an MNLI/FEVER-trained checkpoint (the same family as 009 v1).
2. Stage 1: fine-tune on FEVER + SciFact (claim, evidence) → S/R/NEI.
3. Stage 2: fine-tune on **MAD-Transcripts** (012), including the hard negatives.
4. Input: `[CLS] claim [SEP] evidence [SEP]`, max 512 tokens. Loss: class-weighted cross-entropy.
5. HF `Trainer`, lr 2e-5, batch 16 (or 8 × 2 accumulation), 3 epochs, fp16, early stopping on val macro-F1, fixed seed.
6. Calibrate the output probabilities with temperature scaling.

## Training recipe (B, LoRA)
QLoRA with r=16, alpha=32, on the attention + MLP projections; prompt = claim + evidence → `{"label": ..., "rationale": ...}`. Train on the same data and splits as A, for 1–2 epochs.

## Evaluation
- Macro-F1, accuracy, per-class F1 and ECE on our test split plus the FEVER/SciFact dev sets.
- Compare zero-shot NLI vs A stage 1 vs A stage 1+2 vs B vs a prompted 7B LLM-as-verifier (accuracy, latency, model size).

## Integration
- Serve option A through `backend/app/verifier/` (loaded once, batch inference, CPU is fine).
- Push the weights to the Hugging Face Hub (`<team>/mad-verifier`) with a model card. Publishing is outward-facing, so confirm with the team first.

## Steps
- [ ] Training notebook + script (`ml/train_verifier.py`) → a 1-epoch smoke run on 1k pairs finishes on Kaggle.
- [ ] Stage 1 and stage 2 runs of A, logged to W&B or CSV.
- [ ] (Optional) B with LoRA.
- [ ] Eval report table.
- [ ] Swap into the 009 pipeline; re-run the 014 evaluation.
