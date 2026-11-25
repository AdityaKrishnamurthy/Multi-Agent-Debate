"""
LLM wrapper — unified interface across Groq, Kaggle vLLM, and local Ollama (005 §Step 4).

Routes calls through LiteLLM based on profiles in `app/config/models.yaml`.
Handles strict JSON schema on GPT-OSS, best-effort JSON + Pydantic validation +
1 retry on parse error, HTTP 429 retry-after backoff, and per-call token usage logging.
"""

from __future__ import annotations

import asyncio
import copy
import json
import logging
import os
import re
import time
from pathlib import Path
from typing import Any, TypeVar

import litellm
import yaml
from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

litellm.suppress_debug_info = True
litellm.set_verbose = False

_CONFIG: dict[str, Any] | None = None


def _load_config() -> dict[str, Any]:
    global _CONFIG
    if _CONFIG is None:
        config_path = Path(__file__).parent / "config" / "models.yaml"
        with open(config_path, encoding="utf-8") as f:
            _CONFIG = yaml.safe_load(f)
    return _CONFIG


def get_profile_config(profile: str | None = None) -> dict[str, Any]:
    """Return the configuration dict for the active profile."""
    config = _load_config()
    name = profile or os.getenv("LLM_PROFILE") or config["defaults"]["profile"]
    if name not in config["profiles"]:
        raise ValueError(f"Unknown LLM profile: {name}")
    return config["profiles"][name]


def get_raw_model_id(role: str, profile: str | None = None) -> str:
    """Return the provider-agnostic model ID configured for a role."""
    prof = get_profile_config(profile)
    models = prof["models"]
    return models.get(role, models["debater"])


def get_model_id(role: str, profile: str | None = None) -> str:
    """Return the LiteLLM-prefixed model string for a given role and profile."""
    prof = get_profile_config(profile)
    provider = prof["provider"]
    model_id = get_raw_model_id(role, profile)
    if provider == "groq":
        return f"groq/{model_id}"
    if provider == "hosted_vllm":
        return f"hosted_vllm/{model_id}"
    if provider == "ollama":
        return f"ollama/{model_id}"
    return model_id


class UsageTracker:
    """Accumulates token usage across LLM calls for a run."""

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []
        self.fallbacks = 0  # calls that switched to a fallback model after a 429

    def reset(self) -> None:
        self.calls.clear()
        self.fallbacks = 0

    def log(self, role: str, model: str, usage: dict[str, Any]) -> None:
        prompt_tokens = int(usage.get("prompt_tokens", 0) or 0)
        completion_tokens = int(usage.get("completion_tokens", 0) or 0)
        total_tokens = int(usage.get("total_tokens", prompt_tokens + completion_tokens) or 0)
        entry = {
            "role": role,
            "model": model,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "timestamp": time.time(),
        }
        self.calls.append(entry)
        logger.debug("Token usage: %s", entry)

    @property
    def total_tokens(self) -> int:
        return sum(c["total_tokens"] for c in self.calls)

    def summary(self) -> dict[str, Any]:
        return {
            "total_calls": len(self.calls),
            "total_tokens": self.total_tokens,
            "fallbacks": self.fallbacks,
            "calls": list(self.calls),
        }


usage_tracker = UsageTracker()


def _make_strict_schema(schema_dict: dict[str, Any]) -> dict[str, Any]:
    """Ensure JSON schema satisfies OpenAI/Groq strict mode requirements."""
    strict = copy.deepcopy(schema_dict)

    def _visit(node: Any) -> None:
        if not isinstance(node, dict):
            return
        if node.get("type") == "object":
            node.setdefault("additionalProperties", False)
            props = node.get("properties")
            if isinstance(props, dict):
                node["required"] = list(props.keys())
        for val in node.values():
            if isinstance(val, dict):
                _visit(val)
            elif isinstance(val, list):
                for item in val:
                    _visit(item)

    _visit(strict)
    return strict


def _strip_think_and_fences(content: str) -> str:
    """Remove optional <think>...</think> blocks and markdown code fences."""
    text = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
    if text.startswith("```"):
        lines = text.splitlines()
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def _parse_response(content: str, schema: type[T]) -> T:
    """Parse LLM JSON text into a Pydantic model."""
    cleaned = _strip_think_and_fences(content)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            raise
        data = json.loads(match.group(0))
    return schema.model_validate(data)


def _get_retry_after(error: Exception) -> float:
    """Extract retry-after header from a 429 error, defaulting to 5.0 seconds."""
    for holder in (error, getattr(error, "response", None)):
        headers = getattr(holder, "headers", None)
        if headers:
            raw = headers.get("retry-after") or headers.get("Retry-After")
            if raw is not None:
                try:
                    return max(0.5, float(raw))
                except ValueError:
                    pass
    match = re.search(r"try again in ([0-9]+(?:\.[0-9]+)?)s", str(error), re.IGNORECASE)
    if match:
        return max(0.5, float(match.group(1)))
    return 5.0


class KeyPool:
    """API keys per provider, with a cooldown per key after a 429.

    Keys come from the environment: GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3, ...
    (likewise MISTRAL_API_KEY, MISTRAL_API_KEY_2, ...). Groq free-tier limits are per
    account, so keys from different accounts give independent rate limits.
    """

    def __init__(self) -> None:
        self._cooldown_until: dict[str, float] = {}

    @staticmethod
    def keys(provider: str) -> list[str]:
        base = f"{provider.upper()}_API_KEY"
        names = [base] + [f"{base}_{n}" for n in range(2, 10)]
        return [v for v in (os.getenv(n, "").strip() for n in names) if v]

    def available(self, provider: str) -> list[str]:
        now = time.monotonic()
        return [k for k in self.keys(provider) if self._cooldown_until.get(k, 0.0) <= now]

    def pick(self, provider: str, avoid: str | None = None) -> str | None:
        """An available key, preferring one other than `avoid`."""
        free = self.available(provider)
        others = [k for k in free if k != avoid]
        return (others or free or [None])[0]

    def cool(self, key: str | None, seconds: float) -> None:
        if key:
            self._cooldown_until[key] = time.monotonic() + seconds

    def seconds_until_free(self, provider: str) -> float:
        now = time.monotonic()
        waits = [self._cooldown_until.get(k, 0.0) - now for k in self.keys(provider)]
        return max(0.0, min(waits)) if waits else 0.0

    def reset(self) -> None:
        self._cooldown_until.clear()


key_pool = KeyPool()


class Throttle:
    """Client-side pacing for models with very low request limits.

    `rate_limits` in models.yaml maps a full model id to requests per minute
    (e.g. Mistral's free tier allows 2/min on ministral-14b). Calls to that model
    are spaced out so they slow down instead of failing with 429s.
    """

    def __init__(self) -> None:
        self._locks: dict[str, asyncio.Lock] = {}
        self._last: dict[str, float] = {}

    async def wait(self, model_id: str, per_minute: float | None) -> None:
        if not per_minute:
            return
        lock = self._locks.setdefault(model_id, asyncio.Lock())
        async with lock:
            gap = 60.0 / per_minute
            delay = self._last.get(model_id, 0.0) + gap - time.monotonic()
            if delay > 0:
                logger.info("Pacing %s: waiting %.1fs (free-tier limit)", model_id, delay)
                await asyncio.sleep(delay)
            self._last[model_id] = time.monotonic()

    def reset(self) -> None:
        self._last.clear()


throttle = Throttle()


def available_debate_models() -> list[dict[str, Any]]:
    """Debater models offered in the UI whose provider has an API key configured."""
    config = _load_config()
    return [m for m in config.get("debate_models", []) if KeyPool.keys(provider_of(m["id"]))]


def default_debate_model(profile: str | None = None) -> str:
    return get_model_id("debater", profile)


def rate_limit_for(config: dict[str, Any], model_id: str) -> float | None:
    value = config.get("rate_limits", {}).get(model_id)
    return float(value) if value else None


def provider_of(model_id: str) -> str:
    """LiteLLM provider prefix, e.g. "groq" for "groq/openai/gpt-oss-20b"."""
    return model_id.split("/", 1)[0] if "/" in model_id else ""


def _fallback_models(config: dict[str, Any], current: str) -> list[str]:
    """Configured fallbacks for the current provider whose provider has a key."""
    fallbacks = config.get("fallbacks", {}).get(provider_of(current), [])
    return [m for m in fallbacks if m != current and KeyPool.keys(provider_of(m))]


def _response_format(
    model_id: str, schema: type[BaseModel] | None, system: str
) -> tuple[dict[str, Any] | None, str]:
    """Strict JSON schema on GPT-OSS; JSON mode + schema in the prompt elsewhere."""
    if schema is None:
        return None, system
    json_schema = _make_strict_schema(schema.model_json_schema())
    if "gpt-oss" in model_id:
        return {
            "type": "json_schema",
            "json_schema": {"name": schema.__name__, "strict": True, "schema": json_schema},
        }, system
    return {"type": "json_object"}, (
        f"{system}\n\nRespond ONLY with valid JSON matching this schema:\n"
        f"{json.dumps(json_schema, indent=2)}"
    )


async def complete(
    role: str,
    system: str,
    messages: list[dict[str, str]],
    schema: type[T] | None = None,
    profile: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
    model: str | None = None,
) -> T | str:
    """
    Call an LLM via LiteLLM and return a validated Pydantic model (or raw text).

    - `model` overrides the role's configured model (full LiteLLM id, e.g.
      "mistral/mistral-small-latest").
    - Uses strict JSON schema output on GPT-OSS models, JSON mode elsewhere,
      with Pydantic validation and 1 retry on parse errors.
    - On HTTP 429: rotate to another key for the same provider; if every key is
      cooling down, switch to a configured fallback model (`fallbacks` in
      models.yaml); only then wait for `retry-after`.
    - Logs token usage into `usage_tracker`.
    """
    config = _load_config()
    defaults = config["defaults"]
    prof = get_profile_config(profile)
    model_id = model or get_model_id(role, profile)

    temp = temperature if temperature is not None else defaults["temperature"]
    max_tok = max_tokens if max_tokens is not None else defaults["max_tokens"]
    max_retries = int(defaults.get("max_retries", 1))
    backoff_base = float(defaults.get("backoff_base", 2.0))
    user_messages = [dict(m) for m in messages]

    def build_kwargs(mid: str) -> tuple[dict[str, Any], list[dict[str, str]]]:
        fmt, system_content = _response_format(mid, schema, system)
        msgs = [{"role": "system", "content": system_content}, *user_messages]
        kw: dict[str, Any] = {
            "model": mid,
            "temperature": temp,
            "max_tokens": max_tok,
            "messages": msgs,
        }
        if fmt is not None:
            kw["response_format"] = fmt
        if prof.get("base_url") and provider_of(mid) == prof.get("provider"):
            kw["api_base"] = prof["base_url"]
        return kw, msgs

    kwargs, call_messages = build_kwargs(model_id)
    provider = provider_of(model_id)
    api_key = key_pool.pick(provider)

    rate_limit_waits = 3  # sleeps, once every key and fallback is exhausted
    max_switches = 6  # key rotations + fallback switches per call
    parse_attempts = 0
    rate_waits = 0
    switches = 0

    while True:
        try:
            call_kwargs = dict(kwargs)
            if api_key:
                call_kwargs["api_key"] = api_key
            await throttle.wait(model_id, rate_limit_for(config, model_id))
            response = await litellm.acompletion(**call_kwargs)
            usage = getattr(response, "usage", None)
            if usage:
                usage_dict = usage.model_dump() if hasattr(usage, "model_dump") else dict(usage)
                usage_tracker.log(role, model_id, usage_dict)

            content = response.choices[0].message.content or ""
            if schema is not None:
                return _parse_response(content, schema)
            return content

        except litellm.RateLimitError as exc:
            wait_sec = _get_retry_after(exc)
            per_minute = rate_limit_for(config, model_id)
            if per_minute:  # providers like Mistral send no retry-after header
                wait_sec = max(wait_sec, 60.0 / per_minute)
            key_pool.cool(api_key, wait_sec)

            next_key = key_pool.pick(provider, avoid=api_key)
            if next_key and next_key != api_key and switches < max_switches:
                switches += 1
                logger.warning("Rate limited on %s; switching to another API key", model_id)
                api_key = next_key
                continue

            fallbacks = _fallback_models(config, model_id)
            if fallbacks and switches < max_switches:
                switches += 1
                previous = model_id
                model_id = fallbacks[0]
                provider = provider_of(model_id)
                api_key = key_pool.pick(provider)
                kwargs, call_messages = build_kwargs(model_id)
                usage_tracker.fallbacks += 1
                logger.warning("Rate limited on %s; falling back to %s", previous, model_id)
                continue

            if rate_waits >= rate_limit_waits:
                raise
            rate_waits += 1
            wait_sec = max(0.5, key_pool.seconds_until_free(provider) or wait_sec)
            logger.warning(
                "Rate limited (429) on %s (%d/%d); sleeping %.1fs",
                model_id,
                rate_waits,
                rate_limit_waits,
                wait_sec,
            )
            await asyncio.sleep(wait_sec)
            api_key = key_pool.pick(provider) or api_key

        except (ValidationError, json.JSONDecodeError) as exc:
            if parse_attempts >= max_retries:
                raise
            parse_attempts += 1
            logger.warning(
                "Schema parse failed on %s (%d/%d): %s. Retrying...",
                model_id,
                parse_attempts,
                max_retries,
                str(exc)[:200],
            )
            kwargs["messages"] = [
                *call_messages,
                {
                    "role": "user",
                    "content": (
                        f"Your previous response did not match the required JSON schema "
                        f"({exc}). Return ONLY valid JSON matching the schema."
                    ),
                },
            ]

        except Exception as exc:
            if parse_attempts >= max_retries:
                raise
            parse_attempts += 1
            wait_sec = backoff_base ** (parse_attempts - 1)
            logger.warning(
                "Transient LLM error on %s (%d/%d): %s. Retrying in %.1fs",
                model_id,
                parse_attempts,
                max_retries,
                str(exc)[:200],
                wait_sec,
            )
            await asyncio.sleep(wait_sec)
