"""Runs debates in the background and fans their events out to SSE subscribers.

Each debate gets an in-memory event list plus one asyncio.Queue per connected client.
Every event is also written to the store in order, so a client that connects late, or
after the debate finished, can replay the whole stream (plan 007).
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

import litellm

from app.db.store import Store, StoredEvent
from app.engine.debate import CompleteFn, run_debate
from app.llm import _get_retry_after, complete
from app.settings import Settings

logger = logging.getLogger(__name__)

TERMINAL_EVENTS = {"verdict", "error"}


class TooManyDebates(Exception):
    """Raised when the concurrency cap (cost guard) is reached."""


@dataclass
class LiveDebate:
    id: str
    events: list[StoredEvent] = field(default_factory=list)
    subscribers: set[asyncio.Queue[StoredEvent | None]] = field(default_factory=set)
    persist_queue: asyncio.Queue[StoredEvent | None] = field(default_factory=asyncio.Queue)
    done: bool = False
    task: asyncio.Task[None] | None = None


def _error_message(exc: Exception) -> tuple[str, float | None]:
    if isinstance(exc, litellm.RateLimitError):
        return "The model provider's rate limit was reached. Try again shortly.", _get_retry_after(
            exc
        )
    if isinstance(exc, litellm.AuthenticationError):
        return "The model provider rejected the API key. Check GROQ_API_KEY in .env.", None
    return f"The debate stopped unexpectedly: {type(exc).__name__}.", None


class DebateRunner:
    def __init__(
        self,
        store: Store,
        settings: Settings,
        complete_fn: CompleteFn | None = None,
    ) -> None:
        self.store = store
        self.settings = settings
        self.complete_fn: CompleteFn = complete_fn or complete
        self.live: dict[str, LiveDebate] = {}

    def running_count(self) -> int:
        return sum(1 for d in self.live.values() if not d.done)

    async def start(
        self,
        question: str,
        num_agents: int,
        num_rebuttals: int,
        all_roles: bool = False,
        enable_critic: bool = True,
    ) -> str:
        if self.running_count() >= self.settings.max_concurrent_debates:
            raise TooManyDebates
        debate_id = uuid.uuid4().hex[:12]
        config = {
            "num_agents": num_agents,
            "rebuttals": num_rebuttals,
            "all_roles": all_roles,
            "critic": enable_critic,
            "profile": self.settings.llm_profile or "default",
        }
        await self.store.create_debate(debate_id, question, config)
        live = LiveDebate(id=debate_id)
        self.live[debate_id] = live
        live.task = asyncio.create_task(
            self._run(live, question, num_agents, num_rebuttals, all_roles, enable_critic)
        )
        return debate_id

    def _publish(self, live: LiveDebate, event_type: str, data: dict[str, Any]) -> None:
        ev = StoredEvent(seq=len(live.events) + 1, type=event_type, data=data)
        live.events.append(ev)
        live.persist_queue.put_nowait(ev)
        for q in live.subscribers:
            q.put_nowait(ev)

    async def _persist_worker(self, live: LiveDebate) -> None:
        while True:
            ev = await live.persist_queue.get()
            if ev is None:
                return
            try:
                await self.store.append_event(live.id, ev)
            except Exception:  # never let storage break the live stream
                logger.exception("Failed to persist event %s for %s", ev.seq, live.id)

    async def _run(
        self,
        live: LiveDebate,
        question: str,
        num_agents: int,
        num_rebuttals: int,
        all_roles: bool,
        enable_critic: bool,
    ) -> None:
        persist = asyncio.create_task(self._persist_worker(live))
        current_round = 0

        def on_event(name: str, data: dict[str, Any]) -> None:
            nonlocal current_round
            payload = dict(data)
            if name == "round_started":
                current_round = int(payload["round"])
            elif name == "argument":
                payload["round_number"] = current_round
            self._publish(live, name, payload)

        try:
            await self.store.set_status(live.id, "running")
            debate = await run_debate(
                question=question,
                num_agents=num_agents,
                num_rounds=num_rebuttals,
                profile=self.settings.llm_profile,
                on_event=on_event,
                complete_fn=self.complete_fn,
                all_roles=all_roles,
                enable_critic=enable_critic,
                debate_id=live.id,
            )
            await self.store.finish_debate(debate)
        except Exception as exc:
            logger.exception("Debate %s failed", live.id)
            message, retry_after = _error_message(exc)
            data: dict[str, Any] = {"message": message}
            if retry_after is not None:
                data["retry_after"] = retry_after
            self._publish(live, "error", data)
            try:
                await self.store.set_status(live.id, "error", message)
            except Exception:
                logger.exception("Failed to record error status for %s", live.id)
        finally:
            live.done = True
            live.persist_queue.put_nowait(None)
            await persist
            for q in live.subscribers:
                q.put_nowait(None)

    async def subscribe(self, debate_id: str, after_seq: int = 0) -> AsyncIterator[StoredEvent]:
        """Yield every event after `after_seq`, then live events until the debate ends."""
        live = self.live.get(debate_id)
        if live is None:
            for ev in await self.store.list_events(debate_id, after_seq):
                yield ev
            return

        queue: asyncio.Queue[StoredEvent | None] = asyncio.Queue()
        backlog = [e for e in live.events if e.seq > after_seq]
        done_at_subscribe = live.done
        if not done_at_subscribe:
            live.subscribers.add(queue)
        try:
            last = after_seq
            for ev in backlog:
                last = ev.seq
                yield ev
            if done_at_subscribe:
                return
            while True:
                ev = await queue.get()
                if ev is None:
                    return
                if ev.seq <= last:
                    continue
                last = ev.seq
                yield ev
        finally:
            live.subscribers.discard(queue)

    async def shutdown(self) -> None:
        for live in self.live.values():
            if live.task and not live.task.done():
                live.task.cancel()
