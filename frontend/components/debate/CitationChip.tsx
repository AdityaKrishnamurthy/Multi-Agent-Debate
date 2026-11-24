"use client";

import React from "react";
import { FileText } from "lucide-react";

interface CitationChipProps {
  evidenceId: string;
  onSelect: (id: string) => void;
  active?: boolean;
}

export function CitationChip({
  evidenceId,
  onSelect,
  active = false,
}: CitationChipProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(evidenceId)}
      className={`mx-0.5 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-xs font-medium transition-colors cursor-pointer ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
      }`}
      title={`Inspect source ${evidenceId}`}
    >
      <FileText className="size-3" />
      {evidenceId}
    </button>
  );
}

/**
 * Splits text containing inline citation markers like [E1] or [E1, E2]
 * into text segments and interactive CitationChip components.
 */
export function renderTextWithCitations(
  text: string,
  onSelectEvidence: (id: string) => void,
  activeEvidenceId?: string | null
): React.ReactNode[] {
  const parts = text.split(/(\[E\d+(?:,\s*E\d+)*\])/g);

  return parts.map((part, idx) => {
    const match = part.match(/^\[(E\d+(?:,\s*E\d+)*)\]$/);
    if (!match) {
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    }

    const ids = match[1].split(",").map((s) => s.trim());
    return (
      <span key={idx} className="inline-flex flex-wrap items-center">
        {ids.map((id) => (
          <CitationChip
            key={`${idx}-${id}`}
            evidenceId={id}
            onSelect={onSelectEvidence}
            active={activeEvidenceId === id}
          />
        ))}
      </span>
    );
  });
}
