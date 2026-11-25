"""Rebuild a partial transcript from stream events (mirrors the frontend's applyEvent).

Used by GET /api/debates/{id} while a debate is still running.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from app.db.store import StoredEvent


def build_live_debate(events: list[StoredEvent]) -> dict[str, Any] | None:
    debate: dict[str, Any] | None = None
    current_round = 0

    for ev in events:
        data = ev.data
        if ev.type == "debate_started":
            debate = deepcopy(data.get("debate") or {})
            debate.setdefault("rounds", [])
            debate.setdefault("evidence", [])
            debate["verdict"] = None
            continue
        if debate is None:
            continue

        if ev.type == "round_started":
            current_round = int(data["round"])
            if not any(r["number"] == current_round for r in debate["rounds"]):
                debate["rounds"].append(
                    {"number": current_round, "kind": data["kind"], "arguments": []}
                )
        elif ev.type == "argument":
            arg = {k: v for k, v in data.items() if k != "round_number"}
            number = int(data.get("round_number") or current_round or 1)
            rnd = next((r for r in debate["rounds"] if r["number"] == number), None)
            if rnd is None:
                rnd = {"number": number, "kind": "opening", "arguments": []}
                debate["rounds"].append(rnd)
            if not any(a["id"] == arg["id"] for a in rnd["arguments"]):
                rnd["arguments"].append(arg)
        elif ev.type == "critique":
            arg_id = data.get("argument_id")
            critique = {k: v for k, v in data.items() if k != "argument_id"}
            for rnd in debate["rounds"]:
                for arg in rnd["arguments"]:
                    if arg["id"] == arg_id:
                        arg["critique"] = critique
        elif ev.type == "evidence_added":
            if not any(e["id"] == data["id"] for e in debate["evidence"]):
                debate["evidence"].append(data)
        elif ev.type == "verdict":
            debate["verdict"] = data

    return debate
