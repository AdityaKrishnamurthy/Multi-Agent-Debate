# 009 — Critic & Citation Verification

**Goal:** catch hallucinations and weak reasoning. This takes the Critic from MAPS and extends it to check *evidence* as well as reasoning.

**Depends on:** 006 (Critic loop), 008 (evidence)
**Drift check:**
```bash
test -d backend/app/retrieval && grep -rq "evidence_ids" backend/app/schemas.py \
  && grep -rq "critique" backend/app/engine && echo OK
```
**Allowed dependencies:** `transformers`, `torch` (CPU build is fine), `rapidfuzz`.
**Done when:** a test debate with a deliberately fabricated citation (both a quote missing from the source and a quote that contradicts the claim) gets flagged automatically.

## Two checks per argument
1. **Reasoning check (LLM Critic, Socratic; reuses 006)**
   - Asks targeted questions: "Which evidence supports claim 2?", "Does this follow?", "Is this a generalisation?"
   - Tags issues as `unsupported`, `misquoted`, `fallacy:<type>`, `irrelevant` or `contradiction`, and gives a score from 0 to 5.
2. **Citation check (Verifier)**, run locally with no Groq calls
   - Each (claim, cited evidence) pair gets `SUPPORTS / REFUTES / NOT_ENOUGH_INFO` plus a probability.
   - v1: an off-the-shelf NLI checkpoint, e.g. `MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli` (confirm on the HF Hub when implementing; use the base size for CPU speed).
   - v2: **our fine-tuned verifier** (013), behind the same `verify()` interface.
   - A quote-existence check confirms that the quoted text is in the source chunk (`rapidfuzz` partial ratio ≥ 90), which catches fabricated quotes.

## Output per argument
```
strength = f(critic_score, mean verifier support prob, #valid citations)   → Argument.strength (0–1)
```
The aggregator (010) uses this value, and the UI shows it as a green, amber or red border.

## Feedback loop
A weak argument (strength < τ) means its author must revise it or withdraw the claim, using the 006 loop. Revisions are logged, which provides training data for 012.

## Steps
- [ ] Critic prompt + issue taxonomy.
- [ ] `verify(claim, evidence) -> (label, prob)`, batched → a unit test on 3 hand-made pairs gives the expected labels.
- [ ] Quote-existence check.
- [ ] Strength formula + revise loop.
- [ ] UI: critique cards + strength colouring.
