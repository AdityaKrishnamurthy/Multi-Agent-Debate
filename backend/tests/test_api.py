"""API tests for plan 007: fake LLM + in-memory store, so no database or API key needed."""

from __future__ import annotations

import asyncio
import json
import os

import httpx
import pytest

from app.api.live_state import build_live_debate
from app.db.store import MemoryStore, StoredEvent
from app.main import create_app
from app.schemas import (
    AdvocateOutput,
    CriticOutput,
    JudgeOutput,
    ModeratorOutput,
    StanceAssignment,
)
from app.settings import Settings


async def fake_complete(role, system, messages, schema, **kwargs):
    if schema is ModeratorOutput:
        return ModeratorOutput(
            restated_question="Q?",
            sub_claims=["a"],
            assignments=[
                StanceAssignment(agent_id="advocate-1", stance="pro"),
                StanceAssignment(agent_id="advocate-2", stance="con"),
            ],
        )
    if schema is AdvocateOutput:
        return AdvocateOutput(
            text="An argument.", claims=["claim"], rebuts=[], evidence_ids=[], confidence=0.7
        )
    if schema is CriticOutput:
        return CriticOutput(score=4.0, issues=[], questions=[])
    if schema is JudgeOutput:
        return JudgeOutput(
            decision="Pro wins",
            confidence=0.7,
            reasoning="Clearer.",
            winning_points=["claim"],
            open_disagreements=[],
        )
    raise AssertionError(schema)


def make_settings(**overrides) -> Settings:
    base = dict(
        database_url="unused",
        cors_origins=["http://localhost:3000"],
        llm_profile=None,
        max_agents=5,
        max_rebuttals=3,
        max_concurrent_debates=1,
        cors_origin_regex=r"https://.*\.vercel\.app",
    )
    base.update(overrides)
    return Settings(**base)


@pytest.fixture
async def client_factory():
    stack: list = []

    async def make(complete_fn=fake_complete, **settings) -> httpx.AsyncClient:
        app = create_app(
            store=MemoryStore(), complete_fn=complete_fn, settings=make_settings(**settings)
        )
        lifespan = app.router.lifespan_context(app)
        await lifespan.__aenter__()
        client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        stack.append((client, lifespan))
        return client

    yield make
    for client, lifespan in stack:
        await client.aclose()
        await lifespan.__aexit__(None, None, None)


async def read_stream(
    client: httpx.AsyncClient, debate_id: str, headers=None
) -> list[tuple[str, dict]]:
    events: list[tuple[str, dict]] = []
    async with client.stream(
        "GET", f"/api/debates/{debate_id}/stream", headers=headers or {}
    ) as resp:
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/event-stream")
        name = None
        async for line in resp.aiter_lines():
            if line.startswith("event: "):
                name = line[7:]
            elif line.startswith("data: ") and name:
                events.append((name, json.loads(line[6:])))
                if name == "end":
                    break
    return events


async def wait_until_done(client: httpx.AsyncClient, debate_id: str) -> dict:
    for _ in range(200):
        body = (await client.get(f"/api/debates/{debate_id}")).json()
        if body["status"] in ("complete", "error"):
            return body
        await asyncio.sleep(0.01)
    raise AssertionError("debate did not finish")


async def test_health_and_options(client_factory):
    client = await client_factory()
    assert (await client.get("/api/health")).json() == {"status": "ok", "database": True}
    opts = (await client.get("/api/config/options")).json()
    assert "judge" in opts["models"]
    assert opts["limits"]["max_agents"] == 5
    assert any(m["id"] == "majority" and m["available"] for m in opts["aggregation_methods"])
    assert (await client.post("/api/documents")).status_code == 501
    assert opts["default_debate_model"].startswith("groq/")


async def test_model_choice_is_validated_and_applied(client_factory, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test")
    monkeypatch.delenv("MISTRAL_API_KEY", raising=False)
    client = await client_factory()
    models = (await client.get("/api/config/options")).json()["debate_models"]
    ids = [m["id"] for m in models]
    assert "groq/openai/gpt-oss-20b" in ids
    assert not any(i.startswith("mistral/") for i in ids)  # no Mistral key -> hidden

    bad = {"question": "Which model?", "model": "mistral/ministral-14b-latest"}
    assert (await client.post("/api/debates", json=bad)).status_code == 422

    chosen = "groq/qwen/qwen3.8-27b"
    debate_id = (
        await client.post("/api/debates", json={"question": "Which model?", "model": chosen})
    ).json()["id"]
    events = await read_stream(client, debate_id)
    agents = events[0][1]["debate"]["agents"]
    advocates = [a for a in agents if a["role"] == "advocate"]
    assert advocates and all(a["model"] == "qwen/qwen3.8-27b" for a in advocates)
    judge = next(a for a in agents if a["role"] == "judge")
    assert judge["model"] != "qwen/qwen3.8-27b"


async def test_create_stream_and_read_debate(client_factory):
    client = await client_factory()
    resp = await client.post(
        "/api/debates", json={"question": "Is this a test?", "num_agents": 2, "rebuttals": 1}
    )
    assert resp.status_code == 202
    debate_id = resp.json()["id"]

    events = await read_stream(client, debate_id)
    names = [n for n, _ in events]
    assert names[0] == "debate_started"
    assert names[-2:] == ["verdict", "end"]
    assert names.count("round_started") == 2
    started = events[0][1]["debate"]
    assert {a["stance"] for a in started["agents"] if a["role"] == "advocate"} == {"pro", "con"}
    arguments = [d for n, d in events if n == "argument"]
    assert all("round_number" in a for a in arguments)

    body = await wait_until_done(client, debate_id)
    assert body["status"] == "complete"
    assert body["debate"]["verdict"]["decision"] == "Pro wins"
    assert len(body["debate"]["rounds"]) == 2

    listing = (await client.get("/api/debates")).json()
    assert listing[0]["id"] == debate_id and listing[0]["decision"] == "Pro wins"


async def test_late_subscriber_replays_and_resumes(client_factory):
    client = await client_factory()
    debate_id = (
        await client.post("/api/debates", json={"question": "Replay please?", "rebuttals": 0})
    ).json()["id"]
    await wait_until_done(client, debate_id)

    full = await read_stream(client, debate_id)
    assert full[-2][0] == "verdict"
    resumed = await read_stream(client, debate_id, headers={"Last-Event-ID": "3"})
    assert len(resumed) == len(full) - 3


async def test_validation_and_cost_guards(client_factory):
    client = await client_factory()
    assert (await client.post("/api/debates", json={"question": "hi"})).status_code == 422
    too_many = {"question": "Valid question?", "num_agents": 9}
    assert (await client.post("/api/debates", json=too_many)).status_code == 422
    too_long = {"question": "Valid question?", "rebuttals": 9}
    assert (await client.post("/api/debates", json=too_long)).status_code == 422
    assert (await client.get("/api/debates/nope")).status_code == 404


async def test_only_one_debate_at_a_time(client_factory):
    release = asyncio.Event()

    async def slow_complete(role, system, messages, schema, **kwargs):
        await release.wait()
        return await fake_complete(role, system, messages, schema, **kwargs)

    client = await client_factory(complete_fn=slow_complete)
    first = await client.post("/api/debates", json={"question": "First one?", "rebuttals": 0})
    assert first.status_code == 202
    second = await client.post("/api/debates", json={"question": "Second one?", "rebuttals": 0})
    assert second.status_code == 429
    release.set()
    await wait_until_done(client, first.json()["id"])


async def test_engine_failure_becomes_error_event(client_factory):
    async def broken_complete(role, system, messages, schema, **kwargs):
        raise RuntimeError("boom")

    client = await client_factory(complete_fn=broken_complete)
    debate_id = (await client.post("/api/debates", json={"question": "Will it fail?"})).json()["id"]
    events = await read_stream(client, debate_id)
    assert events[-2][0] == "error"
    assert "stopped unexpectedly" in events[-2][1]["message"]
    body = await wait_until_done(client, debate_id)
    assert body["status"] == "error"


def test_build_live_debate_from_events():
    events = [
        StoredEvent(1, "debate_started", {"debate": {"id": "x", "agents": [], "rounds": []}}),
        StoredEvent(2, "round_started", {"round": 1, "kind": "opening"}),
        StoredEvent(3, "argument", {"id": "a1", "stance": "pro", "round_number": 1}),
        StoredEvent(4, "critique", {"argument_id": "a1", "score": 3.0, "issues": []}),
    ]
    debate = build_live_debate(events)
    assert debate["rounds"][0]["arguments"][0]["critique"]["score"] == 3.0
    assert "round_number" not in debate["rounds"][0]["arguments"][0]
    assert debate["verdict"] is None


@pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="needs Postgres (docker compose)")
async def test_postgres_store_round_trip():
    from app.db.store import PostgresStore
    from app.engine.debate import run_debate

    store = PostgresStore(os.environ["TEST_DATABASE_URL"])
    try:
        debate = await run_debate(
            "Store round trip?", num_rounds=0, complete_fn=fake_complete, enable_critic=False
        )
        await store.create_debate(debate.id, debate.question, {})
        await store.append_event(debate.id, StoredEvent(1, "verdict", {"decision": "Pro"}))
        await store.finish_debate(debate)
        rec = await store.get_debate(debate.id)
        assert rec is not None and rec.status == "complete"
        assert rec.transcript["verdict"]["decision"] == "Pro wins"
        assert [e.seq for e in await store.list_events(debate.id)] == [1]
    finally:
        await store.close()


async def test_cors_allows_configured_origins(client_factory):
    client = await client_factory()
    for origin, allowed in [
        ("http://localhost:3000", True),
        ("https://multi-agent-debate-git-main.vercel.app", True),
        ("https://evil.example.com", False),
    ]:
        resp = await client.options(
            "/api/health",
            headers={"Origin": origin, "Access-Control-Request-Method": "GET"},
        )
        assert (resp.headers.get("access-control-allow-origin") == origin) is allowed


async def test_ping_does_not_need_the_database(client_factory):
    client = await client_factory()
    assert (await client.get("/api/ping")).json() == {"status": "ok"}


def test_database_url_accepts_host_connection_strings():
    from app.settings import normalize_database_url

    neon = "postgresql://u:p@ep-x.neon.tech/db?sslmode=require&channel_binding=require"
    assert normalize_database_url(neon) == "postgresql+asyncpg://u:p@ep-x.neon.tech/db?ssl=require"
    assert normalize_database_url("postgres://u:p@h/db") == "postgresql+asyncpg://u:p@h/db"
    local = "postgresql+asyncpg://mad:mad@localhost:5432/mad"
    assert normalize_database_url(local) == local
