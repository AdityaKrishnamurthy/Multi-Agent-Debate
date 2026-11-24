"""
Agent factory — personality-shaped agents for MAPS-adapted debates (006).

Loads typed Big Five personality profiles from `app/config/personalities.yaml`,
builds role+personality system prompts, and assembles debate rosters.
"""

from __future__ import annotations

from pathlib import Path

import yaml
from pydantic import BaseModel, Field

from app.llm import get_raw_model_id
from app.schemas import AgentConfig, PersonalityConfig

_PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
_CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"


class PersonalitySpec(BaseModel):
    trait: str
    level: str
    style: str
    temperature: float = Field(ge=0.0, le=2.0, default=0.7)


def load_personalities(path: Path | None = None) -> dict[str, PersonalitySpec]:
    """Load and validate personalities.yaml into typed PersonalitySpec objects."""
    target = path or (_CONFIG_DIR / "personalities.yaml")
    with open(target, encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}
    return {role: PersonalitySpec.model_validate(spec) for role, spec in raw.items()}


class AgentFactory:
    """Constructs agents and personality-shaped system prompts."""

    def __init__(self, profile: str | None = None) -> None:
        self.profile = profile
        self.personalities = load_personalities()
        self._prompt_cache: dict[str, str] = {}

    def _load_prompt_template(self, role: str) -> str:
        if role not in self._prompt_cache:
            path = _PROMPTS_DIR / f"{role}.md"
            if path.exists():
                self._prompt_cache[role] = path.read_text(encoding="utf-8")
            else:
                self._prompt_cache[role] = (
                    f"You are a {role} in a structured debate.\n\n{{{{personality_block}}}}"
                )
        return self._prompt_cache[role]

    def get_personality(self, role: str) -> PersonalitySpec:
        if role in self.personalities:
            return self.personalities[role]
        return self.personalities["advocate"]

    def get_temperature(self, role: str) -> float:
        return self.get_personality(role).temperature

    def build_system_prompt(
        self,
        role: str,
        personality: PersonalityConfig | PersonalitySpec | None = None,
        stance: str = "neutral",
        rules: list[str] | None = None,
    ) -> str:
        """Build system prompt combining role template, personality block, stance, and rules."""
        template = self._load_prompt_template(role)
        spec = self.get_personality(role)

        if isinstance(personality, PersonalitySpec):
            trait = personality.trait
            level = personality.level
            style = personality.style.strip()
        elif isinstance(personality, PersonalityConfig):
            trait = personality.trait
            level = personality.level
            style = spec.style.strip()
        else:
            trait = spec.trait
            level = spec.level
            style = spec.style.strip()

        personality_block = (
            f"Big Five Trait: {trait.capitalize()} ({level})\nBehavioral Style: {style}"
        )

        prompt = template.replace("{{personality_block}}", personality_block)
        prompt = prompt.replace("{{stance}}", stance.upper())

        if "{{personality_block}}" not in template:
            prompt = f"{prompt}\n\n## Personality\n{personality_block}"

        if rules:
            rules_text = "\n".join(f"- {r}" for r in rules)
            prompt = f"{prompt}\n\n## Additional Rules\n{rules_text}"

        return prompt

    def get_system_prompt(
        self,
        agent: AgentConfig,
        rules: list[str] | None = None,
    ) -> str:
        """Convenience wrapper building the system prompt for an AgentConfig."""
        return self.build_system_prompt(
            role=agent.role,
            personality=agent.personality,
            stance=agent.stance,
            rules=rules,
        )

    def _make_agent(
        self,
        agent_id: str,
        name: str,
        role: str,
        stance: str,
        model_role: str | None = None,
    ) -> AgentConfig:
        spec = self.get_personality(role)
        return AgentConfig(
            id=agent_id,
            name=name,
            role=role,  # type: ignore[arg-type]
            personality=PersonalityConfig(trait=spec.trait, level=spec.level),
            stance=stance,  # type: ignore[arg-type]
            model=get_raw_model_id(model_role or role, self.profile),
        )

    def create_debate_agents(
        self,
        num_advocates: int = 2,
        all_roles: bool = False,
    ) -> list[AgentConfig]:
        """
        Assemble debate agents with personality configs.

        When `all_roles=True` (or `num_advocates >= 3`), includes all 5 MAPS roles:
        Moderator (Agreeableness), Advocate (Extraversion), Scholar (Conscientiousness),
        Explorer (Openness), and Critic (Neuroticism), plus the Judge.
        """
        agents: list[AgentConfig] = [
            self._make_agent("moderator-1", "Moderator", "moderator", "neutral")
        ]

        if all_roles or num_advocates >= 3:
            agents.append(
                self._make_agent("advocate-1", "Advocate Alpha", "advocate", "pro", "debater")
            )
            agents.append(self._make_agent("scholar-1", "Scholar", "scholar", "con", "scholar"))
            agents.append(self._make_agent("explorer-1", "Explorer", "explorer", "pro", "explorer"))
            for idx in range(3, num_advocates):
                stance = "pro" if idx % 2 == 0 else "con"
                agents.append(
                    self._make_agent(
                        f"advocate-{idx + 1}",
                        f"Advocate {idx + 1}",
                        "advocate",
                        stance,
                        "debater",
                    )
                )
        else:
            names = ["Advocate Alpha", "Advocate Beta"]
            for idx in range(num_advocates):
                stance = "pro" if idx % 2 == 0 else "con"
                agents.append(
                    self._make_agent(
                        f"advocate-{idx + 1}",
                        names[idx] if idx < len(names) else f"Advocate {idx + 1}",
                        "advocate",
                        stance,
                        "debater",
                    )
                )

        agents.append(self._make_agent("critic-1", "Critic", "critic", "neutral"))
        agents.append(self._make_agent("judge-1", "Judge", "judge", "neutral"))
        return agents

    def get_model_map(self) -> dict[str, str]:
        return {
            "moderator": get_raw_model_id("moderator", self.profile),
            "debater": get_raw_model_id("debater", self.profile),
            "scholar": get_raw_model_id("scholar", self.profile),
            "explorer": get_raw_model_id("explorer", self.profile),
            "critic": get_raw_model_id("critic", self.profile),
            "judge": get_raw_model_id("judge", self.profile),
        }
