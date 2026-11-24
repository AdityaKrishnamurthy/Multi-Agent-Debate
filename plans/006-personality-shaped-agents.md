# 006 — Personality-Shaped Agents (MAPS adaptation)

**Goal:** bring the base paper's key idea, Big Five personality shaping, into a *debate* setting, so that agent diversity is principled rather than random.

**Depends on:** 005
**Drift check:**
```bash
test -f backend/app/engine/debate.py && test -f backend/app/llm.py && test -f backend/app/config/models.yaml \
  && ls backend/app/agents/prompts/advocate.md >/dev/null && echo OK
```
**Allowed dependencies:** none new (`pyyaml` already added in 005).
**Done when:** a CLI debate runs with all 5 roles, and in a test the Critic triggers a revision of a deliberately weak argument.

## Mapping MAPS roles → debate roles
| Big Five trait | MAPS role | Multi-Agent-Debate role | Behaviour in debate |
|---|---|---|---|
| Openness | Interpreter | **Explorer** | proposes alternative interpretations and searches broadly for evidence (from 008) |
| Agreeableness | Aligner | **Moderator / Synthesizer** | aligns sub-claims and summarises common ground each round |
| Conscientiousness | Scholar | **Scholar** | rigorous; cites precise evidence and domain knowledge |
| Extraversion | Solver | **Advocate (Pro / Con)** | assertive; commits to a stance and argues persuasively |
| Neuroticism | Critic | **Critic / Skeptic** | asks Socratic questions; flags weak or unsupported steps |

## Implementation
- A personality is a prompt block plus sampling parameters, stored in `backend/app/config/personalities.yaml`:
  ```yaml
  critic:
    trait: neuroticism
    level: high
    style: "Doubt every claim. Ask 'what evidence supports this?' ..."
    temperature: 0.3
  ```
- `AgentFactory(role, personality, model, stance)` builds the system prompt from the role template, the personality block and the rules (cite evidence ids once 008 exists).
- Optional heterogeneity: different Groq model families per agent (GPT-OSS / Llama / Qwen). This also spreads the load across per-model rate limits.

## MAPS Critic loop, adapted (reasoning only; 009 adds citation checks)
After each round, the Critic scores every argument from 0 to 5 on evidence support, logical validity and relevance, and fills `Argument.critique`. An argument scoring below the threshold τ (default 2.5) must be **revised** by its author, which is MAPS's "re-run the weakest stage". There is at most 1 revision per argument per round. 009 reuses this same loop.

## Groq budget
With 5 roles, a debate makes about 15–25 calls. Spread the roles over at least 2 models to stay under the per-model TPM limit.

## Steps
- [ ] Write 5 personality blocks + `personalities.yaml` → the YAML loads into a typed config.
- [ ] `AgentFactory` → a unit test checks that the system prompt contains both the role and the personality text.
- [ ] Critic scoring + revise loop → a test with a fake LLM shows that a low score causes exactly 1 revision.
- [ ] The `personality` field is filled in the output JSON → 004 badges show real values when replayed.

## Experiments this enables (feeds 014)
Personality agents vs identical "plain" agents; drop one trait at a time (mirroring the MAPS ablation); high vs low trait intensity.
