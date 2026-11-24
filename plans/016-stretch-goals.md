# 016 — Stretch Goals (only if time allows)

**Depends on:** 001–015 core done. Pick at most 1–2. Each chosen goal gets its own numbered plan (018+) with a drift check and allowed dependencies before any work starts.

1. **Multimodal debate (closest to MAPS)**: add MAPS's Interpreter to caption diagrams and charts, so debates work on MathVista/EMMA-style questions and can be compared directly on the base paper's benchmarks. *Groq note:* this needs a vision-capable Groq model (e.g. Llama 4 Scout/Maverick). Check availability first.
2. **Human-in-the-loop**: the user joins as an agent and can add evidence or challenge a claim mid-debate.
3. **Learned aggregator**: a small logistic-regression or GBM model over debate features (strengths, stance shifts, verifier probabilities) that predicts correctness, for better calibration than hand-made weights.
4. **Personality learning**: tune trait intensities per task type automatically (grid or Bayesian search on the val set).
5. **Domain packs**: medical, legal or policy debate presets with curated trusted sources.
6. **Cost optimiser**: route easy questions to 1 agent and hard ones to the full debate, using a difficulty classifier. This is especially useful under Groq rate limits.
7. **Paper submission**: a workshop or student-track paper built from the 014 results.
