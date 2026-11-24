"""
Debate engine — personality-shaped agents + MAPS Critic revision loop (005 + 006).

Protocol:
1. Moderator (Agreeableness) restates the question and assigns stances.
2. Opening round: debaters (Advocate, Scholar, Explorer) present opening positions.
3. Critic (Neuroticism) scores each argument (0-5). Any argument scoring below
   `critic_threshold` (default 2.5) triggers at most 1 revision by its author.
4. Rebuttal rounds: debaters attack the opponent's weakest points, followed by Critic.
5. Judge: reads the full transcript including Critic feedback and renders a Verdict.
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any

from app.agents.factory import AgentFactory
from app.llm import complete, usage_tracker
from app.schemas import (
    AdvocateOutput,
    AgentConfig,
    Argument,
    CriticOutput,
    Critique,
    CritiqueIssue,
    Debate,
    DebateConfig,
    JudgeOutput,
    ModeratorOutput,
    Round,
    Verdict,
    Vote,
)

logger = logging.getLogger(__name__)

CRITIC_THRESHOLD = 2.5
DEBATER_ROLES = {"advocate", "scholar", "explorer"}

EventCallback = Callable[[str, dict[str, Any]], Any] | None
CompleteFn = Callable[..., Awaitable[Any]]


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
            parts.append(f"[{arg.id} | {arg.agent_id} ({arg.stance.upper()})]: {arg.text}")
            if arg.claims:
                parts.append("  Claims: " + " | ".join(arg.claims))
            if arg.critique is not None:
                parts.append(f"  Critic Score: {arg.critique.score:.1f}/5")
                if arg.critique.issues:
                    issues_str = "; ".join(f"{i.type}: {i.note}" for i in arg.critique.issues)
                    parts.append(f"  Critic Issues: {issues_str}")
    return "\n".join(parts)


async def _run_critic_and_revise(
    question: str,
    rnd: Round,
    critic: AgentConfig,
    debaters_by_id: dict[str, AgentConfig],
    factory: AgentFactory,
    profile: str | None,
    critic_threshold: float,
    on_event: EventCallback,
    complete_fn: CompleteFn,
) -> None:
    """Score each argument in `rnd`; if score < threshold, revise once."""
    critic_sys = factory.get_system_prompt(critic)
    critic_temp = factory.get_temperature("critic")

    # Iterate over snapshot so newly added revisions are never revised a second time
    original_args = list(rnd.arguments)
    for arg in original_args:
        _emit(on_event, "agent_thinking", {"agent_id": critic.id})
        critic_out: CriticOutput = await complete_fn(
            role="critic",
            system=critic_sys,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Question: {question}\n\n"
                        f"Evaluate Argument {arg.id} by {arg.agent_id} ({arg.stance.upper()}):\n"
                        f"{arg.text}\n\n"
                        f"Claims: {arg.claims}\n\n"
                        "Score from 0 to 5 on evidence support, logical validity, and relevance."
                    ),
                }
            ],
            schema=CriticOutput,
            profile=profile,
            temperature=critic_temp,
        )

        critique = Critique(
            by_agent=critic.id,
            score=critic_out.score,
            issues=[CritiqueIssue(type=i.type, note=i.note) for i in critic_out.issues],
        )
        arg.critique = critique
        _emit(on_event, "critique", {"argument_id": arg.id, **critique.model_dump()})

        if critique.score < critic_threshold:
            author = debaters_by_id.get(arg.agent_id)
            if author is None:
                continue
            logger.info(
                "Argument %s scored %.1f < %.1f; requesting 1 revision from %s",
                arg.id,
                critique.score,
                critic_threshold,
                author.id,
            )
            _emit(on_event, "agent_thinking", {"agent_id": author.id})
            author_sys = factory.get_system_prompt(author)
            author_temp = factory.get_temperature(author.role)
            issues_desc = [f"[{i.type}] {i.note}" for i in critique.issues]
            rev_out: AdvocateOutput = await complete_fn(
                role="debater" if author.role == "advocate" else author.role,
                system=author_sys,
                messages=[
                    {
                        "role": "user",
                        "content": (
                            f"Question: {question}\n\n"
                            f"Your argument {arg.id} scored {critique.score:.1f}/5 "
                            f"from the Critic.\n"
                            f"Issues flagged: {issues_desc}\n"
                            f"Critic Socratic questions: {critic_out.questions}\n\n"
                            f"Original text:\n{arg.text}\n\n"
                            f"Revise your argument once to directly fix these weaknesses while "
                            f"maintaining your {author.stance.upper()} stance."
                        ),
                    }
                ],
                schema=AdvocateOutput,
                profile=profile,
                temperature=author_temp,
            )
            revised_arg = Argument(
                id=f"{arg.id}-rev",
                agent_id=author.id,
                stance=author.stance,
                text=rev_out.text,
                claims=rev_out.claims,
                rebuts=arg.rebuts,
                evidence_ids=rev_out.evidence_ids,
                confidence=rev_out.confidence,
            )
            rnd.arguments.append(revised_arg)
            _emit(on_event, "argument", revised_arg.model_dump())


async def run_debate(
    question: str,
    num_agents: int = 2,
    num_rounds: int = 2,
    profile: str | None = None,
    on_event: EventCallback = None,
    complete_fn: CompleteFn = complete,
    all_roles: bool = False,
    enable_critic: bool = True,
    critic_threshold: float = CRITIC_THRESHOLD,
) -> Debate:
    """Run a personality-shaped debate with optional Critic scoring and revision loop."""
    usage_tracker.reset()
    debate_id = str(uuid.uuid4())[:8]
    factory = AgentFactory(profile=profile)

    agents = factory.create_debate_agents(num_advocates=num_agents, all_roles=all_roles)
    debaters = [a for a in agents if a.role in DEBATER_ROLES]
    debaters_by_id = {a.id: a for a in debaters}
    moderator = next(a for a in agents if a.role == "moderator")
    critic = next((a for a in agents if a.role == "critic"), None)
    judge = next(a for a in agents if a.role == "judge")

    config = DebateConfig(
        num_agents=len(debaters),
        rounds=num_rounds,
        models=factory.get_model_map(),
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

    # 1. Moderator restates question and confirms stances
    mod_sys = factory.get_system_prompt(moderator)
    agent_desc = ", ".join(
        f"{a.id} ({a.name}, role={a.role}, default={a.stance})" for a in debaters
    )
    mod_output: ModeratorOutput = await complete_fn(
        role="moderator",
        system=mod_sys,
        messages=[
            {
                "role": "user",
                "content": f"Question: {question}\n\nDebaters: {agent_desc}",
            }
        ],
        schema=ModeratorOutput,
        profile=profile,
        temperature=factory.get_temperature("moderator"),
    )

    assignment_map = {item.agent_id: item.stance for item in mod_output.assignments}
    for deb in debaters:
        if deb.id in assignment_map:
            deb.stance = assignment_map[deb.id]

    # 2. Opening round
    opening = Round(number=1, kind="opening", arguments=[])
    _emit(on_event, "round_started", {"round": 1, "kind": "opening"})

    for deb in debaters:
        _emit(on_event, "agent_thinking", {"agent_id": deb.id})
        sys_prompt = factory.get_system_prompt(deb)
        model_role = "debater" if deb.role == "advocate" else deb.role
        out: AdvocateOutput = await complete_fn(
            role=model_role,
            system=sys_prompt,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Question: {question}\n"
                        f"Moderator framing: {mod_output.restated_question}\n"
                        f"Sub-claims: {mod_output.sub_claims}\n\n"
                        f"Deliver your opening statement for the {deb.stance.upper()} side "
                        "with 3 key points."
                    ),
                }
            ],
            schema=AdvocateOutput,
            profile=profile,
            temperature=factory.get_temperature(deb.role),
        )
        arg = Argument(
            id=f"arg-{debate_id}-1-{deb.id}",
            agent_id=deb.id,
            stance=deb.stance,
            text=out.text,
            claims=out.claims,
            rebuts=[],
            evidence_ids=out.evidence_ids,
            confidence=out.confidence,
        )
        opening.arguments.append(arg)
        _emit(on_event, "argument", arg.model_dump())

    if enable_critic and critic is not None:
        await _run_critic_and_revise(
            question=question,
            rnd=opening,
            critic=critic,
            debaters_by_id=debaters_by_id,
            factory=factory,
            profile=profile,
            critic_threshold=critic_threshold,
            on_event=on_event,
            complete_fn=complete_fn,
        )

    debate.rounds.append(opening)

    # 3. Rebuttal rounds
    for rebuttal_idx in range(1, num_rounds + 1):
        round_num = rebuttal_idx + 1
        rnd = Round(number=round_num, kind="rebuttal", arguments=[])
        _emit(on_event, "round_started", {"round": round_num, "kind": "rebuttal"})

        for deb in debaters:
            _emit(on_event, "agent_thinking", {"agent_id": deb.id})
            transcript = _format_transcript(debate, mod_output)
            opp_ids = [
                a.id for prev in debate.rounds for a in prev.arguments if a.stance != deb.stance
            ]
            sys_prompt = factory.get_system_prompt(deb)
            model_role = "debater" if deb.role == "advocate" else deb.role
            out = await complete_fn(
                role=model_role,
                system=sys_prompt,
                messages=[
                    {
                        "role": "user",
                        "content": (
                            f"Question: {question}\n\n"
                            f"Transcript so far:\n{transcript}\n\n"
                            f"This is Rebuttal Round {rebuttal_idx}. Identify and attack your "
                            f"opponent's weakest point while defending {deb.stance.upper()}. "
                            f"Opponent argument IDs available to rebut: {opp_ids}"
                        ),
                    }
                ],
                schema=AdvocateOutput,
                profile=profile,
                temperature=factory.get_temperature(deb.role),
            )
            rebuts = [rid for rid in out.rebuts if rid in opp_ids] or opp_ids[-1:]
            arg = Argument(
                id=f"arg-{debate_id}-{round_num}-{deb.id}",
                agent_id=deb.id,
                stance=deb.stance,
                text=out.text,
                claims=out.claims,
                rebuts=rebuts,
                evidence_ids=out.evidence_ids,
                confidence=out.confidence,
            )
            rnd.arguments.append(arg)
            _emit(on_event, "argument", arg.model_dump())

        if enable_critic and critic is not None:
            await _run_critic_and_revise(
                question=question,
                rnd=rnd,
                critic=critic,
                debaters_by_id=debaters_by_id,
                factory=factory,
                profile=profile,
                critic_threshold=critic_threshold,
                on_event=on_event,
                complete_fn=complete_fn,
            )

        debate.rounds.append(rnd)

    # 4. Judge verdict
    _emit(on_event, "agent_thinking", {"agent_id": judge.id})
    judge_sys = factory.get_system_prompt(judge)
    full_transcript = _format_transcript(debate, mod_output)

    judge_out: JudgeOutput = await complete_fn(
        role="judge",
        system=judge_sys,
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
        temperature=factory.get_temperature("judge"),
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
