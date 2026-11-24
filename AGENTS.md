# AGENTS.md

## Project Structure
- `plans/` — numbered plan files (`001`, `002`, ...) plus `PLANS.md`, the status table for all plans.


## Planning Workflow
1. Work one plan at a time, in order, unless told otherwise.
2. Run the plan's drift-check command first. If the repo doesn't match what the plan assumed, stop and report the mismatch — don't improvise a fix.
3. Follow the plan step by step. If a step's stated result doesn't happen, stop and report it — don't silently "improve" or reinterpret the step.
4. No dependencies beyond what the plan explicitly names. If you think you need one, stop and ask.
5. Update the `PLANS.md` when a plan is completed.

## Stop Conditions
Stop and ask the user — don't pick something yourself — if:
- A plan's drift-check fails.
- You're about to add a package not named in the plan.
- Something breaks mid-plan and can't be fixed quickly — propose a fix or revert, don't act unilaterally.
