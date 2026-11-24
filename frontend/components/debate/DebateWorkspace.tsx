"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  FastForward,
  FileText,
  Info,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AgentLane } from "@/components/debate/AgentLane";
import { EvidencePanel } from "@/components/debate/EvidencePanel";
import { RoundTimeline } from "@/components/debate/RoundTimeline";
import { VerdictView } from "@/components/debate/VerdictView";
import { useDebateStream } from "@/hooks/useDebateStream";

interface DebateWorkspaceProps {
  id: string;
}

export function DebateWorkspace({ id }: DebateWorkspaceProps) {
  const searchParams = useSearchParams();
  const customQuestion = searchParams.get("q") ?? undefined;
  const paramAgents = searchParams.get("agents");
  const paramRounds = searchParams.get("rounds");
  const paramAgg = searchParams.get("agg");
  const paramModel = searchParams.get("model");
  const demo = searchParams.get("demo") !== "0";

  const {
    debate,
    status,
    currentRound,
    currentKind,
    thinkingAgentId,
    isDemoMode,
    skipToEnd,
    replay,
  } = useDebateStream(id, { customQuestion, demo });

  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(
    null
  );

  const handleSelectEvidence = (eid: string) => {
    setSelectedEvidenceId(eid);
    setEvidenceOpen(true);
  };

  const debaters = useMemo(() => {
    if (!debate) return [];
    return debate.agents.filter(
      (a) =>
        a.role === "advocate" || a.role === "scholar" || a.role === "explorer"
    );
  }, [debate]);

  const criticAgent = useMemo(
    () => debate?.agents.find((a) => a.role === "critic") ?? null,
    [debate]
  );

  if (!debate) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-center text-sm text-muted-foreground">
        Loading debate...
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
      {isDemoMode && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <Info className="size-4 shrink-0" />
            <span>
              <strong>Demo mode</strong> — replaying a recorded debate with
              verified citations.
              {(paramAgents || paramRounds || paramAgg || paramModel) && (
                <span className="ml-2 text-muted-foreground">
                  (Saved config: {paramAgents ?? debate.config.num_agents}{" "}
                  agents · {paramRounds ?? debate.config.rounds} rounds ·{" "}
                  {paramAgg ?? debate.config.aggregation}
                  {paramModel ? ` · ${paramModel}` : ""})
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {status === "streaming" && (
              <Button
                variant="outline"
                size="xs"
                onClick={skipToEnd}
                className="gap-1"
              >
                <FastForward className="size-3" />
                Skip to Verdict
              </Button>
            )}
            <Button
              variant="outline"
              size="xs"
              onClick={replay}
              className="gap-1"
            >
              <RotateCcw className="size-3" />
              Replay
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="xs"
              nativeButton={false}
              render={<Link href="/" />}
              className="gap-1 px-1.5 text-muted-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Back
            </Button>
            {criticAgent && (
              <Badge variant="outline" className="text-xs gap-1">
                <ShieldAlert className="size-3 text-amber-500" />
                Critic: {criticAgent.name} (
                {criticAgent.personality?.trait ?? "Neuroticism"})
              </Badge>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {debate.question}
          </h1>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setEvidenceOpen(true)}
          className="gap-1.5 shrink-0"
        >
          <FileText className="size-4 text-primary" />
          Evidence ({debate.evidence.length})
        </Button>
      </div>

      <RoundTimeline
        totalRounds={debate.config.rounds}
        rounds={debate.rounds}
        currentRound={currentRound}
        currentKind={currentKind}
        hasVerdict={debate.verdict !== null}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {debaters.map((agent) => {
          const entries = debate.rounds.flatMap((r) =>
            r.arguments
              .filter((a) => a.agent_id === agent.id)
              .map((a) => ({
                roundNumber: r.number,
                roundKind: r.kind,
                argument: a,
              }))
          );

          return (
            <AgentLane
              key={agent.id}
              agent={agent}
              entries={entries}
              isThinking={thinkingAgentId === agent.id}
              onSelectEvidence={handleSelectEvidence}
              activeEvidenceId={selectedEvidenceId}
              animateTyping={status === "streaming"}
            />
          );
        })}
      </div>

      {debate.verdict && (
        <VerdictView
          verdict={debate.verdict}
          agents={debate.agents}
          aggregationMethod={paramAgg ?? debate.config.aggregation}
          onSelectEvidence={handleSelectEvidence}
          activeEvidenceId={selectedEvidenceId}
        />
      )}

      <EvidencePanel
        open={evidenceOpen}
        onOpenChange={setEvidenceOpen}
        evidence={debate.evidence}
        selectedId={selectedEvidenceId}
        onSelectId={setSelectedEvidenceId}
      />
    </div>
  );
}
