"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CircleCheck, PencilLine, TriangleAlert } from "lucide-react";
import { renderTextWithCitations } from "@/components/debate/CitationChip";
import { SideTag } from "@/components/debate/SideTag";
import { pct } from "@/lib/debate-display";
import type { Agent, Argument } from "@/lib/types";

interface ArgumentBlockProps {
  argument: Argument;
  agent: Agent | undefined;
  criticName?: string;
  onSelectEvidence: (id: string) => void;
  activeEvidenceId?: string | null;
  animateTyping?: boolean;
}

const CRITIC_PASS = 3.5;

export function ArgumentBlock({
  argument,
  agent,
  criticName,
  onSelectEvidence,
  activeEvidenceId,
  animateTyping = true,
}: ArgumentBlockProps) {
  const reduceMotion = useReducedMotion();
  const typing = animateTyping && !reduceMotion;
  const [typedChars, setTypedChars] = useState(0);

  useEffect(() => {
    if (!typing) return;
    const total = argument.text.length;
    const chunk = Math.max(8, Math.ceil(total / 30));
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
  }, [argument.id, argument.text, typing]);

  const visible = typing ? typedChars : argument.text.length;
  const isTyping = visible < argument.text.length;
  const claims = argument.claims.filter((c) => c.trim().length > 0);
  const critique = argument.critique;
  // The engine appends a Critic-forced rewrite as "<original id>-rev" in the same round.
  const isRevision = argument.id.endsWith("-rev");
  const flagged = critique ? critique.score < CRITIC_PASS : false;

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      aria-label={`${agent?.name ?? "Agent"}, ${argument.stance}`}
      className="min-w-0"
    >
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {isRevision && (
          <span className="inline-flex h-6 items-center gap-1.5 rounded bg-muted px-2 text-xs font-bold text-foreground">
            <PencilLine className="size-3.5" />
            Revised after Critic review
          </span>
        )}
        <span className="flex items-center gap-2 md:hidden">
          <SideTag side={argument.stance} />
          <span className="font-semibold text-foreground">{agent?.name}</span>
        </span>
        <span className="tabular">
          Confidence{" "}
          <span className="font-semibold text-foreground">
            {pct(argument.confidence)}
          </span>
        </span>
        {argument.strength !== null && (
          <span className="tabular">
            Strength{" "}
            <span className="font-semibold text-foreground">
              {pct(argument.strength)}
            </span>
          </span>
        )}
      </div>

      <p className="font-serif text-[17px] leading-[1.65] text-foreground">
        {isTyping
          ? argument.text.slice(0, visible)
          : renderTextWithCitations(
              argument.text,
              onSelectEvidence,
              activeEvidenceId
            )}
        {isTyping && (
          <span
            aria-hidden="true"
            className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[3px] animate-pulse bg-foreground"
          />
        )}
      </p>

      {!isTyping && claims.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-muted-foreground">
            Key claims
          </h4>
          <ul className="mt-1.5 space-y-1.5 text-[15px] leading-relaxed">
            {claims.map((claim, idx) => (
              <li key={idx} className="grid grid-cols-[1rem_1fr]">
                <span
                  aria-hidden="true"
                  className={`mt-[0.6em] size-1.5 rounded-full ${
                    argument.stance === "pro"
                      ? "bg-pro"
                      : argument.stance === "con"
                        ? "bg-con"
                        : "bg-muted-foreground"
                  }`}
                />
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

      {!isTyping && critique && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className={`mt-4 rounded-lg px-4 py-3 text-[14px] leading-relaxed ${
            flagged ? "bg-flag-soft" : "bg-pass-soft"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-semibold">
              {flagged ? (
                <TriangleAlert className="size-4 text-flag" />
              ) : (
                <CircleCheck className="size-4 text-pass" />
              )}
              {flagged
                ? "Critic flagged this argument"
                : "Critic review passed"}
            </span>
            <span className="tabular text-[15px] font-semibold">
              {critique.score.toFixed(1)} / 5
              {criticName ? (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {criticName}
                </span>
              ) : null}
            </span>
          </div>
          {critique.issues.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {critique.issues.map((issue, idx) => (
                <li key={idx}>
                  <span className="font-semibold capitalize">
                    {issue.type.replace(/[_:]/g, " ")}:
                  </span>{" "}
                  {issue.note}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-muted-foreground">No issues flagged.</p>
          )}
        </motion.div>
      )}
    </motion.article>
  );
}
