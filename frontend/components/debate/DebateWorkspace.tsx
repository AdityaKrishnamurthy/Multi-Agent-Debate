"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  FastForward,
  Loader2,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArgumentBlock } from "@/components/debate/ArgumentBlock";
import { EvidenceList, EvidencePanel } from "@/components/debate/EvidencePanel";
import { RoundTimeline } from "@/components/debate/RoundTimeline";
import { SideTag } from "@/components/debate/SideTag";
import { VerdictBox, VerdictDetails } from "@/components/debate/VerdictView";
import { useDebateStream, type StreamError } from "@/hooks/useDebateStream";
import { ORIGIN_LABEL, debateOrigin, isMockId } from "@/lib/mock-debates";
import {
  ROLE_LABEL,
  aggregationLabel,
  debaters as getDebaters,
  initials,
  roundLabel,
} from "@/lib/debate-display";
import type { Agent, Argument, Round } from "@/lib/types";

function AgentHead({ agent }: { agent: Agent }) {
  const tone =
    agent.stance === "pro"
      ? "bg-pro"
      : agent.stance === "con"
        ? "bg-con"
        : "bg-foreground";
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className={`flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white dark:text-background ${tone}`}
      >
        {initials(agent.name)}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{agent.name}</span>
          <SideTag side={agent.stance} />
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {ROLE_LABEL[agent.role]}
          {agent.personality
            ? ` · ${agent.personality.trait}, ${agent.personality.level}`
            : ""}
          <span className="hidden xl:inline"> · {agent.model}</span>
        </p>
      </div>
    </div>
  );
}

function StreamErrorNotice({ error }: { error: StreamError }) {
  return (
    <div
      role="alert"
      className="rounded-xl bg-flag-soft px-5 py-4 text-[15px] leading-relaxed"
    >
      <p className="flex items-center gap-2 font-semibold">
        <TriangleAlert className="size-4 text-flag" />
        The debate stopped
      </p>
      <p className="mt-1">
        {error.message}
        {error.retryAfter
          ? ` Try again in about ${Math.ceil(error.retryAfter)} seconds.`
          : ""}
      </p>
      <p className="mt-2">
        <Link
          href="/"
          className="font-semibold underline decoration-input underline-offset-4 hover:decoration-foreground"
        >
          Start a new debate
        </Link>{" "}
        or{" "}
        <Link
          href="/#samples"
          className="font-semibold underline decoration-input underline-offset-4 hover:decoration-foreground"
        >
          replay a sample
        </Link>
        .
      </p>
    </div>
  );
}

function Drafting({ name }: { name: string }) {
  return (
    <p className="flex items-center gap-2 py-2 text-[15px] text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {name} is drafting an argument…
    </p>
  );
}

export function DebateWorkspace({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const customQuestion = searchParams.get("q") ?? undefined;
  const paramAgg = searchParams.get("agg");
  // Recorded samples replay from JSON; any other id is a live debate from the API.
  const demo = isMockId(id) || searchParams.get("demo") === "1";

  const {
    debate,
    status,
    currentRound,
    thinkingAgentId,
    isDemoMode,
    expectedRounds,
    error,
    skipToEnd,
    replay,
  } = useDebateStream(id, { customQuestion, demo });

  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(
    null
  );
  const [roundInView, setRoundInView] = useState<number | null>(null);

  // Desktop: expand the source inline in the rail. Narrow screens: open the sheet.
  const handleSelectEvidence = (eid: string) => {
    setSelectedEvidenceId(eid);
    if (window.matchMedia("(min-width: 1024px)").matches) {
      requestAnimationFrame(() =>
        document
          .getElementById(`rail-evidence-${eid}`)
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      );
    } else {
      setEvidenceOpen(true);
    }
  };

  const agentsById = useMemo(
    () => new Map((debate?.agents ?? []).map((a) => [a.id, a])),
    [debate?.agents]
  );
  const sides = useMemo(() => {
    const list = debate ? getDebaters(debate) : [];
    return {
      pro: list.filter((a) => a.stance === "pro"),
      con: list.filter((a) => a.stance === "con"),
      neutral: list.filter((a) => a.stance === "neutral"),
    };
  }, [debate]);
  const critic = debate?.agents.find((a) => a.role === "critic");
  const aggregation = paramAgg ?? debate?.config.aggregation ?? "majority";

  // Guide line: name the round currently at the top of the viewport.
  const roundCount = (debate?.rounds.length ?? 0) + (debate?.verdict ? 1 : 0);
  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>("[data-round]")
    );
    if (els.length === 0) return;
    const visible = new Map<number, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const n = Number((e.target as HTMLElement).dataset.round);
          if (e.isIntersecting) visible.set(n, e.boundingClientRect.top);
          else visible.delete(n);
        }
        const first = [...visible.entries()].sort((a, b) => a[1] - b[1])[0];
        setRoundInView(first ? first[0] : null);
      },
      { rootMargin: "-140px 0px -45% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [roundCount]);

  const jumpTo = (target: number | "verdict") => {
    const el =
      target === "verdict"
        ? document.getElementById("why-verdict")
        : document.querySelector(`[data-round="${target}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!debate) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8">
        {error ? (
          <StreamErrorNotice error={error} />
        ) : (
          <p className="flex items-center gap-2 text-[15px] text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {isDemoMode
              ? "Loading debate…"
              : "Starting the debate. The moderator is assigning sides…"}
          </p>
        )}
      </div>
    );
  }

  const thinkingAgent = thinkingAgentId
    ? agentsById.get(thinkingAgentId)
    : undefined;
  const lastRound = debate.rounds[debate.rounds.length - 1];
  const hasPro = sides.pro.length > 0;
  const hasCon = sides.con.length > 0;
  const inVerdict = roundInView === 0;
  const guideRound =
    debate.rounds.find((r) => r.number === roundInView) ??
    debate.rounds[0] ??
    null;

  const renderSide = (
    round: Round,
    list: Argument[],
    side: "pro" | "con" | "neutral"
  ) => {
    const drafting =
      thinkingAgent &&
      thinkingAgent.stance === side &&
      round === lastRound &&
      thinkingAgent.role !== "critic" &&
      !round.arguments.some((a) => a.agent_id === thinkingAgent.id);
    return (
      <div className="min-w-0 space-y-8">
        {list.map((arg) => (
          <ArgumentBlock
            key={arg.id}
            argument={arg}
            agent={agentsById.get(arg.agent_id)}
            criticName={critic?.name}
            onSelectEvidence={handleSelectEvidence}
            activeEvidenceId={selectedEvidenceId}
            animateTyping={status === "streaming"}
          />
        ))}
        {drafting && <Drafting name={thinkingAgent.name} />}
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-24 pt-6 sm:px-8">
      <Button
        variant="ghost"
        size="xs"
        nativeButton={false}
        render={<Link href="/" />}
        className="-ml-2.5 text-muted-foreground"
      >
        <ArrowLeft />
        New debate
      </Button>

      <div className="mt-3 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight sm:text-[2rem]">
            {debate.question}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
            <p className="text-[15px] text-muted-foreground">
              {isDemoMode ? ORIGIN_LABEL[debateOrigin(id)] : "Live debate"} ·{" "}
              {getDebaters(debate).length} debaters
              {critic ? " · Critic on" : " · no Critic"} ·{" "}
              {aggregationLabel(aggregation)}
            </p>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEvidenceOpen(true)}
                className="lg:hidden"
              >
                <BookOpen />
                Sources ({debate.evidence.length})
              </Button>
              {status === "streaming" && !isDemoMode ? (
                <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-input px-3 text-sm font-semibold">
                  <span
                    aria-hidden="true"
                    className="size-2 animate-pulse rounded-full bg-con"
                  />
                  Live
                </span>
              ) : status === "streaming" ? (
                <Button variant="outline" size="sm" onClick={skipToEnd}>
                  <FastForward />
                  Skip to verdict
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={replay}>
                  <RotateCcw />
                  Replay
                </Button>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-5">
              <StreamErrorNotice error={error} />
            </div>
          )}

          <div className="mt-6">
            <RoundTimeline
              totalRounds={expectedRounds}
              kinds={debate.rounds.map((r) => r.kind)}
              currentRound={currentRound}
              hasVerdict={debate.verdict !== null}
              onJump={jumpTo}
            />
          </div>

          <div className="mt-6 lg:hidden">
            <VerdictBox
              verdict={debate.verdict}
              aggregationMethod={aggregation}
              currentRound={currentRound}
              totalRounds={expectedRounds}
              onSelectEvidence={handleSelectEvidence}
              activeEvidenceId={selectedEvidenceId}
            />
          </div>

          {/* Sticky heads: who is on which side, and which round is in view. */}
          <div className="sticky top-[60px] z-20 -mx-4 mt-6 border-b border-rule bg-background/95 px-4 pb-3 pt-4 backdrop-blur-sm sm:-mx-2 sm:px-2">
            <div className="hidden grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] gap-x-8 md:grid">
              <div className="space-y-2">
                {sides.pro.map((a) => (
                  <AgentHead key={a.id} agent={a} />
                ))}
              </div>
              <span className="bg-rule" />
              <div className="space-y-2">
                {sides.con.map((a) => (
                  <AgentHead key={a.id} agent={a} />
                ))}
              </div>
            </div>
            <p
              className="text-sm font-semibold text-muted-foreground md:mt-3"
              aria-live="off"
            >
              {inVerdict
                ? "Verdict"
                : guideRound
                  ? `Round ${guideRound.number} of ${expectedRounds} · ${roundLabel(guideRound.kind, guideRound.number)}`
                  : "Waiting for the opening round"}
            </p>
          </div>

          <div className="mt-2">
            {debate.rounds.map((round) => {
              const pro = round.arguments.filter((a) => a.stance === "pro");
              const con = round.arguments.filter((a) => a.stance === "con");
              const neutral = round.arguments.filter(
                (a) => a.stance === "neutral"
              );
              return (
                <section
                  key={round.number}
                  data-round={round.number}
                  aria-label={`Round ${round.number}, ${roundLabel(round.kind, round.number)}`}
                  className="scroll-mt-40 border-b border-rule py-8"
                >
                  <h2 className="mb-5 text-sm font-bold text-muted-foreground">
                    Round {round.number} ·{" "}
                    {roundLabel(round.kind, round.number)}
                  </h2>
                  <div
                    className={
                      hasPro && hasCon
                        ? "grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] md:gap-x-8"
                        : "grid grid-cols-1 gap-10"
                    }
                  >
                    {hasPro && renderSide(round, pro, "pro")}
                    {hasPro && hasCon && (
                      <span
                        aria-hidden="true"
                        className="hidden bg-rule md:block"
                      />
                    )}
                    {hasCon && renderSide(round, con, "con")}
                  </div>
                  {neutral.length > 0 && (
                    <div className="mt-8 border-t border-dashed border-rule pt-6">
                      {renderSide(round, neutral, "neutral")}
                    </div>
                  )}
                </section>
              );
            })}

            {debate.rounds.length === 0 && (
              <p className="py-10 text-[15px] text-muted-foreground">
                The moderator is setting up the debate…
              </p>
            )}
          </div>

          {debate.verdict && (
            <div className="mt-12" data-round="0">
              <VerdictDetails
                verdict={debate.verdict}
                agents={debate.agents}
                aggregationMethod={aggregation}
                onSelectEvidence={handleSelectEvidence}
                activeEvidenceId={selectedEvidenceId}
              />
            </div>
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-[84px] max-h-[calc(100vh-100px)] space-y-5 overflow-y-auto pb-4">
            <VerdictBox
              verdict={debate.verdict}
              aggregationMethod={aggregation}
              currentRound={currentRound}
              totalRounds={expectedRounds}
              onSelectEvidence={handleSelectEvidence}
              activeEvidenceId={selectedEvidenceId}
            />
            <EvidenceList
              evidence={debate.evidence}
              selectedId={selectedEvidenceId}
              onSelect={handleSelectEvidence}
            />
          </div>
        </aside>
      </div>

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
