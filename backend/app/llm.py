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

    def reset(self) -> None:
        self.calls.clear()

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


async def complete(
    role: str,
    system: str,
    messages: list[dict[str, str]],
    schema: type[T] | None = None,
    profile: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> T | str:
    """
    Call an LLM via LiteLLM and return a validated Pydantic model (or raw text).

    - Uses strict JSON schema output on GPT-OSS models.
    - Uses JSON mode + Pydantic validation + 1 retry on parse errors for other models.
    - Sleeps for `retry-after` on HTTP 429 rate-limit errors.
    - Logs token usage into `usage_tracker`.
    """
    config = _load_config()
    defaults = config["defaults"]
    prof = get_profile_config(profile)
    model_id = get_model_id(role, profile)

    temp = temperature if temperature is not None else defaults["temperature"]
    max_tok = max_tokens if max_tokens is not None else defaults["max_tokens"]
    max_retries = int(defaults.get("max_retries", 1))
    backoff_base = float(defaults.get("backoff_base", 2.0))

    system_content = system
    user_messages = [dict(m) for m in messages]

    kwargs: dict[str, Any] = {
        "model": model_id,
        "temperature": temp,
        "max_tokens": max_tok,
    }
    if prof.get("base_url"):
        kwargs["api_base"] = prof["base_url"]

    if schema is not None:
        json_schema = _make_strict_schema(schema.model_json_schema())
        if "gpt-oss" in model_id:
            kwargs["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": schema.__name__,
                    "strict": True,
                    "schema": json_schema,
                },
            }
        else:
            kwargs["response_format"] = {"type": "json_object"}
            system_content = (
                f"{system_content}\n\n"
                f"Respond ONLY with valid JSON matching this schema:\n"
                f"{json.dumps(json_schema, indent=2)}"
            )

    call_messages = [{"role": "system", "content": system_content}, *user_messages]
    kwargs["messages"] = call_messages

    rate_limit_retries = 3
    parse_attempts = 0
    rate_attempts = 0

    while True:
        try:
            response = await litellm.acompletion(**kwargs)
            usage = getattr(response, "usage", None)
            if usage:
                usage_dict = usage.model_dump() if hasattr(usage, "model_dump") else dict(usage)
                usage_tracker.log(role, model_id, usage_dict)

            content = response.choices[0].message.content or ""
            if schema is not None:
                return _parse_response(content, schema)
            return content

        except litellm.RateLimitError as exc:
            if rate_attempts >= rate_limit_retries:
                raise
            wait_sec = _get_retry_after(exc)
            rate_attempts += 1
            logger.warning(
                "Rate limited (429) on %s (%d/%d); sleeping %.1fs",
                model_id,
                rate_attempts,
                rate_limit_retries,
                wait_sec,
            )
            await asyncio.sleep(wait_sec)

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
