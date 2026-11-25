"use client";

import React from "react";

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
      aria-label={`Open source ${evidenceId}`}
      className={`tabular mx-0.5 inline-flex h-[1.4em] translate-y-[-1px] cursor-pointer items-center rounded border px-1.5 align-middle font-sans text-[12px] font-semibold leading-none transition-colors ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-input bg-panel text-foreground hover:border-foreground"
      }`}
    >
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
      <React.Fragment key={idx}>
        {ids.map((id) => (
          <CitationChip
            key={`${idx}-${id}`}
            evidenceId={id}
            onSelect={onSelectEvidence}
            active={activeEvidenceId === id}
          />
        ))}
      </React.Fragment>
    );
  });
}
