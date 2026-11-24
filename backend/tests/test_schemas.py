"""Verify Pydantic schema matches frontend mock JSONs (005 §Step 2)."""

import json
from pathlib import Path

from app.schemas import Debate

ROOT = Path(__file__).resolve().parent.parent.parent
MOCK_DIR = ROOT / "frontend" / "mock"


def test_mock_debates_validate_against_schema():
    files = list(MOCK_DIR.glob("*.json"))
    assert len(files) >= 2, "Expected at least 2 mock debate JSON files"

    for path in files:
        raw = json.loads(path.read_text(encoding="utf-8"))
        debate = Debate.model_validate(raw)
        assert debate.schema_version == "1"
        assert len(debate.agents) >= 2
        assert len(debate.rounds) >= 1
        assert debate.verdict is not None
