"use client";

import { Check } from "lucide-react";
import { roundLabel } from "@/lib/debate-display";
import type { RoundKind } from "@/lib/types";

interface RoundTimelineProps {
  totalRounds: number;
  kinds: RoundKind[];
  currentRound: number;
  hasVerdict: boolean;
  onJump?: (round: number | "verdict") => void;
}

/** One segmented row; each step restyles in place as the debate advances. */
export function RoundTimeline({
  totalRounds,
  kinds,
  currentRound,
  hasVerdict,
  onJump,
}: RoundTimelineProps) {
  const steps: { key: number | "verdict"; label: string }[] = [
    ...Array.from({ length: Math.max(1, totalRounds) }, (_, i) => ({
      key: i + 1,
      label: roundLabel(kinds[i] ?? (i === 0 ? "opening" : "rebuttal"), i + 1),
    })),
    { key: "verdict" as const, label: "Verdict" },
  ];

  return (
    <ol
      aria-label="Debate progress"
      className="grid overflow-hidden rounded-lg border border-input"
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((step) => {
        const isVerdict = step.key === "verdict";
        const n = isVerdict ? Infinity : (step.key as number);
        const done = hasVerdict || (!isVerdict && currentRound > n);
        const active = isVerdict
          ? hasVerdict
          : !hasVerdict && currentRound === n;
        const reachable = done || active;
        const state = active ? "active" : done ? "done" : "todo";

        return (
          <li
            key={String(step.key)}
            className="border-r border-input last:border-r-0"
          >
            <button
              type="button"
              disabled={!reachable || !onJump}
              onClick={() => onJump?.(step.key)}
              aria-current={active ? "step" : undefined}
              className={`flex h-11 w-full items-center justify-center gap-2 px-2 text-sm font-semibold transition-colors duration-200 disabled:cursor-default sm:justify-start sm:px-4 ${
                state === "active"
                  ? "bg-foreground text-background"
                  : state === "done"
                    ? "text-foreground hover:bg-panel"
                    : "text-muted-foreground"
              }`}
            >
              {state === "done" && <Check className="hidden size-4 sm:block" />}
              {state === "active" && !isVerdict && (
                <span
                  aria-hidden="true"
                  className="hidden size-2 animate-pulse rounded-full bg-background sm:block"
                />
              )}
              <span className="truncate">{step.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
