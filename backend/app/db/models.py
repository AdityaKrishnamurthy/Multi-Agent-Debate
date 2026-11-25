"""SQLAlchemy models for 002 §Database tables, plus an event log for stream replay."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    BigInteger,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

EMBEDDING_DIM = 384  # bge-small-en-v1.5 / all-MiniLM-L6-v2 (plan 008)


def _now() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class DebateRow(Base):
    __tablename__ = "debates"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    question: Mapped[str] = mapped_column(Text)
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    # queued | running | complete | error
    status: Mapped[str] = mapped_column(String(16), default="queued", index=True)
    transcript: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    verdict: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class DebateEventRow(Base):
    __tablename__ = "debate_events"
    __table_args__ = (UniqueConstraint("debate_id", "seq"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    debate_id: Mapped[str] = mapped_column(ForeignKey("debates.id", ondelete="CASCADE"), index=True)
    seq: Mapped[int] = mapped_column(Integer)
    type: Mapped[str] = mapped_column(String(32))
    data: Mapped[dict[str, Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class AgentRow(Base):
    __tablename__ = "agents"
    __table_args__ = (UniqueConstraint("debate_id", "agent_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    debate_id: Mapped[str] = mapped_column(ForeignKey("debates.id", ondelete="CASCADE"), index=True)
    agent_key: Mapped[str] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(128))
    role: Mapped[str] = mapped_column(String(16))
    personality: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    stance: Mapped[str] = mapped_column(String(8))
    model: Mapped[str] = mapped_column(String(128))


class RoundRow(Base):
    __tablename__ = "rounds"
    __table_args__ = (UniqueConstraint("debate_id", "number"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    debate_id: Mapped[str] = mapped_column(ForeignKey("debates.id", ondelete="CASCADE"), index=True)
    number: Mapped[int] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(String(16))


class ArgumentRow(Base):
    __tablename__ = "arguments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    debate_id: Mapped[str] = mapped_column(ForeignKey("debates.id", ondelete="CASCADE"), index=True)
    round_id: Mapped[int] = mapped_column(ForeignKey("rounds.id", ondelete="CASCADE"), index=True)
    arg_key: Mapped[str] = mapped_column(String(128))
    agent_key: Mapped[str] = mapped_column(String(64))
    stance: Mapped[str] = mapped_column(String(8))
    text: Mapped[str] = mapped_column(Text)
    claims: Mapped[list[str]] = mapped_column(JSONB, default=list)
    rebuts: Mapped[list[str]] = mapped_column(JSONB, default=list)
    evidence_ids: Mapped[list[str]] = mapped_column(JSONB, default=list)
    confidence: Mapped[float] = mapped_column(Float)
    critic_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    verifier_score: Mapped[float | None] = mapped_column(Float, nullable=True)  # plan 009
    strength: Mapped[float | None] = mapped_column(Float, nullable=True)


class CritiqueRow(Base):
    __tablename__ = "critiques"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    argument_id: Mapped[int] = mapped_column(
        ForeignKey("arguments.id", ondelete="CASCADE"), index=True
    )
    by_agent: Mapped[str] = mapped_column(String(64))
    score: Mapped[float] = mapped_column(Float)
    issues: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)


class EvidenceRow(Base):
    __tablename__ = "evidence"
    __table_args__ = (UniqueConstraint("debate_id", "evidence_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    debate_id: Mapped[str] = mapped_column(ForeignKey("debates.id", ondelete="CASCADE"), index=True)
    evidence_key: Mapped[str] = mapped_column(String(16))  # "E1", "E2", ...
    source: Mapped[str] = mapped_column(Text)
    url: Mapped[str] = mapped_column(Text)
    quote: Mapped[str] = mapped_column(Text)
    credibility: Mapped[float] = mapped_column(Float)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM), nullable=True)


class VoteRow(Base):
    __tablename__ = "votes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    debate_id: Mapped[str] = mapped_column(ForeignKey("debates.id", ondelete="CASCADE"), index=True)
    agent_key: Mapped[str] = mapped_column(String(64))
    choice: Mapped[str] = mapped_column(Text)
    weight: Mapped[float] = mapped_column(Float)
