"""Unit tests for the debate engine, 5-role MAPS mode, and Critic revision loop (005 + 006)."""

from __future__ import annotations

import pytest

from app.engine.debate import run_debate
from app.schemas import (
    AdvocateOutput,
    CriticOutput,
    CritiqueIssue,
    Debate,
    JudgeOutput,
    ModeratorOutput,
    StanceAssignment,
)


@pytest.mark.asyncio
async def test_run_debate_produces_schema_valid_debate():
    calls: list[str] = []

    async def fake_complete(
        role: str, system: str, messages: list[dict[str, str]], schema, **kwargs
    ):
        calls.append(role)
        if schema is ModeratorOutput:
            return ModeratorOutput(
                restated_question="Should colleges move to a 4-day schedule?",
                sub_claims=["Well-being", "Learning outcomes", "Operations"],
                assignments=[
                    StanceAssignment(agent_id="advocate-1", stance="pro"),
                    StanceAssignment(agent_id="advocate-2", stance="con"),
                ],
            )
        if schema is AdvocateOutput:
            return AdvocateOutput(
                text="Structured argument point.",
                claims=["Point A", "Point B", "Point C"],
                rebuts=[],
                evidence_ids=[],
                confidence=0.8,
            )
        if schema is JudgeOutput:
            return JudgeOutput(
                decision="Pro wins",
                confidence=0.76,
                reasoning="Pro presented clearer trade-offs.",
                winning_points=["Point A"],
                open_disagreements=["Long-term STEM pass rates"],
            )
        raise AssertionError(f"Unexpected schema: {schema}")

    events: list[str] = []
    debate = await run_debate(
        question="Should our college switch to a 4-day week?",
        num_agents=2,
        num_rounds=2,
        on_event=lambda ev, _data: events.append(ev),
        complete_fn=fake_complete,
        enable_critic=False,
    )

    validated = Debate.model_validate(debate.model_dump())
    assert validated.schema_version == "1"
    # 1 moderator + 2 opening + 4 rebuttal + 1 judge = 8 calls when critic disabled
    assert len(calls) == 8
    assert len(validated.rounds) == 3
    assert validated.verdict is not None
    assert "verdict" in events


@pytest.mark.asyncio
async def test_critic_triggers_exactly_one_revision_on_low_score():
    critic_scores = iter([1.5, 4.2])
    revision_count = 0

    async def fake_complete(
        role: str, system: str, messages: list[dict[str, str]], schema, **kwargs
    ):
        nonlocal revision_count
        if schema is ModeratorOutput:
            return ModeratorOutput(
                restated_question="Test question?",
                sub_claims=["Sub-claim 1"],
                assignments=[
                    StanceAssignment(agent_id="advocate-1", stance="pro"),
                    StanceAssignment(agent_id="advocate-2", stance="con"),
                ],
            )
        if schema is AdvocateOutput:
            user_msg = messages[-1]["content"]
            if "scored" in user_msg and "Revise" in user_msg:
                revision_count += 1
                return AdvocateOutput(
                    text="Revised strong argument.",
                    claims=["Revised claim"],
                    rebuts=[],
                    evidence_ids=[],
                    confidence=0.75,
                )
            return AdvocateOutput(
                text="Initial argument.",
                claims=["Claim"],
                rebuts=[],
                evidence_ids=[],
                confidence=0.7,
            )
        if schema is CriticOutput:
            score = next(critic_scores)
            issues = (
                [CritiqueIssue(type="unsupported", note="Needs evidence")] if score < 2.5 else []
            )
            return CriticOutput(score=score, issues=issues, questions=["Why?"])
        if schema is JudgeOutput:
            return JudgeOutput(
                decision="Con wins",
                confidence=0.8,
                reasoning="Con had no low-score critique.",
                winning_points=["Sound logic"],
                open_disagreements=[],
            )
        raise AssertionError(f"Unexpected schema: {schema}")

    debate = await run_debate(
        question="Test question?",
        num_agents=2,
        num_rounds=0,  # opening round only
        complete_fn=fake_complete,
        enable_critic=True,
    )

    # Only advocate-1 scored 1.5 (< 2.5), so exactly 1 revision was triggered
    assert revision_count == 1
    opening_args = debate.rounds[0].arguments
    assert len(opening_args) == 3  # advocate-1, advocate-2, advocate-1-rev
    assert opening_args[0].critique is not None
    assert opening_args[0].critique.score == 1.5
    assert opening_args[2].id.endswith("-rev")
    assert all(a.personality is not None for a in debate.agents)


@pytest.mark.asyncio
async def test_all_five_maps_roles_run_together():
    seen_roles: set[str] = set()

    async def fake_complete(
        role: str, system: str, messages: list[dict[str, str]], schema, **kwargs
    ):
        seen_roles.add(role)
        if schema is ModeratorOutput:
            return ModeratorOutput(
                restated_question="All roles test?",
                sub_claims=["C1", "C2"],
                assignments=[],
            )
        if schema is AdvocateOutput:
            return AdvocateOutput(
                text="Role-aligned argument.",
                claims=["Point 1", "Point 2", "Point 3"],
                rebuts=[],
                evidence_ids=[],
                confidence=0.75,
            )
        if schema is CriticOutput:
            return CriticOutput(score=4.0, issues=[], questions=["Any caveat?"])
        if schema is JudgeOutput:
            return JudgeOutput(
                decision="Pro wins",
                confidence=0.72,
                reasoning="Strong collaboration across roles.",
                winning_points=["Point 1"],
                open_disagreements=[],
            )
        raise AssertionError(f"Unexpected schema: {schema}")

    debate = await run_debate(
        question="All roles test?",
        num_agents=3,
        num_rounds=1,
        all_roles=True,
        complete_fn=fake_complete,
    )

    agent_roles = {a.role for a in debate.agents}
    assert {"moderator", "advocate", "scholar", "explorer", "critic", "judge"} <= agent_roles
    assert {"moderator", "debater", "scholar", "explorer", "critic", "judge"} <= seen_roles
    assert debate.verdict is not None
