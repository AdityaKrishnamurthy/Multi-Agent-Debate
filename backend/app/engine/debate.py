"""
Debate engine MVP — plain async debate loop (005 §Step 6).

Protocol (with 2 advocates and 2 rebuttal rounds = 1 + 2 + 4 + 1 = 8 LLM calls):
1. Moderator restates the question and assigns Pro / Con stances.
2. Opening round: each advocate gives a position and 3 key points.
3. Rebuttal rounds: each advocate sees the transcript and attacks the opponent's weakest point.
4. Judge: reads the transcript and outputs a Verdict.
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.llm import complete, get_raw_model_id, usage_tracker
from app.schemas import (
    AdvocateOutput,
    AgentConfig,
    Argument,
    Debate,
    DebateConfig,
    JudgeOutput,
    ModeratorOutput,
    Round,
    Verdict,
    Vote,
)

logger = logging.getLogger(__name__)

_PROMPTS_DIR = Path(__file__).resolve().parent.parent / "agents" / "prompts"

EventCallback = Callable[[str, dict[str, Any]], Any] | None
CompleteFn = Callable[..., Awaitable[Any]]


def _load_prompt(name: str) -> str:
    return (_PROMPTS_DIR / f"{name}.md").read_text(encoding="utf-8")


def _emit(callback: EventCallback, event: str, data: dict[str, Any]) -> None:
    if callback is not None:
        callback(event, data)


def _format_transcript(debate: Debate, mod_output: ModeratorOutput | None = None) -> str:
    parts: list[str] = []
    if mod_output is not None:
        parts.append(f"Restated Question: {mod_output.restated_question}")
        if mod_output.sub_claims:
            parts.append("Sub-claims: " + "; ".join(mod_output.sub_claims))

    for rnd in debate.rounds:
        parts.append(f"\n=== Round {rnd.number} ({rnd.kind}) ===")
        for arg in rnd.arguments:
            parts.append(f"[{arg.id} | {arg.agent_id} | {arg.stance.upper()}]: {arg.text}")
            if arg.claims:
                parts.append("  Claims: " + " | ".join(arg.claims))
    return "\n".join(parts)


def _create_default_agents(num_advocates: int, profile: str | None) -> list[AgentConfig]:
    agents: list[AgentConfig] = [
        AgentConfig(
            id="moderator-1",
            name="Moderator",
            role="moderator",
            personality=None,
            stance="neutral",
            model=get_raw_model_id("moderator", profile),
        )
    ]

    names = [
        "Advocate Alpha",
        "Advocate Beta",
        "Advocate Gamma",
        "Advocate Delta",
        "Advocate Epsilon",
    ]
    for i in range(num_advocates):
        stance = "pro" if i % 2 == 0 else "con"
        agents.append(
            AgentConfig(
                id=f"advocate-{i + 1}",
                name=names[i] if i < len(names) else f"Advocate {i + 1}",
                role="advocate",
                personality=None,
                stance=stance,
                model=get_raw_model_id("debater", profile),
            )
        )

    agents.append(
        AgentConfig(
            id="judge-1",
            name="Judge",
            role="judge",
            personality=None,
            stance="neutral",
            model=get_raw_model_id("judge", profile),
        )
    )
    return agents


async def run_debate(
    question: str,
    num_agents: int = 2,
    num_rounds: int = 2,
    profile: str | None = None,
    on_event: EventCallback = None,
    complete_fn: CompleteFn = complete,
) -> Debate:
    """Run a debate from question to schema-valid Debate with Verdict."""
    usage_tracker.reset()
    debate_id = str(uuid.uuid4())[:8]
    agents = _create_default_agents(num_advocates=num_agents, profile=profile)
    advocates = [a for a in agents if a.role == "advocate"]

    config = DebateConfig(
        num_agents=num_agents,
        rounds=num_rounds,
        models={
            "moderator": get_raw_model_id("moderator", profile),
            "debater": get_raw_model_id("debater", profile),
            "judge": get_raw_model_id("judge", profile),
        },
        aggregation="majority",
    )

    debate = Debate(
        schema_version="1",
        id=debate_id,
        question=question,
        config=config,
        agents=agents,
        rounds=[],
        evidence=[],
        verdict=None,
        created_at=datetime.now(UTC).isoformat(),
    )

    _emit(on_event, "debate_started", {"id": debate_id, "question": question})

    # 1. Moderator restates question and confirms stance assignments
    mod_prompt = _load_prompt("moderator")
    agent_desc = ", ".join(f"{a.id} ({a.name}, default={a.stance})" for a in advocates)
    mod_output: ModeratorOutput = await complete_fn(
        role="moderator",
        system=mod_prompt,
        messages=[
            {
                "role": "user",
                "content": f"Question: {question}\n\nAdvocates: {agent_desc}",
            }
        ],
        schema=ModeratorOutput,
        profile=profile,
    )

    assignment_map = {item.agent_id: item.stance for item in mod_output.assignments}
    for adv in advocates:
        if adv.id in assignment_map:
            adv.stance = assignment_map[adv.id]

    # 2. Opening round
    adv_prompt_template = _load_prompt("advocate")
    opening = Round(number=1, kind="opening", arguments=[])
    _emit(on_event, "round_started", {"round": 1, "kind": "opening"})

    for adv in advocates:
        _emit(on_event, "agent_thinking", {"agent_id": adv.id})
        sys_prompt = adv_prompt_template.replace("{{stance}}", adv.stance.upper())
        adv_out: AdvocateOutput = await complete_fn(
            role="debater",
            system=sys_prompt,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Question: {question}\n"
                        f"Moderator framing: {mod_output.restated_question}\n"
                        f"Sub-claims: {mod_output.sub_claims}\n\n"
                        f"Deliver your opening statement for the {adv.stance.upper()} side "
                        "with 3 key points."
                    ),
                }
            ],
            schema=AdvocateOutput,
            profile=profile,
        )
        arg = Argument(
            id=f"arg-{debate_id}-1-{adv.id}",
            agent_id=adv.id,
            stance=adv.stance,
            text=adv_out.text,
            claims=adv_out.claims,
            rebuts=[],
            evidence_ids=adv_out.evidence_ids,
            confidence=adv_out.confidence,
        )
        opening.arguments.append(arg)
        _emit(on_event, "argument", arg.model_dump())

    debate.rounds.append(opening)

    # 3. Rebuttal rounds
    for rebuttal_idx in range(1, num_rounds + 1):
        round_num = rebuttal_idx + 1
        rnd = Round(number=round_num, kind="rebuttal", arguments=[])
        _emit(on_event, "round_started", {"round": round_num, "kind": "rebuttal"})

        for adv in advocates:
            _emit(on_event, "agent_thinking", {"agent_id": adv.id})
            transcript = _format_transcript(debate, mod_output)
            opp_ids = [
                a.id for prev in debate.rounds for a in prev.arguments if a.stance != adv.stance
            ]
            sys_prompt = adv_prompt_template.replace("{{stance}}", adv.stance.upper())
            adv_out = await complete_fn(
                role="debater",
                system=sys_prompt,
                messages=[
                    {
                        "role": "user",
                        "content": (
                            f"Question: {question}\n\n"
                            f"Transcript so far:\n{transcript}\n\n"
                            f"This is Rebuttal Round {rebuttal_idx}. Identify and attack your "
                            f"opponent's weakest point while defending {adv.stance.upper()}. "
                            f"Opponent argument IDs available to rebut: {opp_ids}"
                        ),
                    }
                ],
                schema=AdvocateOutput,
                profile=profile,
            )
            rebuts = [rid for rid in adv_out.rebuts if rid in opp_ids] or opp_ids[-1:]
            arg = Argument(
                id=f"arg-{debate_id}-{round_num}-{adv.id}",
                agent_id=adv.id,
                stance=adv.stance,
                text=adv_out.text,
                claims=adv_out.claims,
                rebuts=rebuts,
                evidence_ids=adv_out.evidence_ids,
                confidence=adv_out.confidence,
            )
            rnd.arguments.append(arg)
            _emit(on_event, "argument", arg.model_dump())

        debate.rounds.append(rnd)

    # 4. Judge verdict
    judge = next(a for a in agents if a.role == "judge")
    _emit(on_event, "agent_thinking", {"agent_id": judge.id})
    judge_prompt = _load_prompt("judge")
    full_transcript = _format_transcript(debate, mod_output)

    judge_out: JudgeOutput = await complete_fn(
        role="judge",
        system=judge_prompt,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Question: {question}\n\n"
                    f"Full Transcript:\n{full_transcript}\n\n"
                    "Render your final verdict."
                ),
            }
        ],
        schema=JudgeOutput,
        profile=profile,
    )

    verdict = Verdict(
        decision=judge_out.decision,
        confidence=judge_out.confidence,
        reasoning=judge_out.reasoning,
        winning_points=judge_out.winning_points,
        open_disagreements=judge_out.open_disagreements,
        votes=[Vote(agent_id=judge.id, choice=judge_out.decision, weight=1.0)],
    )
    debate.verdict = verdict
    _emit(on_event, "verdict", verdict.model_dump())

    return debate
