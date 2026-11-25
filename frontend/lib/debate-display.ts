import type { Agent, Debate, Stance, Verdict } from "@/lib/types";

export type Side = "pro" | "con" | "draw";

export const STANCE_LABEL: Record<Stance, string> = {
  pro: "Pro",
  con: "Con",
  neutral: "Neutral",
};

export const ROLE_LABEL: Record<Agent["role"], string> = {
  moderator: "Moderator",
  advocate: "Advocate",
  critic: "Critic",
  scholar: "Scholar",
  explorer: "Explorer",
  judge: "Judge",
};

export const AGGREGATION_LABEL: Record<string, string> = {
  evidence_weighted: "Evidence-weighted vote",
  majority: "Majority vote",
  confidence_weighted: "Confidence-weighted vote",
  judge_panel: "Judge panel",
  bayesian: "Bayesian per sub-claim",
};

export function aggregationLabel(method: string): string {
  return AGGREGATION_LABEL[method] ?? method.replace(/_/g, " ");
}

function choiceSide(choice: string): Side | null {
  const c = choice.trim().toLowerCase();
  if (c.startsWith("draw") || c.startsWith("tie")) return "draw";
  if (c.startsWith("pro")) return "pro";
  if (c.startsWith("con")) return "con";
  return null;
}

/** Summed vote weight per side (votes whose choice is not Pro/Con are ignored). */
export function voteSplit(verdict: Verdict): { pro: number; con: number } {
  let pro = 0;
  let con = 0;
  for (const v of verdict.votes) {
    const side = choiceSide(v.choice);
    if (side === "pro") pro += v.weight;
    if (side === "con") con += v.weight;
  }
  return { pro, con };
}

/** Which side the verdict favours: from the decision text first, then the votes. */
export function verdictSide(verdict: Verdict): Side {
  const fromDecision = choiceSide(verdict.decision);
  if (fromDecision) return fromDecision;
  const { pro, con } = voteSplit(verdict);
  if (pro === con) return "draw";
  return pro > con ? "pro" : "con";
}

/** Splits "Pro (Conditional Pilot): Adopt a ..." into a short ruling and the rest. */
export function splitDecision(decision: string): {
  ruling: string;
  detail: string;
} {
  const m = decision.match(/^(.{2,40}?)(?:\s[—–-]\s|:\s)(.+)$/);
  if (m) return { ruling: m[1].trim(), detail: m[2].trim() };
  return { ruling: decision, detail: "" };
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter((p) => /[A-Za-z]/.test(p[0] ?? ""))
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AI"
  );
}

/** Agents that argue a side (everything except moderator, critic, judge). */
export function debaters(debate: Debate): Agent[] {
  return debate.agents.filter(
    (a) => a.role !== "moderator" && a.role !== "critic" && a.role !== "judge"
  );
}

export function roundLabel(kind: string, number: number): string {
  if (kind === "opening") return "Opening";
  if (kind === "closing") return "Closing";
  return `Rebuttal ${Math.max(1, number - 1)}`;
}

/** 0–1 credibility mapped onto a fixed 4-step size ramp (px diameter). */
export function credibilityDot(credibility: number): number {
  if (credibility >= 0.85) return 12;
  if (credibility >= 0.7) return 10;
  if (credibility >= 0.5) return 8;
  return 6;
}

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}
