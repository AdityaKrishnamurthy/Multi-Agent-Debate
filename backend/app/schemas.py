"""
Shared Pydantic v2 models — 002 §Shared schema (Transcript JSON v1).

Mirrors `frontend/lib/types.ts` field-for-field.
Any change here must bump `schema_version` and update the TS file in the same commit.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class PersonalityConfig(BaseModel):
    trait: str
    level: str


class AgentConfig(BaseModel):
    id: str
    name: str
    role: Literal["moderator", "advocate", "critic", "scholar", "explorer", "judge"]
    personality: PersonalityConfig | None = None
    stance: Literal["pro", "con", "neutral"]
    model: str


class CritiqueIssue(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: str
    note: str


class Critique(BaseModel):
    by_agent: str
    score: float = Field(ge=0, le=5)
    issues: list[CritiqueIssue] = Field(default_factory=list)


class Argument(BaseModel):
    id: str
    agent_id: str
    stance: Literal["pro", "con", "neutral"]
    text: str
    claims: list[str] = Field(default_factory=list)
    rebuts: list[str] = Field(default_factory=list)
    evidence_ids: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1, default=0.5)
    critique: Critique | None = None
    strength: float | None = Field(ge=0, le=1, default=None)


class Round(BaseModel):
    number: int
    kind: Literal["opening", "rebuttal", "closing"]
    arguments: list[Argument] = Field(default_factory=list)


class Evidence(BaseModel):
    id: str
    source: str
    url: str
    quote: str
    credibility: float = Field(ge=0, le=1, default=0.5)


class Vote(BaseModel):
    agent_id: str
    choice: str
    weight: float


class Verdict(BaseModel):
    decision: str
    confidence: float = Field(ge=0, le=1)
    reasoning: str
    winning_points: list[str] = Field(default_factory=list)
    open_disagreements: list[str] = Field(default_factory=list)
    votes: list[Vote] = Field(default_factory=list)


class DebateConfig(BaseModel):
    num_agents: int = 2
    rounds: int = 2
    models: dict[str, str] = Field(default_factory=dict)
    aggregation: str = "majority"


class Debate(BaseModel):
    schema_version: str = "1"
    id: str
    question: str
    config: DebateConfig
    agents: list[AgentConfig] = Field(default_factory=list)
    rounds: list[Round] = Field(default_factory=list)
    evidence: list[Evidence] = Field(default_factory=list)
    verdict: Verdict | None = None
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


# ---------------------------------------------------------------------------
# Role-specific structured LLM output models
# ---------------------------------------------------------------------------


class StanceAssignment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    agent_id: str
    stance: Literal["pro", "con"]


class ModeratorOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    restated_question: str
    sub_claims: list[str]
    assignments: list[StanceAssignment]


class AdvocateOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str
    claims: list[str]
    rebuts: list[str] = Field(default_factory=list)
    evidence_ids: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1)


class CriticOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    score: float = Field(ge=0, le=5)
    issues: list[CritiqueIssue] = Field(default_factory=list)
    questions: list[str] = Field(default_factory=list)


class JudgeOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: str
    confidence: float = Field(ge=0, le=1)
    reasoning: str
    winning_points: list[str]
    open_disagreements: list[str]
