"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/api";
import { getMockDebate } from "@/lib/mock-debates";
import type {
  Argument,
  Debate,
  DebateStreamEvent,
  Round,
  RoundKind,
} from "@/lib/types";

export type StreamStatus = "idle" | "streaming" | "complete" | "error";

export interface StreamError {
  message: string;
  retryAfter?: number;
}

/** Event names the live API sends (plan 007). */
const LIVE_EVENTS = [
  "debate_started",
  "round_started",
  "agent_thinking",
  "argument",
  "critique",
  "evidence_added",
  "vote",
  "verdict",
  "error",
  "end",
] as const;

export interface UseDebateStreamResult {
  debate: Debate | null;
  status: StreamStatus;
  currentRound: number;
  currentKind: RoundKind | "verdict" | null;
  thinkingAgentId: string | null;
  events: DebateStreamEvent[];
  isDemoMode: boolean;
  /** Set when a live debate fails (rate limit, bad key, server unreachable). */
  error: StreamError | null;
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
  // Demo = replay a recorded JSON debate; otherwise stream a live one from the API.
  const isDemoMode = options?.demo ?? true;

  const initialShell = useCallback((): Debate => {
    return {
      ...sourceDebate,
      question: customQuestion || sourceDebate.question,
      rounds: [],
      evidence: [],
      verdict: null,
    };
  }, [sourceDebate, customQuestion]);

  const [debate, setDebate] = useState<Debate | null>(() =>
    isDemoMode ? initialShell() : null
  );
  const [status, setStatus] = useState<StreamStatus>("streaming");
  const [currentRound, setCurrentRound] = useState<number>(0);
  const [currentKind, setCurrentKind] = useState<RoundKind | "verdict" | null>(
    null
  );
  const [thinkingAgentId, setThinkingAgentId] = useState<string | null>(null);
  const [events, setEvents] = useState<DebateStreamEvent[]>([]);
  const [error, setError] = useState<StreamError | null>(null);
  const [runSeed, setRunSeed] = useState(0);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) {
      clearTimeout(t);
    }
    timersRef.current = [];
  }, []);

  /** Shared by replay and live mode: update UI state for one event. */
  const handleEvent = useCallback((ev: DebateStreamEvent) => {
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
  }, []);

  const skipToEnd = useCallback(() => {
    if (!isDemoMode) return;
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
  }, [isDemoMode, clearTimers, sourceDebate, customQuestion]);

  const replay = useCallback(() => {
    clearTimers();
    setRunSeed((n) => n + 1);
  }, [clearTimers]);

  // Demo mode: replay the recorded JSON with timed delays.
  useEffect(() => {
    if (!isDemoMode) return;
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
        handleEvent(step.event);
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
  }, [
    isDemoMode,
    clearTimers,
    initialShell,
    sourceDebate,
    runSeed,
    handleEvent,
  ]);

  // Live mode: stream the debate from the API over Server-Sent Events.
  useEffect(() => {
    if (isDemoMode) return;

    let finished = false;
    let gotAny = false;
    const source = new EventSource(`${API_URL}/api/debates/${id}/stream`);

    const reset = setTimeout(() => {
      setDebate(null);
      setStatus("streaming");
      setCurrentRound(0);
      setCurrentKind(null);
      setThinkingAgentId(null);
      setEvents([]);
      setError(null);
    }, 0);

    const onMessage =
      (type: (typeof LIVE_EVENTS)[number]) => (e: MessageEvent) => {
        gotAny = true;
        const data = JSON.parse(e.data);
        if (type === "debate_started") {
          const shell = data.debate as Debate;
          setDebate({ ...shell, rounds: [], evidence: [], verdict: null });
          return;
        }
        if (type === "end") {
          finished = true;
          source.close();
          setThinkingAgentId(null);
          setStatus((s) => (s === "error" ? s : "complete"));
          return;
        }
        if (type === "error") {
          setError({ message: data.message, retryAfter: data.retry_after });
          setStatus("error");
          setThinkingAgentId(null);
          return;
        }
        handleEvent({ type, data } as DebateStreamEvent);
      };

    for (const type of LIVE_EVENTS) {
      source.addEventListener(type, onMessage(type) as EventListener);
    }
    source.onerror = () => {
      // EventSource reconnects on its own (resuming via Last-Event-ID) unless closed.
      if (finished) return;
      if (source.readyState === EventSource.CLOSED || !gotAny) {
        source.close();
        setError({
          message:
            "Can't reach the debate server. Start the backend API, then reload this page.",
        });
        setStatus("error");
      }
    };

    return () => {
      clearTimeout(reset);
      finished = true;
      source.close();
    };
  }, [isDemoMode, id, runSeed, handleEvent]);

  const expectedRounds = isDemoMode
    ? Math.max(sourceDebate.rounds.length, debate?.rounds.length ?? 0)
    : Math.max(
        debate ? debate.config.rounds + 1 : 0,
        debate?.rounds.length ?? 0
      );

  return {
    debate,
    status,
    currentRound,
    currentKind,
    thinkingAgentId,
    events,
    isDemoMode,
    error,
    expectedRounds,
    skipToEnd,
    replay,
  };
}
