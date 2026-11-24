"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle,
  CheckCircle2,
  MessageSquareWarning,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  CitationChip,
  renderTextWithCitations,
} from "@/components/debate/CitationChip";
import type { Argument, RoundKind } from "@/lib/types";

interface ArgumentCardProps {
  argument: Argument;
  roundNumber: number;
  roundKind: RoundKind;
  onSelectEvidence: (id: string) => void;
  activeEvidenceId?: string | null;
  animateTyping?: boolean;
}

export function ArgumentCard({
  argument,
  roundNumber,
  roundKind,
  onSelectEvidence,
  activeEvidenceId,
  animateTyping = true,
}: ArgumentCardProps) {
  const [typedChars, setTypedChars] = useState(0);

  useEffect(() => {
    if (!animateTyping) return;
    const total = argument.text.length;
    const chunk = Math.max(8, Math.ceil(total / 26));
    const timer = setInterval(() => {
      setTypedChars((prev) => {
        if (prev + chunk >= total) {
          clearInterval(timer);
          return total;
        }
        return prev + chunk;
      });
    }, 24);
    return () => clearInterval(timer);
  }, [argument.id, argument.text, animateTyping]);

  const visibleChars = animateTyping ? typedChars : argument.text.length;
  const isTyping = visibleChars < argument.text.length;
  const shownText = isTyping
    ? argument.text.slice(0, visibleChars)
    : argument.text;

  const isPro = argument.stance === "pro";
  const isCon = argument.stance === "con";

  const critiqueScore = argument.critique?.score;
  const critiqueLow = critiqueScore !== undefined && critiqueScore < 2.5;
  const critiqueMid =
    critiqueScore !== undefined && critiqueScore >= 2.5 && critiqueScore < 3.5;

  const strengthColor =
    argument.strength == null
      ? "border-border"
      : argument.strength >= 0.75
        ? "border-l-4 border-l-emerald-500"
        : argument.strength >= 0.55
          ? "border-l-4 border-l-amber-500"
          : "border-l-4 border-l-rose-500";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card className={`overflow-hidden ${strengthColor}`}>
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs capitalize">
                Round {roundNumber} · {roundKind}
              </Badge>
              <Badge
                variant="secondary"
                className={
                  isPro
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : isCon
                      ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                      : ""
                }
              >
                {isPro ? "PRO" : isCon ? "CON" : "NEUTRAL"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
              <span>Confidence {Math.round(argument.confidence * 100)}%</span>
              {argument.strength !== null && (
                <span>· Strength {Math.round(argument.strength * 100)}%</span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 px-4 pb-4 text-sm">
          <p className="leading-relaxed text-foreground">
            {isTyping
              ? shownText
              : renderTextWithCitations(
                  shownText,
                  onSelectEvidence,
                  activeEvidenceId
                )}
            {isTyping && (
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" />
            )}
          </p>

          {argument.claims.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-2.5">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Key Claims
              </p>
              <ul className="space-y-1 text-xs text-foreground/90">
                {argument.claims.map((claim, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary/60" />
                    <span>
                      {renderTextWithCitations(
                        claim,
                        onSelectEvidence,
                        activeEvidenceId
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {argument.evidence_ids.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              <span className="text-xs text-muted-foreground mr-1">
                Citations:
              </span>
              {argument.evidence_ids.map((eid) => (
                <CitationChip
                  key={eid}
                  evidenceId={eid}
                  onSelect={onSelectEvidence}
                  active={activeEvidenceId === eid}
                />
              ))}
            </div>
          )}

          {argument.critique && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`rounded-lg border p-3 text-xs ${
                critiqueLow
                  ? "border-rose-500/40 bg-rose-500/10"
                  : critiqueMid
                    ? "border-amber-500/40 bg-amber-500/10"
                    : "border-emerald-500/30 bg-emerald-500/5"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-semibold">
                  {critiqueLow ? (
                    <ShieldAlert className="size-3.5 text-rose-600 dark:text-rose-400" />
                  ) : critiqueMid ? (
                    <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <span>Critic Review (Neuroticism)</span>
                </div>
                <Badge
                  variant="outline"
                  className="font-mono text-xs tabular-nums"
                >
                  Score {argument.critique.score.toFixed(1)} / 5.0
                </Badge>
              </div>

              {argument.critique.issues.length > 0 ? (
                <ul className="mt-2 space-y-1.5">
                  {argument.critique.issues.map((issue, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <MessageSquareWarning className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>
                        <span className="font-mono font-semibold uppercase">
                          [{issue.type}]
                        </span>{" "}
                        {issue.note}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-muted-foreground">
                  No logical or citation issues flagged.
                </p>
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
