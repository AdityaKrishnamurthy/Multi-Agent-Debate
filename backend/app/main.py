"""FastAPI application (plan 007).

Run:  uv run uvicorn app.main:app --reload     (from backend/, with `docker compose up -d db`)
Docs: http://localhost:8000/docs
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.api.runner import DebateRunner
from app.db.store import PostgresStore, Store
from app.engine.debate import CompleteFn
from app.settings import Settings, get_settings


def create_app(
    store: Store | None = None,
    complete_fn: CompleteFn | None = None,
    settings: Settings | None = None,
) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        active_store = store or PostgresStore(settings.database_url)
        app.state.settings = settings
        app.state.runner = DebateRunner(active_store, settings, complete_fn)
        yield
        await app.state.runner.shutdown()
        await active_store.close()

    app = FastAPI(
        title="Multi-Agent Debate API",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)
    return app


app = create_app()
