"use client";

import { Bot, Loader2, ShieldCheck, ShieldX, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ArgumentCard } from "@/components/debate/ArgumentCard";
import type { Agent, Argument, RoundKind } from "@/lib/types";

interface LaneEntry {
  roundNumber: number;
  roundKind: RoundKind;
  argument: Argument;
}

interface AgentLaneProps {
  agent: Agent;
  entries: LaneEntry[];
  isThinking: boolean;
  onSelectEvidence: (id: string) => void;
  activeEvidenceId?: string | null;
  animateTyping?: boolean;
}

export function AgentLane({
  agent,
  entries,
  isThinking,
  onSelectEvidence,
  activeEvidenceId,
  animateTyping = true,
}: AgentLaneProps) {
  const isPro = agent.stance === "pro";
  const isCon = agent.stance === "con";

  const headerAccent = isPro
    ? "border-emerald-500/30 bg-emerald-500/5"
    : isCon
      ? "border-rose-500/30 bg-rose-500/5"
      : "border-border bg-muted/40";

  const avatarColor = isPro
    ? "bg-emerald-600 text-white"
    : isCon
      ? "bg-rose-600 text-white"
      : "bg-primary text-primary-foreground";

  const initials = agent.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <section
      aria-label={`${agent.name} (${agent.stance}) lane`}
      className="flex flex-col gap-3 rounded-xl border bg-card/50 p-3 sm:p-4"
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 ${headerAccent}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor}`}
          >
            {initials || <Bot className="size-4" />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="truncate text-sm font-semibold text-foreground">
                {agent.name}
              </h2>
              <Badge variant="outline" className="text-[11px] capitalize">
                {agent.role}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {agent.personality && (
                <Badge variant="secondary" className="text-[11px]">
                  <Sparkles className="mr-1 size-3" />
                  {agent.personality.trait} · {agent.personality.level}
                </Badge>
              )}
              <span className="truncate font-mono text-[11px] text-muted-foreground">
                {agent.model}
              </span>
            </div>
          </div>
        </div>

        <Badge
          className={
            isPro
              ? "bg-emerald-600 text-white hover:bg-emerald-600"
              : isCon
                ? "bg-rose-600 text-white hover:bg-rose-600"
                : "bg-secondary text-secondary-foreground"
          }
        >
          {isPro ? (
            <>
              <ShieldCheck className="mr-1 size-3.5" />
              Pro Stance
            </>
          ) : isCon ? (
            <>
              <ShieldX className="mr-1 size-3.5" />
              Con Stance
            </>
          ) : (
            "Neutral"
          )}
        </Badge>
      </div>

      <div className="flex flex-col gap-3">
        {entries.length === 0 && !isThinking && (
          <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
            Waiting for opening statement...
          </div>
        )}

        {entries.map((entry) => (
          <ArgumentCard
            key={entry.argument.id}
            argument={entry.argument}
            roundNumber={entry.roundNumber}
            roundKind={entry.roundKind}
            onSelectEvidence={onSelectEvidence}
            activeEvidenceId={activeEvidenceId}
            animateTyping={animateTyping}
          />
        ))}

        {isThinking && (
          <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin text-primary" />
            <span>{agent.name} is drafting an argument...</span>
          </div>
        )}
      </div>
    </section>
  );
}
