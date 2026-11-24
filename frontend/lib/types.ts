// Shared TypeScript schema — 002 §Shared schema (Transcript JSON v1)
// Mirrors backend/app/schemas.py field-for-field.

export type AgentRole =
  "moderator" | "advocate" | "critic" | "scholar" | "explorer" | "judge";

export type Stance = "pro" | "con" | "neutral";

export type RoundKind = "opening" | "rebuttal" | "closing";

export interface Personality {
  trait: string;
  level: string;
}

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  personality: Personality | null;
  stance: Stance;
  model: string;
}

export interface CritiqueIssue {
  type: string;
  note: string;
}

export interface Critique {
  by_agent: string;
  score: number; // 0-5
  issues: CritiqueIssue[];
}

export interface Argument {
  id: string;
  agent_id: string;
  stance: Stance;
  text: string;
  claims: string[];
  rebuts: string[]; // argument ids
  evidence_ids: string[]; // e.g. "E3"
  confidence: number; // 0-1
  critique: Critique | null;
  strength: number | null; // 0-1
}

export interface Round {
  number: number;
  kind: RoundKind;
  arguments: Argument[];
}

export interface Evidence {
  id: string; // "E1", "E2", ...
  source: string;
  url: string;
  quote: string;
  credibility: number; // 0-1
}

export interface Vote {
  agent_id: string;
  choice: string;
  weight: number;
}

export interface Verdict {
  decision: string;
  confidence: number; // 0-1
  reasoning: string;
  winning_points: string[];
  open_disagreements: string[];
  votes: Vote[];
}

export interface DebateConfig {
  num_agents: number;
  rounds: number;
  models: Record<string, string>;
  aggregation: string;
}

export interface Debate {
  schema_version: "1";
  id: string;
  question: string;
  config: DebateConfig;
  agents: Agent[];
  rounds: Round[];
  evidence: Evidence[];
  verdict: Verdict | null;
  created_at: string; // ISO-8601
}

// Stream events matching 007 §Stream events
export type DebateEventType =
  | "round_started"
  | "agent_thinking"
  | "token"
  | "argument"
  | "evidence_added"
  | "critique"
  | "vote"
  | "verdict"
  | "error";

export type DebateStreamEvent =
  | { type: "round_started"; data: { round: number; kind: RoundKind } }
  | { type: "agent_thinking"; data: { agent_id: string } }
  | { type: "token"; data: { agent_id: string; delta: string } }
  | { type: "argument"; data: Argument & { round_number?: number } }
  | { type: "evidence_added"; data: Evidence }
  | { type: "critique"; data: { argument_id: string } & Critique }
  | { type: "vote"; data: Vote }
  | { type: "verdict"; data: Verdict }
  | { type: "error"; data: { message: string; retry_after?: number } };
