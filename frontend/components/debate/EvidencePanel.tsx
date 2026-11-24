"use client";

import { useEffect } from "react";
import { ExternalLink, FileText, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Evidence } from "@/lib/types";

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
        const el = document.getElementById(`evidence-card-${selectedId}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
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
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            Evidence Pool ({evidence.length})
          </SheetTitle>
          <SheetDescription>
            Verified sources cited across the debate. Click any link to open the
            original source.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-5 py-4">
          <div className="space-y-3 pb-6">
            {evidence.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Evidence cards will appear here as sources are retrieved.
              </p>
            ) : (
              evidence.map((item) => {
                const isHighlighted = selectedId === item.id;
                const credPct = Math.round(item.credibility * 100);
                return (
                  <div
                    key={item.id}
                    id={`evidence-card-${item.id}`}
                    onClick={() => onSelectId(item.id)}
                    className={`rounded-xl border p-4 transition-all cursor-pointer ${
                      isHighlighted
                        ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                        : "bg-card hover:border-muted-foreground/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={isHighlighted ? "default" : "secondary"}
                          className="font-mono"
                        >
                          {item.id}
                        </Badge>
                        <h3 className="text-sm font-semibold leading-snug">
                          {item.source}
                        </h3>
                      </div>
                    </div>

                    <blockquote className="mt-2.5 border-l-2 border-primary/40 pl-3 text-xs leading-relaxed text-muted-foreground italic">
                      &ldquo;{item.quote}&rdquo;
                    </blockquote>

                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                          Source credibility
                        </span>
                        <span className="font-mono font-medium tabular-nums">
                          {credPct}%
                        </span>
                      </div>
                      <Progress value={credPct} />
                    </div>

                    <div className="mt-3 pt-2 border-t flex items-center justify-between">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline truncate max-w-full"
                      >
                        <ExternalLink className="size-3 shrink-0" />
                        <span className="truncate">{item.url}</span>
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
