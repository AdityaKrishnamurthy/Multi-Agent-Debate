"""Unit tests for the MVP debate engine with a fake complete()."""

from __future__ import annotations

import pytest

from app.engine.debate import run_debate
from app.schemas import (
    AdvocateOutput,
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
    )

    validated = Debate.model_validate(debate.model_dump())
    assert validated.schema_version == "1"
    # 1 moderator + 2 opening + 4 rebuttal (2 rounds x 2 advocates) + 1 judge = 8 calls
    assert len(calls) == 8
    assert len(validated.rounds) == 3
    assert validated.rounds[0].kind == "opening"
    assert validated.rounds[1].kind == "rebuttal"
    assert validated.rounds[2].kind == "rebuttal"
    assert validated.verdict is not None
    assert validated.verdict.decision == "Pro wins"
    assert "verdict" in events
