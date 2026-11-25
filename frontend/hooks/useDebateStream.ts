"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMockDebate } from "@/lib/mock-debates";
import type {
  Argument,
  Debate,
  DebateStreamEvent,
  Round,
  RoundKind,
} from "@/lib/types";

export type StreamStatus = "idle" | "streaming" | "complete" | "error";

export interface UseDebateStreamResult {
  debate: Debate | null;
  status: StreamStatus;
  currentRound: number;
  currentKind: RoundKind | "verdict" | null;
  thinkingAgentId: string | null;
  events: DebateStreamEvent[];
  isDemoMode: boolean;
  /** Total rounds the debate will have (known up front in replay mode). */
  expectedRounds: number;
  skipToEnd: () => void;
  replay: () => void;
}

interface ScheduledStep {
  delayMs: number;
  event: DebateStreamEvent;
}

function buildReplayPlan(source: Debate): ScheduledStep[] {
  const steps: ScheduledStep[] = [];

  // Stream initial evidence items into the pool
  for (const ev of source.evidence) {
    steps.push({
      delayMs: 220,
      event: { type: "evidence_added", data: ev },
    });
  }

  for (const round of source.rounds) {
    steps.push({
      delayMs: 450,
      event: {
        type: "round_started",
        data: { round: round.number, kind: round.kind },
      },
    });

    for (const arg of round.arguments) {
      steps.push({
        delayMs: 550,
        event: { type: "agent_thinking", data: { agent_id: arg.agent_id } },
      });

      // Emit the argument without critique first so the Critic arrives as its own event
      const argWithoutCritique: Argument & { round_number: number } = {
        ...arg,
        critique: null,
        round_number: round.number,
      };
      steps.push({
        delayMs: 800,
        event: { type: "argument", data: argWithoutCritique },
      });

      if (arg.critique) {
        steps.push({
          delayMs: 450,
          event: {
            type: "agent_thinking",
            data: { agent_id: arg.critique.by_agent },
          },
        });
        steps.push({
          delayMs: 650,
          event: {
            type: "critique",
            data: {
              argument_id: arg.id,
              ...arg.critique,
            },
          },
        });
      }
    }
  }

  if (source.verdict) {
    steps.push({
      delayMs: 700,
      event: { type: "verdict", data: source.verdict },
    });
  }

  return steps;
}

function applyEvent(prev: Debate, event: DebateStreamEvent): Debate {
  switch (event.type) {
    case "evidence_added": {
      const exists = prev.evidence.some((e) => e.id === event.data.id);
      if (exists) return prev;
      return { ...prev, evidence: [...prev.evidence, event.data] };
    }
    case "round_started": {
      const exists = prev.rounds.some((r) => r.number === event.data.round);
      if (exists) return prev;
      const newRound: Round = {
        number: event.data.round,
        kind: event.data.kind,
        arguments: [],
      };
      return { ...prev, rounds: [...prev.rounds, newRound] };
    }
    case "argument": {
      const { round_number, ...arg } = event.data;
      const targetRoundNumber =
        round_number ??
        (prev.rounds.length > 0
          ? prev.rounds[prev.rounds.length - 1].number
          : 1);

      const hasRound = prev.rounds.some((r) => r.number === targetRoundNumber);
      const rounds = hasRound
        ? prev.rounds.map((r) => {
            if (r.number !== targetRoundNumber) return r;
            if (r.arguments.some((a) => a.id === arg.id)) return r;
            return { ...r, arguments: [...r.arguments, arg] };
          })
        : [
            ...prev.rounds,
            {
              number: targetRoundNumber,
              kind: "opening" as RoundKind,
              arguments: [arg],
            },
          ];
      return { ...prev, rounds };
    }
    case "critique": {
      const { argument_id, ...critique } = event.data;
      const rounds = prev.rounds.map((r) => ({
        ...r,
        arguments: r.arguments.map((a) =>
          a.id === argument_id ? { ...a, critique } : a
        ),
      }));
      return { ...prev, rounds };
    }
    case "verdict": {
      return { ...prev, verdict: event.data };
    }
    default:
      return prev;
  }
}

export function useDebateStream(
  id: string,
  options?: { customQuestion?: string; demo?: boolean }
): UseDebateStreamResult {
  const sourceDebate = getMockDebate(id);
  const customQuestion = options?.customQuestion?.trim();
  const isDemoMode = true; // Phase 1 mock replay; Plan 007 wires EventSource here

  const initialShell = useCallback((): Debate => {
    return {
      ...sourceDebate,
      question: customQuestion || sourceDebate.question,
      rounds: [],
      evidence: [],
      verdict: null,
    };
  }, [sourceDebate, customQuestion]);

  const [debate, setDebate] = useState<Debate | null>(initialShell);
  const [status, setStatus] = useState<StreamStatus>("streaming");
  const [currentRound, setCurrentRound] = useState<number>(0);
  const [currentKind, setCurrentKind] = useState<RoundKind | "verdict" | null>(
    null
  );
  const [thinkingAgentId, setThinkingAgentId] = useState<string | null>(null);
  const [events, setEvents] = useState<DebateStreamEvent[]>([]);
  const [runSeed, setRunSeed] = useState(0);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) {
      clearTimeout(t);
    }
    timersRef.current = [];
  }, []);

  const skipToEnd = useCallback(() => {
    clearTimers();
    setDebate({
      ...sourceDebate,
      question: customQuestion || sourceDebate.question,
    });
    const lastRound =
      sourceDebate.rounds[sourceDebate.rounds.length - 1]?.number ?? 0;
    setCurrentRound(lastRound);
    setCurrentKind(sourceDebate.verdict ? "verdict" : null);
    setThinkingAgentId(null);
    setStatus("complete");
  }, [clearTimers, sourceDebate, customQuestion]);

  const replay = useCallback(() => {
    clearTimers();
    setRunSeed((n) => n + 1);
  }, [clearTimers]);

  useEffect(() => {
    clearTimers();

    const resetTimer = setTimeout(() => {
      setDebate(initialShell());
      setStatus("streaming");
      setCurrentRound(0);
      setCurrentKind(null);
      setThinkingAgentId(null);
      setEvents([]);
    }, 0);
    timersRef.current.push(resetTimer);

    const plan = buildReplayPlan(sourceDebate);
    let elapsed = 200;

    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      elapsed += step.delayMs;
      const isLast = i === plan.length - 1;

      const timer = setTimeout(() => {
        const ev = step.event;
        setEvents((prev) => [...prev, ev]);

        if (ev.type === "agent_thinking") {
          setThinkingAgentId(ev.data.agent_id);
        } else {
          setThinkingAgentId(null);
        }

        if (ev.type === "round_started") {
          setCurrentRound(ev.data.round);
          setCurrentKind(ev.data.kind);
        } else if (ev.type === "verdict") {
          setCurrentKind("verdict");
        }

        setDebate((prev) => (prev ? applyEvent(prev, ev) : prev));

        if (isLast) {
          setStatus("complete");
          setThinkingAgentId(null);
        }
      }, elapsed);

      timersRef.current.push(timer);
    }

    return () => {
      clearTimers();
    };
  }, [clearTimers, initialShell, sourceDebate, runSeed]);

  return {
    debate,
    status,
    currentRound,
    currentKind,
    thinkingAgentId,
    events,
    isDemoMode,
    expectedRounds: Math.max(
      sourceDebate.rounds.length,
      debate?.rounds.length ?? 0
    ),
    skipToEnd,
    replay,
  };
}
