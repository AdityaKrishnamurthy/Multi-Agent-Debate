"""Runtime settings for the API (plan 007), read from the repo-root .env."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT / ".env")

DEFAULT_DATABASE_URL = "postgresql+asyncpg://mad:mad@localhost:5432/mad"


def _env(name: str, default: str) -> str:
    value = os.getenv(name, "").strip()
    return value or default


@dataclass(frozen=True)
class Settings:
    database_url: str = field(default_factory=lambda: _env("DATABASE_URL", DEFAULT_DATABASE_URL))
    cors_origins: list[str] = field(
        default_factory=lambda: [
            o.strip()
            for o in _env("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
        ]
    )
    # Optional regex for extra origins, e.g. Vercel previews: https://.*\.vercel\.app
    cors_origin_regex: str | None = field(
        default_factory=lambda: os.getenv("CORS_ORIGIN_REGEX", "").strip() or None
    )
    llm_profile: str | None = field(default_factory=lambda: os.getenv("LLM_PROFILE") or None)
    # Cost guards: Groq free-tier limits are per organisation, so keep debates small and serial.
    max_agents: int = field(default_factory=lambda: int(_env("MAX_AGENTS", "5")))
    max_rebuttals: int = field(default_factory=lambda: int(_env("MAX_REBUTTALS", "3")))
    max_concurrent_debates: int = field(
        default_factory=lambda: int(_env("MAX_CONCURRENT_DEBATES", "1"))
    )


def get_settings() -> Settings:
    return Settings()
