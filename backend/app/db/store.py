"""Persistence for debates and their event logs.

`PostgresStore` is the real implementation (plan 007). `MemoryStore` has the same
interface and is used by the API tests, so they run without a database.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Protocol

from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

from app.db.models import (
    AgentRow,
    ArgumentRow,
    CritiqueRow,
    DebateEventRow,
    DebateRow,
    EvidenceRow,
    RoundRow,
    VoteRow,
)
from app.schemas import Debate


@dataclass
class StoredEvent:
    seq: int
    type: str
    data: dict[str, Any]


@dataclass
class DebateRecord:
    id: str
    question: str
    status: str
    config: dict[str, Any]
    transcript: dict[str, Any] | None = None
    error: str | None = None
    confidence: float | None = None
    decision: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


class Store(Protocol):
    async def ping(self) -> bool: ...
    async def create_debate(
        self, debate_id: str, question: str, config: dict[str, Any]
    ) -> None: ...
    async def set_status(self, debate_id: str, status: str, error: str | None = None) -> None: ...
    async def append_event(self, debate_id: str, event: StoredEvent) -> None: ...
    async def list_events(self, debate_id: str, after_seq: int = 0) -> list[StoredEvent]: ...
    async def finish_debate(self, debate: Debate) -> None: ...
    async def get_debate(self, debate_id: str) -> DebateRecord | None: ...
    async def list_debates(self, limit: int = 50) -> list[DebateRecord]: ...
    async def close(self) -> None: ...


class MemoryStore:
    """In-process store with the same behaviour as PostgresStore (tests, offline use)."""

    def __init__(self) -> None:
        self.debates: dict[str, DebateRecord] = {}
        self.events: dict[str, list[StoredEvent]] = {}

    async def ping(self) -> bool:
        return True

    async def create_debate(self, debate_id: str, question: str, config: dict[str, Any]) -> None:
        self.debates[debate_id] = DebateRecord(
            id=debate_id, question=question, status="queued", config=config
        )
        self.events[debate_id] = []

    async def set_status(self, debate_id: str, status: str, error: str | None = None) -> None:
        rec = self.debates[debate_id]
        rec.status = status
        rec.error = error

    async def append_event(self, debate_id: str, event: StoredEvent) -> None:
        self.events.setdefault(debate_id, []).append(event)

    async def list_events(self, debate_id: str, after_seq: int = 0) -> list[StoredEvent]:
        return [e for e in self.events.get(debate_id, []) if e.seq > after_seq]

    async def finish_debate(self, debate: Debate) -> None:
        rec = self.debates[debate.id]
        rec.transcript = debate.model_dump(mode="json")
        rec.status = "complete"
        if debate.verdict:
            rec.confidence = debate.verdict.confidence
            rec.decision = debate.verdict.decision

    async def get_debate(self, debate_id: str) -> DebateRecord | None:
        return self.debates.get(debate_id)

    async def list_debates(self, limit: int = 50) -> list[DebateRecord]:
        recs = sorted(self.debates.values(), key=lambda r: r.created_at, reverse=True)
        return recs[:limit]

    async def close(self) -> None:
        return None


def _record(row: DebateRow) -> DebateRecord:
    return DebateRecord(
        id=row.id,
        question=row.question,
        status=row.status,
        config=row.config or {},
        transcript=row.transcript,
        error=row.error,
        confidence=row.confidence,
        decision=(row.verdict or {}).get("decision"),
        created_at=row.created_at,
    )


class PostgresStore:
    def __init__(self, database_url: str) -> None:
        self.engine: AsyncEngine = create_async_engine(database_url, pool_pre_ping=True)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)

    async def ping(self) -> bool:
        try:
            async with self.engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            return True
        except Exception:
            return False

    async def create_debate(self, debate_id: str, question: str, config: dict[str, Any]) -> None:
        async with self.sessions.begin() as s:
            s.add(DebateRow(id=debate_id, question=question, config=config, status="queued"))

    async def set_status(self, debate_id: str, status: str, error: str | None = None) -> None:
        values: dict[str, Any] = {"status": status, "error": error}
        if status in ("complete", "error"):
            values["finished_at"] = datetime.now(UTC)
        async with self.sessions.begin() as s:
            await s.execute(update(DebateRow).where(DebateRow.id == debate_id).values(**values))

    async def append_event(self, debate_id: str, event: StoredEvent) -> None:
        async with self.sessions.begin() as s:
            s.add(
                DebateEventRow(debate_id=debate_id, seq=event.seq, type=event.type, data=event.data)
            )

    async def list_events(self, debate_id: str, after_seq: int = 0) -> list[StoredEvent]:
        async with self.sessions() as s:
            rows = await s.scalars(
                select(DebateEventRow)
                .where(DebateEventRow.debate_id == debate_id, DebateEventRow.seq > after_seq)
                .order_by(DebateEventRow.seq)
            )
            return [StoredEvent(seq=r.seq, type=r.type, data=r.data) for r in rows]

    async def finish_debate(self, debate: Debate) -> None:
        transcript = debate.model_dump(mode="json")
        verdict = transcript.get("verdict")
        async with self.sessions.begin() as s:
            await s.execute(
                update(DebateRow)
                .where(DebateRow.id == debate.id)
                .values(
                    status="complete",
                    transcript=transcript,
                    verdict=verdict,
                    confidence=verdict["confidence"] if verdict else None,
                    finished_at=datetime.now(UTC),
                )
            )
            for a in debate.agents:
                s.add(
                    AgentRow(
                        debate_id=debate.id,
                        agent_key=a.id,
                        name=a.name,
                        role=a.role,
                        personality=a.personality.model_dump() if a.personality else None,
                        stance=a.stance,
                        model=a.model,
                    )
                )
            for rnd in debate.rounds:
                round_row = RoundRow(debate_id=debate.id, number=rnd.number, kind=rnd.kind)
                s.add(round_row)
                await s.flush()
                for arg in rnd.arguments:
                    arg_row = ArgumentRow(
                        debate_id=debate.id,
                        round_id=round_row.id,
                        arg_key=arg.id,
                        agent_key=arg.agent_id,
                        stance=arg.stance,
                        text=arg.text,
                        claims=arg.claims,
                        rebuts=arg.rebuts,
                        evidence_ids=arg.evidence_ids,
                        confidence=arg.confidence,
                        critic_score=arg.critique.score if arg.critique else None,
                        strength=arg.strength,
                    )
                    s.add(arg_row)
                    if arg.critique:
                        await s.flush()
                        s.add(
                            CritiqueRow(
                                argument_id=arg_row.id,
                                by_agent=arg.critique.by_agent,
                                score=arg.critique.score,
                                issues=[i.model_dump() for i in arg.critique.issues],
                            )
                        )
            for ev in debate.evidence:
                s.add(
                    EvidenceRow(
                        debate_id=debate.id,
                        evidence_key=ev.id,
                        source=ev.source,
                        url=ev.url,
                        quote=ev.quote,
                        credibility=ev.credibility,
                    )
                )
            if debate.verdict:
                for v in debate.verdict.votes:
                    s.add(
                        VoteRow(
                            debate_id=debate.id,
                            agent_key=v.agent_id,
                            choice=v.choice,
                            weight=v.weight,
                        )
                    )

    async def get_debate(self, debate_id: str) -> DebateRecord | None:
        async with self.sessions() as s:
            row = await s.get(DebateRow, debate_id)
            return _record(row) if row else None

    async def list_debates(self, limit: int = 50) -> list[DebateRecord]:
        async with self.sessions() as s:
            rows = await s.scalars(
                select(DebateRow).order_by(DebateRow.created_at.desc()).limit(limit)
            )
            return [_record(r) for r in rows]

    async def close(self) -> None:
        await self.engine.dispose()
