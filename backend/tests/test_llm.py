"""Unit tests for LLM wrapper: JSON parsing, retry on validation error, and 429 backoff."""

from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import httpx
import litellm
import pytest

from app.llm import complete, key_pool, throttle, usage_tracker
from app.schemas import AdvocateOutput

PROVIDERS = ("GROQ", "MISTRAL", "NVIDIA_NIM", "TOKENHARBOR")
KEY_VARS = [f"{p}_API_KEY{s}" for p in PROVIDERS for s in ("", "_2", "_3")]


@pytest.fixture(autouse=True)
def isolated_keys(monkeypatch):
    """Tests control exactly which API keys exist; never use the real .env keys."""
    for name in KEY_VARS:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("GROQ_API_KEY", "test-groq-1")
    key_pool.reset()
    throttle.reset()
    yield
    key_pool.reset()
    throttle.reset()


def _rate_error(retry_after: str = "0.5"):
    return litellm.RateLimitError(
        message="Rate limit",
        llm_provider="groq",
        model="groq/openai/gpt-oss-20b",
        response=httpx.Response(429, headers={"retry-after": retry_after}),
    )


VALID_ADVOCATE = json.dumps(
    {"text": "OK.", "claims": ["C1"], "rebuts": [], "evidence_ids": [], "confidence": 0.6}
)


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


@pytest.mark.asyncio
async def test_rate_limit_rotates_to_second_key_without_sleeping(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY_2", "test-groq-2")
    mock_acompletion = AsyncMock(side_effect=[_rate_error("30"), _fake_response(VALID_ADVOCATE)])
    mock_sleep = AsyncMock()
    with (
        patch("app.llm.litellm.acompletion", mock_acompletion),
        patch("app.llm.asyncio.sleep", mock_sleep),
    ):
        result = await complete(
            role="debater", system="S", messages=[], schema=AdvocateOutput, profile="groq"
        )
    assert result.text == "OK."
    keys_used = [c.kwargs["api_key"] for c in mock_acompletion.await_args_list]
    assert keys_used == ["test-groq-1", "test-groq-2"]
    mock_sleep.assert_not_awaited()


@pytest.mark.asyncio
async def test_all_groq_keys_limited_falls_back_to_mistral(monkeypatch):
    monkeypatch.setenv("MISTRAL_API_KEY", "test-mistral")
    usage_tracker.reset()
    mock_acompletion = AsyncMock(side_effect=[_rate_error("30"), _fake_response(VALID_ADVOCATE)])
    mock_sleep = AsyncMock()
    with (
        patch("app.llm.litellm.acompletion", mock_acompletion),
        patch("app.llm.asyncio.sleep", mock_sleep),
    ):
        await complete(
            role="debater", system="S", messages=[], schema=AdvocateOutput, profile="groq"
        )
    second = mock_acompletion.await_args_list[1].kwargs
    assert second["model"].startswith("mistral/")
    assert second["api_key"] == "test-mistral"
    assert second["response_format"] == {"type": "json_object"}
    assert usage_tracker.fallbacks == 1
    mock_sleep.assert_not_awaited()


@pytest.mark.asyncio
async def test_model_override_is_used():
    mock_acompletion = AsyncMock(return_value=_fake_response(VALID_ADVOCATE))
    with patch("app.llm.litellm.acompletion", mock_acompletion):
        await complete(
            role="debater",
            system="S",
            messages=[],
            schema=AdvocateOutput,
            model="groq/qwen/qwen3.8-27b",
        )
    assert mock_acompletion.await_args.kwargs["model"] == "groq/qwen/qwen3.8-27b"


@pytest.mark.asyncio
async def test_low_limit_model_is_paced_not_failed(monkeypatch):
    monkeypatch.setenv("MISTRAL_API_KEY", "test-mistral")
    mock_acompletion = AsyncMock(return_value=_fake_response(VALID_ADVOCATE))
    mock_sleep = AsyncMock()
    with (
        patch("app.llm.litellm.acompletion", mock_acompletion),
        patch("app.llm.asyncio.sleep", mock_sleep),
    ):
        for _ in range(2):
            await complete(
                role="debater",
                system="S",
                messages=[],
                schema=AdvocateOutput,
                model="mistral/ministral-14b-latest",
            )
    # 2 requests/minute: the second call waits about 30 seconds instead of hitting a 429.
    assert mock_sleep.await_count == 1
    assert 25 < mock_sleep.await_args.args[0] <= 30


@pytest.mark.asyncio
async def test_timeout_fails_over_to_next_provider(monkeypatch):
    monkeypatch.setenv("NVIDIA_NIM_API_KEY", "test-nim")
    timeout = litellm.Timeout(message="slow", model="groq/openai/gpt-oss-20b", llm_provider="groq")
    mock_acompletion = AsyncMock(side_effect=[timeout, _fake_response(VALID_ADVOCATE)])
    with patch("app.llm.litellm.acompletion", mock_acompletion):
        await complete(
            role="debater", system="S", messages=[], schema=AdvocateOutput, profile="groq"
        )
    second = mock_acompletion.await_args_list[1].kwargs
    assert second["model"] == "nvidia_nim/nvidia/nemotron-3.5-lightning-30b-a3b"
    assert second["api_key"] == "test-nim"
    assert second["timeout"] > 0


@pytest.mark.asyncio
async def test_tokenharbor_routes_through_openai_compatible_base(monkeypatch):
    monkeypatch.setenv("TOKENHARBOR_API_KEY", "test-th")
    mock_acompletion = AsyncMock(return_value=_fake_response(VALID_ADVOCATE))
    with patch("app.llm.litellm.acompletion", mock_acompletion):
        await complete(
            role="debater",
            system="S",
            messages=[],
            schema=AdvocateOutput,
            model="tokenharbor/deepseek-v4-flash:free",
        )
    kw = mock_acompletion.await_args.kwargs
    assert kw["model"] == "openai/deepseek-v4-flash:free"
    assert kw["api_base"] == "https://tokenharbor.ai/v1"
    assert kw["api_key"] == "test-th"


@pytest.mark.asyncio
async def test_fallback_never_returns_to_a_model_already_tried(monkeypatch):
    monkeypatch.setenv("NVIDIA_NIM_API_KEY", "test-nim")
    errors = [_rate_error("30"), _rate_error("30")]  # groq, then nim, both limited
    mock_acompletion = AsyncMock(side_effect=[*errors, _fake_response(VALID_ADVOCATE)])
    mock_sleep = AsyncMock()
    with (
        patch("app.llm.litellm.acompletion", mock_acompletion),
        patch("app.llm.asyncio.sleep", mock_sleep),
    ):
        await complete(
            role="debater", system="S", messages=[], schema=AdvocateOutput, profile="groq"
        )
    models = [c.kwargs["model"] for c in mock_acompletion.await_args_list]
    assert models[0].startswith("groq/") and models[1].startswith("nvidia_nim/")
    # No usable fallback left (groq already tried), so it waits out the cooldown and
    # retries NIM rather than bouncing back to Groq.
    assert models[2] == models[1]
    assert any(c.args[0] >= 25 for c in mock_sleep.await_args_list)
