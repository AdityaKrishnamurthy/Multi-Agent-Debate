import type { Side } from "@/lib/debate-display";
import type { Stance } from "@/lib/types";

const STYLES: Record<Side | "neutral", string> = {
  pro: "bg-pro-soft text-pro-ink",
  con: "bg-con-soft text-con-ink",
  draw: "bg-muted text-foreground",
  neutral: "bg-muted text-muted-foreground",
};

const LABELS: Record<Side | "neutral", string> = {
  pro: "PRO",
  con: "CON",
  draw: "DRAW",
  neutral: "NEUTRAL",
};

/** Stance tag: always text plus colour, never colour alone. */
export function SideTag({
  side,
  className = "",
}: {
  side: Side | Stance;
  className?: string;
}) {
  const key = side as Side | "neutral";
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center rounded px-2 text-xs font-bold tracking-wide ${STYLES[key]} ${className}`}
    >
      {LABELS[key]}
    </span>
  );
}
