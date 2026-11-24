"""
CLI entrypoint — run a debate from the terminal (005 §Step 7).

Usage:
    uv run python -m app.cli "question" --rounds 2 --agents 2 [--profile groq]
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import re
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel

from app.engine.debate import run_debate
from app.llm import usage_tracker
from app.schemas import Debate

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(_ROOT / ".env")

console = Console(legacy_windows=False)


def _slugify(text: str, max_len: int = 40) -> str:
    slug = re.sub(r"[^\w\s-]", "", text.lower())
    slug = re.sub(r"[\s_]+", "-", slug).strip("-")
    return slug[:max_len] or "debate"


def _print_event(event: str, data: dict[str, Any]) -> None:
    if event == "debate_started":
        console.print(Panel(f"[bold]{data['question']}[/bold]", title="Debate Started"))
    elif event == "round_started":
        console.print(f"\n[bold cyan]=== Round {data['round']} ({data['kind']}) ===[/bold cyan]")
    elif event == "agent_thinking":
        console.print(f"  [dim]... {data['agent_id']} is thinking[/dim]")
    elif event == "argument":
        stance = data.get("stance", "neutral")
        color = "green" if stance == "pro" else "red" if stance == "con" else "yellow"
        title = f"[{color}]{stance.upper()}[/{color}] — {data.get('agent_id', '')}"
        conf = data.get("confidence", 0.0)
        console.print(
            Panel(
                data.get("text", ""),
                title=title,
                subtitle=f"confidence: {conf:.0%}",
                border_style=color,
            )
        )
        for claim in data.get("claims", []):
            console.print(f"  - {claim}")
    elif event == "verdict":
        console.print(
            Panel(
                f"[bold]{data.get('decision', '')}[/bold]\n\n"
                f"Confidence: {data.get('confidence', 0.0):.0%}\n\n"
                f"{data.get('reasoning', '')}",
                title="Verdict",
                border_style="blue",
            )
        )
        if data.get("winning_points"):
            console.print("[bold]Winning points:[/bold]")
            for pt in data["winning_points"]:
                console.print(f"  + {pt}")
        if data.get("open_disagreements"):
            console.print("[bold]Open disagreements:[/bold]")
            for pt in data["open_disagreements"]:
                console.print(f"  ? {pt}")


async def _run_cli(args: argparse.Namespace) -> Debate:
    debate = await run_debate(
        question=args.question,
        num_agents=args.agents,
        num_rounds=args.rounds,
        profile=args.profile,
        on_event=_print_event,
    )

    runs_dir = Path(__file__).resolve().parent.parent / "runs"
    runs_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    slug = _slugify(args.question)
    output_path = runs_dir / f"{timestamp}-{slug}.json"

    payload = debate.model_dump()
    payload["meta"] = {
        "profile": args.profile or "groq",
        "usage": usage_tracker.summary(),
    }

    output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    console.print(f"\n[bold green]Saved transcript to {output_path}[/bold green]")
    console.print(f"Total tokens used: {usage_tracker.total_tokens}")
    return debate


def main() -> None:
    parser = argparse.ArgumentParser(description="Multi-Agent Debate CLI (MVP)")
    parser.add_argument("question", help="Question to debate")
    parser.add_argument("--rounds", type=int, default=2, help="Number of rebuttal rounds")
    parser.add_argument("--agents", type=int, default=2, help="Number of advocates")
    parser.add_argument("--profile", default=None, help="Model profile (groq/kaggle/local)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable debug logs")
    args = parser.parse_args()

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.WARNING)
    asyncio.run(_run_cli(args))


if __name__ == "__main__":
    main()
