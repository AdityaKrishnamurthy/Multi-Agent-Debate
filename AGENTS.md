# AGENTS.md

## Project Structure
- `plans/` — numbered plan files (`001`, `002`, ...) plus `PLANS.md`, the status table for all plans.


## Planning Workflow
1. Work one plan at a time, in order, unless told otherwise.
2. Run the plan's drift-check command first. If the repo doesn't match what the plan assumed, stop and report the mismatch — don't improvise a fix.
3. Follow the plan step by step. If a step's stated result doesn't happen, stop and report it — don't silently "improve" or reinterpret the step.
4. No dependencies beyond what the plan explicitly names. If you think you need one, stop and ask.
5. Update the `PLANS.md` when a plan is completed.

## Git Workflow
- Commit once per meaningful unit of work, such as a feature, a step group or a fix. A single commit for a whole plan is too coarse, and one commit per file is too fine. Most plans should end up with several commits.
- Each commit should leave the repo working (build, lint and tests pass for the touched area), so any commit can be reverted on its own.
- Write short, plain commit messages in the imperative, e.g. `Add debate API with live streaming`, `Fix header navigation scrolling`, `Update plan status`. Don't use prefixes like `feat:`, `fix(...)`, `docs:` or `chore:`, and keep it to one line unless a body is really needed.
- Keep unrelated changes in separate commits. For example, don't mix a refactor with a new feature, or a dependency bump with logic changes.
- Commit dependency additions (`pyproject.toml`/`uv.lock`, `package.json`/`package-lock.json`) together with the code that first uses them.
- Never commit secrets (`.env`), generated output (`backend/runs/`, `.next/`, `node_modules/`) or `resources/`.
- Work on a branch per plan (`feat/<plan#>-<short>`, e.g. `feat/007-api`) and merge into `main` when the plan is done. Don't force-push `main`.
- Don't add AI co-author or "Generated with" lines to commits.

## Stop Conditions
Stop and ask the user — don't pick something yourself — if:
- A plan's drift-check fails.
- You're about to add a package not named in the plan.
- Something breaks mid-plan and can't be fixed quickly — propose a fix or revert, don't act unilaterally.
