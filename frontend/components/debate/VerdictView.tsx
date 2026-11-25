"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowDown, CircleHelp } from "lucide-react";
import { renderTextWithCitations } from "@/components/debate/CitationChip";
import { SideTag } from "@/components/debate/SideTag";
import { VoteSplitBar } from "@/components/debate/VoteSplitBar";
import {
  ROLE_LABEL,
  aggregationLabel,
  pct,
  splitDecision,
  verdictSide,
} from "@/lib/debate-display";
import type { Agent, Verdict } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Rail summary: pending while the debate runs, then the ruled verdict. */
/* ------------------------------------------------------------------ */

interface VerdictBoxProps {
  verdict: Verdict | null;
  aggregationMethod: string;
  currentRound: number;
  totalRounds: number;
  onSelectEvidence: (id: string) => void;
  activeEvidenceId?: string | null;
}

export function VerdictBox({
  verdict,
  aggregationMethod,
  currentRound,
  totalRounds,
  onSelectEvidence,
  activeEvidenceId,
}: VerdictBoxProps) {
  const reduceMotion = useReducedMotion();

  if (!verdict) {
    const progress =
      totalRounds > 0 ? Math.min(currentRound, totalRounds) / totalRounds : 0;
    return (
      <section
        aria-label="Verdict"
        aria-live="polite"
        className="rounded-xl border-2 border-dashed border-input p-5"
      >
        <h2 className="text-[15px] font-semibold">Verdict pending</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {currentRound > 0
            ? `Round ${Math.min(currentRound, totalRounds)} of ${totalRounds} in progress.`
            : "Waiting for the opening round."}{" "}
          The judges rule once every round is in.
        </p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-foreground transition-[width] duration-500 ease-out"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </section>
    );
  }

  const side = verdictSide(verdict);
  const { ruling, detail } = splitDecision(verdict.decision);

  return (
    <motion.section
      aria-label="Verdict"
      aria-live="polite"
      initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border-2 border-foreground bg-card p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">Verdict</h2>
        <SideTag side={side} />
      </div>
      <p className="mt-2 text-[22px] font-bold leading-snug tracking-tight">
        {ruling}
      </p>
      {detail && (
        <p className="mt-1 line-clamp-2 text-[15px] leading-relaxed text-muted-foreground">
          {detail}
        </p>
      )}

      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">Confidence</span>
          <span className="tabular text-2xl font-bold">
            {pct(verdict.confidence)}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-foreground"
            style={{ width: pct(verdict.confidence) }}
          />
        </div>
      </div>

      <div className="mt-5">
        <span className="text-sm font-medium">Weighted vote</span>
        <div className="mt-2">
          <VoteSplitBar verdict={verdict} showLegend />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {aggregationLabel(aggregationMethod)}
        </p>
      </div>

      {verdict.winning_points.length > 0 && (
        <div className="mt-5 border-t border-rule pt-4 [@media(max-height:800px)]:hidden">
          <h3 className="text-sm font-medium">Why it won</h3>
          <ol className="mt-2 space-y-2">
            {verdict.winning_points.slice(0, 2).map((pt, idx) => (
              <li
                key={idx}
                className="grid grid-cols-[1.1rem_1fr] text-[15px] leading-snug"
              >
                <span className="tabular font-semibold text-pass">
                  {idx + 1}
                </span>
                <span>
                  {renderTextWithCitations(
                    pt,
                    onSelectEvidence,
                    activeEvidenceId
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <a
        href="#why-verdict"
        className="mt-5 inline-flex items-center gap-1.5 text-[15px] font-semibold underline decoration-input underline-offset-4 hover:decoration-foreground"
      >
        Full reasoning
        <ArrowDown className="size-4" />
      </a>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Full explanation at the end of the debate.                          */
/* ------------------------------------------------------------------ */

interface VerdictDetailsProps {
  verdict: Verdict;
  agents: Agent[];
  aggregationMethod: string;
  onSelectEvidence: (id: string) => void;
  activeEvidenceId?: string | null;
}

export function VerdictDetails({
  verdict,
  agents,
  aggregationMethod,
  onSelectEvidence,
  activeEvidenceId,
}: VerdictDetailsProps) {
  const side = verdictSide(verdict);
  const { ruling, detail } = splitDecision(verdict.decision);
  const maxWeight = Math.max(1, ...verdict.votes.map((v) => v.weight));

  return (
    <section
      id="why-verdict"
      aria-labelledby="why-verdict-heading"
      className="scroll-mt-36 border-t-2 border-foreground pt-8"
    >
      <h2
        id="why-verdict-heading"
        className="text-2xl font-bold tracking-tight"
      >
        Why this verdict
      </h2>

      <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <p className="flex items-center gap-3 text-xl font-bold leading-snug">
          <SideTag side={side} />
          {ruling}
        </p>
        <p className="tabular text-xl font-bold">
          {pct(verdict.confidence)}{" "}
          <span className="text-[15px] font-medium text-muted-foreground">
            confidence
          </span>
        </p>
      </div>
      {detail && (
        <p className="mt-2 max-w-[70ch] text-[17px] leading-relaxed">
          {detail}
        </p>
      )}

      <p className="mt-5 max-w-[70ch] font-serif text-[17px] leading-[1.65] text-foreground">
        {renderTextWithCitations(
          verdict.reasoning,
          onSelectEvidence,
          activeEvidenceId
        )}
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <h3 className="font-semibold">What decided it</h3>
          <ul className="mt-3 space-y-3">
            {verdict.winning_points.map((pt, idx) => (
              <li
                key={idx}
                className="grid grid-cols-[1.25rem_1fr] text-[15px] leading-relaxed"
              >
                <span className="tabular font-semibold text-pass">
                  {idx + 1}
                </span>
                <span>
                  {renderTextWithCitations(
                    pt,
                    onSelectEvidence,
                    activeEvidenceId
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-semibold">Still disputed</h3>
          <ul className="mt-3 space-y-3">
            {verdict.open_disagreements.map((pt, idx) => (
              <li
                key={idx}
                className="grid grid-cols-[1.25rem_1fr] text-[15px] leading-relaxed"
              >
                <CircleHelp
                  aria-hidden="true"
                  className="mt-[0.2em] size-4 text-flag"
                />
                <span>
                  {renderTextWithCitations(
                    pt,
                    onSelectEvidence,
                    activeEvidenceId
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">Votes</h3>
          <span className="text-sm text-muted-foreground">
            {aggregationLabel(aggregationMethod)}
          </span>
        </div>
        <div className="mt-3 max-w-md">
          <VoteSplitBar verdict={verdict} showLegend />
        </div>
        <table className="mt-5 w-full text-left text-[15px]">
          <thead>
            <tr className="border-b border-rule text-sm text-muted-foreground">
              <th scope="col" className="py-2 pr-4 font-medium">
                Voter
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Vote
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Weight
              </th>
            </tr>
          </thead>
          <tbody>
            {verdict.votes.map((v, idx) => {
              const agent = agents.find((a) => a.id === v.agent_id);
              const vs = verdictSide({
                ...verdict,
                decision: v.choice,
                votes: [],
              });
              return (
                <tr key={idx} className="border-b border-rule align-top">
                  <td className="py-3 pr-4">
                    <span className="font-semibold">
                      {agent?.name ?? v.agent_id}
                    </span>
                    {agent && (
                      <span className="block text-sm text-muted-foreground">
                        {ROLE_LABEL[agent.role]}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="flex items-start gap-2">
                      {vs !== "draw" && <SideTag side={vs} />}
                      <span className="min-w-0">{v.choice}</span>
                    </span>
                  </td>
                  <td className="tabular w-40 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block">
                        <span
                          className={`block h-full ${
                            vs === "pro"
                              ? "bg-pro"
                              : vs === "con"
                                ? "bg-con"
                                : "bg-foreground"
                          }`}
                          style={{ width: `${(v.weight / maxWeight) * 100}%` }}
                        />
                      </span>
                      <span className="font-semibold">
                        {v.weight.toFixed(2)}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
