"""HTTP routes for plan 007: create, read, list and stream debates."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from datetime import datetime
from pathlib import Path
from typing import Any, Literal

import yaml
from fastapi import APIRouter, Header, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.api.live_state import build_live_debate
from app.api.runner import DebateRunner, TooManyDebates
from app.db.store import StoredEvent
from app.llm import get_profile_config
from app.settings import Settings

router = APIRouter(prefix="/api")

HEARTBEAT_SECONDS = 15.0
PERSONALITIES_PATH = Path(__file__).resolve().parent.parent / "config" / "personalities.yaml"


class CreateDebateRequest(BaseModel):
    question: str = Field(min_length=5, max_length=500)
    num_agents: int = Field(default=2, ge=2)
    rebuttals: int = Field(default=2, ge=0)
    all_roles: bool = False
    critic: bool = True


class CreateDebateResponse(BaseModel):
    id: str
    stream_url: str


class DebateSummary(BaseModel):
    id: str
    question: str
    status: str
    decision: str | None
    confidence: float | None
    created_at: datetime


class DebateResponse(BaseModel):
    id: str
    question: str
    status: Literal["queued", "running", "complete", "error"]
    error: str | None
    config: dict[str, Any]
    debate: dict[str, Any] | None


def _runner(request: Request) -> DebateRunner:
    return request.app.state.runner


def _settings(request: Request) -> Settings:
    return request.app.state.settings


@router.get("/health")
async def health(request: Request) -> dict[str, Any]:
    return {"status": "ok", "database": await _runner(request).store.ping()}


@router.post(
    "/debates",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=CreateDebateResponse,
)
async def create_debate(body: CreateDebateRequest, request: Request) -> CreateDebateResponse:
    settings = _settings(request)
    if body.num_agents > settings.max_agents:
        raise HTTPException(422, f"At most {settings.max_agents} agents per debate.")
    if body.rebuttals > settings.max_rebuttals:
        raise HTTPException(422, f"At most {settings.max_rebuttals} rebuttal rounds per debate.")
    try:
        debate_id = await _runner(request).start(
            question=body.question.strip(),
            num_agents=body.num_agents,
            num_rebuttals=body.rebuttals,
            all_roles=body.all_roles,
            enable_critic=body.critic,
        )
    except TooManyDebates as exc:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Another debate is still running. Wait for it to finish, then try again.",
        ) from exc
    return CreateDebateResponse(id=debate_id, stream_url=f"/api/debates/{debate_id}/stream")


@router.get("/debates", response_model=list[DebateSummary])
async def list_debates(request: Request, limit: int = 50) -> list[DebateSummary]:
    records = await _runner(request).store.list_debates(min(max(limit, 1), 200))
    return [
        DebateSummary(
            id=r.id,
            question=r.question,
            status=r.status,
            decision=r.decision,
            confidence=r.confidence,
            created_at=r.created_at,
        )
        for r in records
    ]


@router.get("/debates/{debate_id}", response_model=DebateResponse)
async def get_debate(debate_id: str, request: Request) -> DebateResponse:
    runner = _runner(request)
    record = await runner.store.get_debate(debate_id)
    if record is None:
        raise HTTPException(404, "Debate not found.")
    debate = record.transcript
    if debate is None:
        live = runner.live.get(debate_id)
        events = live.events if live else await runner.store.list_events(debate_id)
        debate = build_live_debate(events)
    return DebateResponse(
        id=record.id,
        question=record.question,
        status=record.status,  # type: ignore[arg-type]
        error=record.error,
        config=record.config,
        debate=debate,
    )


def _sse(seq: int, event_type: str, data: dict[str, Any]) -> str:
    return f"id: {seq}\nevent: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.get("/debates/{debate_id}/stream")
async def stream_debate(
    debate_id: str,
    request: Request,
    last_event_id: str | None = Header(default=None),
) -> StreamingResponse:
    runner = _runner(request)
    if await runner.store.get_debate(debate_id) is None:
        raise HTTPException(404, "Debate not found.")
    after = int(last_event_id) if last_event_id and last_event_id.isdigit() else 0

    async def body() -> AsyncIterator[str]:
        # A pump task drains the subscription into a queue. Only the queue read is
        # timed out for keep-alives: cancelling the subscription itself would end it.
        queue: asyncio.Queue[StoredEvent | None] = asyncio.Queue()

        async def pump() -> None:
            try:
                async for ev in runner.subscribe(debate_id, after):
                    queue.put_nowait(ev)
            finally:
                queue.put_nowait(None)

        task = asyncio.create_task(pump())
        try:
            while True:
                try:
                    ev = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
                except TimeoutError:
                    if await request.is_disconnected():
                        return
                    yield ": keep-alive\n\n"
                    continue
                if ev is None:
                    yield _sse(0, "end", {})
                    return
                yield _sse(ev.seq, ev.type, ev.data)
        finally:
            task.cancel()

    return StreamingResponse(
        body(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/documents", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def upload_document() -> dict[str, str]:
    return {"detail": "PDF upload arrives with evidence retrieval (plan 008)."}


@router.get("/config/options")
async def config_options(request: Request) -> dict[str, Any]:
    settings = _settings(request)
    profile = get_profile_config(settings.llm_profile)
    with open(PERSONALITIES_PATH, encoding="utf-8") as f:
        personalities = yaml.safe_load(f) or {}
    return {
        "profile": settings.llm_profile or "default",
        "models": profile.get("models", {}),
        "personalities": [
            {"role": role, "trait": cfg.get("trait"), "level": cfg.get("level")}
            for role, cfg in personalities.items()
        ],
        "aggregation_methods": [
            {"id": "majority", "label": "Majority vote", "available": True},
            {"id": "evidence_weighted", "label": "Evidence-weighted vote", "available": False},
            {"id": "confidence_weighted", "label": "Confidence-weighted vote", "available": False},
            {"id": "judge_panel", "label": "Judge panel", "available": False},
            {"id": "bayesian", "label": "Bayesian per sub-claim", "available": False},
        ],
        "limits": {
            "max_agents": settings.max_agents,
            "max_rebuttals": settings.max_rebuttals,
            "max_concurrent_debates": settings.max_concurrent_debates,
        },
    }
