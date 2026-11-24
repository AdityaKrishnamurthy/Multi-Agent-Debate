"use client";

import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import type { Round, RoundKind } from "@/lib/types";

interface RoundTimelineProps {
  totalRounds: number;
  rounds: Round[];
  currentRound: number;
  currentKind: RoundKind | "verdict" | null;
  hasVerdict: boolean;
}

export function RoundTimeline({
  totalRounds,
  rounds,
  currentRound,
  currentKind,
  hasVerdict,
}: RoundTimelineProps) {
  const steps = [
    { key: "r1", number: 1, label: "Opening" },
    ...Array.from({ length: Math.max(1, totalRounds - 1) }, (_, i) => ({
      key: `r${i + 2}`,
      number: i + 2,
      label: `Rebuttal ${i + 1}`,
    })),
    { key: "verdict", number: totalRounds + 1, label: "Verdict" },
  ];

  return (
    <div
      aria-label="Debate timeline"
      className="flex items-center justify-between gap-2 overflow-x-auto rounded-xl border bg-card px-4 py-3"
    >
      {steps.map((step, idx) => {
        const isVerdictStep = step.key === "verdict";
        const isCompleted = isVerdictStep
          ? hasVerdict
          : hasVerdict ||
            currentRound > step.number ||
            (rounds.some((r) => r.number === step.number) &&
              currentRound === step.number &&
              currentKind === "verdict");
        const isActive = isVerdictStep
          ? !hasVerdict && currentKind === "verdict"
          : !hasVerdict && currentRound === step.number;

        return (
          <div
            key={step.key}
            className="flex flex-1 items-center gap-2 min-w-0"
          >
            <div className="flex items-center gap-2 shrink-0">
              {isCompleted ? (
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              ) : isActive ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : (
                <Circle className="size-4 text-muted-foreground/50" />
              )}
              <span
                className={`text-xs sm:text-sm font-medium whitespace-nowrap ${
                  isActive
                    ? "text-foreground"
                    : isCompleted
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`h-px flex-1 min-w-4 ${
                  isCompleted ? "bg-emerald-500/50" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
