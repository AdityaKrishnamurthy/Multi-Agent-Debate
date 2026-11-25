"use client";

import { useEffect } from "react";
import { ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { credibilityDot, pct } from "@/lib/debate-display";
import type { Evidence } from "@/lib/types";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function CredibilityDot({ value }: { value: number }) {
  const size = credibilityDot(value);
  return (
    <span
      className="flex size-3 shrink-0 items-center justify-center"
      aria-hidden="true"
    >
      <span
        className="rounded-full bg-foreground"
        style={{ width: size, height: size }}
      />
    </span>
  );
}

/* Compact list for the right rail. */
export function EvidenceList({
  evidence,
  selectedId,
  onSelect,
}: {
  evidence: Evidence[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section
      aria-labelledby="sources-heading"
      className="rounded-xl border border-rule p-5"
    >
      <div className="flex items-baseline justify-between">
        <h2 id="sources-heading" className="text-[15px] font-semibold">
          Sources
        </h2>
        <span className="tabular text-[15px] text-muted-foreground">
          {evidence.length}
        </span>
      </div>
      {evidence.length === 0 ? (
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          No sources were cited. This run used the models&rsquo; own knowledge;
          evidence retrieval arrives in Phase 2.
        </p>
      ) : (
        <>
          <ul className="-mx-2 mt-3">
            {evidence.map((e) => {
              const on = selectedId === e.id;
              return (
                <li key={e.id} id={`rail-evidence-${e.id}`}>
                  <button
                    type="button"
                    onClick={() => onSelect(e.id)}
                    aria-expanded={on}
                    className={`grid w-full grid-cols-[2.25rem_1fr_0.75rem] items-center gap-2 rounded-md px-2 py-2 text-left text-[15px] transition-colors ${
                      on ? "bg-muted" : "hover:bg-panel"
                    }`}
                  >
                    <span className="tabular font-semibold">{e.id}</span>
                    <span className={on ? "font-semibold" : "truncate"}>
                      {e.source}
                    </span>
                    <CredibilityDot value={e.credibility} />
                  </button>
                  {on && (
                    <div className="px-2 pb-3 pt-2">
                      <blockquote className="font-serif text-[15px] leading-relaxed">
                        &ldquo;{e.quote}&rdquo;
                      </blockquote>
                      <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                        <a
                          href={e.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-w-0 items-center gap-1.5 font-medium underline decoration-input underline-offset-4 hover:decoration-foreground"
                        >
                          <span className="truncate">{hostOf(e.url)}</span>
                          <ExternalLink className="size-3.5 shrink-0" />
                        </a>
                        <span className="tabular shrink-0 text-muted-foreground">
                          Credibility{" "}
                          <span className="font-semibold text-foreground">
                            {pct(e.credibility)}
                          </span>
                        </span>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            Dot size shows source credibility.
          </p>
        </>
      )}
    </section>
  );
}

interface EvidencePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evidence: Evidence[];
  selectedId: string | null;
  onSelectId: (id: string) => void;
}

export function EvidencePanel({
  open,
  onOpenChange,
  evidence,
  selectedId,
  onSelectId,
}: EvidencePanelProps) {
  useEffect(() => {
    if (open && selectedId) {
      const timer = setTimeout(() => {
        document
          .getElementById(`evidence-card-${selectedId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [open, selectedId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b border-rule px-6 py-5">
          <SheetTitle className="text-lg font-bold">
            Sources ({evidence.length})
          </SheetTitle>
          <SheetDescription className="text-[15px]">
            Every source cited in this debate. Open a link to read the original.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {evidence.length === 0 ? (
            <p className="py-8 text-center text-[15px] text-muted-foreground">
              No sources were cited in this debate.
            </p>
          ) : (
            <ul className="space-y-3 pb-6">
              {evidence.map((item) => {
                const on = selectedId === item.id;
                return (
                  <li
                    key={item.id}
                    id={`evidence-card-${item.id}`}
                    onClick={() => onSelectId(item.id)}
                    className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                      on
                        ? "border-foreground bg-panel"
                        : "border-rule hover:border-input"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`tabular inline-flex h-6 items-center rounded px-2 text-xs font-bold ${
                          on ? "bg-foreground text-background" : "bg-muted"
                        }`}
                      >
                        {item.id}
                      </span>
                      <h3 className="text-[15px] font-semibold leading-snug">
                        {item.source}
                      </h3>
                    </div>
                    <blockquote className="mt-3 font-serif text-[16px] leading-relaxed">
                      &ldquo;{item.quote}&rdquo;
                    </blockquote>
                    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex min-w-0 items-center gap-1.5 font-medium underline decoration-input underline-offset-4 hover:decoration-foreground"
                      >
                        <span className="truncate">{hostOf(item.url)}</span>
                        <ExternalLink className="size-3.5 shrink-0" />
                      </a>
                      <span className="tabular flex shrink-0 items-center gap-2 text-muted-foreground">
                        <CredibilityDot value={item.credibility} />
                        Credibility {pct(item.credibility)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
