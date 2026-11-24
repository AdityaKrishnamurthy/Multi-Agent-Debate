"""Unit tests for LLM wrapper: JSON parsing, retry on validation error, and 429 backoff."""

from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import httpx
import litellm
import pytest

from app.llm import complete, usage_tracker
from app.schemas import AdvocateOutput


def _fake_response(content: str, total_tokens: int = 100):
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content))],
        usage={"prompt_tokens": 60, "completion_tokens": 40, "total_tokens": total_tokens},
    )


@pytest.mark.asyncio
async def test_complete_parses_valid_json_and_logs_usage():
    usage_tracker.reset()
    payload = {
        "text": "Strong argument.",
        "claims": ["Claim 1", "Claim 2", "Claim 3"],
        "rebuts": [],
        "evidence_ids": [],
        "confidence": 0.85,
    }
    mock_acompletion = AsyncMock(return_value=_fake_response(json.dumps(payload), 123))

    with patch("app.llm.litellm.acompletion", mock_acompletion):
        result = await complete(
            role="debater",
            system="You are an advocate.",
            messages=[{"role": "user", "content": "Argue"}],
            schema=AdvocateOutput,
            profile="groq",
        )

    assert isinstance(result, AdvocateOutput)
    assert result.confidence == 0.85
    assert usage_tracker.total_tokens == 123


@pytest.mark.asyncio
async def test_complete_retries_once_on_parse_error():
    usage_tracker.reset()
    valid = json.dumps(
        {
            "text": "Fixed output.",
            "claims": ["C1"],
            "rebuts": [],
            "evidence_ids": [],
            "confidence": 0.7,
        }
    )
    mock_acompletion = AsyncMock(
        side_effect=[
            _fake_response("not valid json"),
            _fake_response(valid),
        ]
    )

    with patch("app.llm.litellm.acompletion", mock_acompletion):
        result = await complete(
            role="critic",
            system="System",
            messages=[{"role": "user", "content": "Evaluate"}],
            schema=AdvocateOutput,
            profile="groq",
        )

    assert isinstance(result, AdvocateOutput)
    assert result.text == "Fixed output."
    assert mock_acompletion.call_count == 2


@pytest.mark.asyncio
async def test_complete_waits_on_rate_limit():
    usage_tracker.reset()
    valid = json.dumps(
        {
            "text": "After backoff.",
            "claims": ["C1"],
            "rebuts": [],
            "evidence_ids": [],
            "confidence": 0.6,
        }
    )
    fake_resp = httpx.Response(429, headers={"retry-after": "0.5"})
    rate_err = litellm.RateLimitError(
        message="Rate limit",
        llm_provider="groq",
        model="groq/openai/gpt-oss-20b",
        response=fake_resp,
    )
    mock_acompletion = AsyncMock(side_effect=[rate_err, _fake_response(valid)])
    mock_sleep = AsyncMock()

    with (
        patch("app.llm.litellm.acompletion", mock_acompletion),
        patch("app.llm.asyncio.sleep", mock_sleep),
    ):
        result = await complete(
            role="debater",
            system="System",
            messages=[{"role": "user", "content": "Hi"}],
            schema=AdvocateOutput,
            profile="groq",
        )

    assert result.text == "After backoff."
    mock_sleep.assert_awaited_once_with(0.5)
