import debate4DayWeekRaw from "@/mock/debate-4day-week.json";
import debateFastingRaw from "@/mock/debate-fasting.json";
import debateNuclearRaw from "@/mock/debate-nuclear.json";
import type { Debate } from "@/lib/types";

export const debate4DayWeek: Debate = debate4DayWeekRaw as Debate;
export const debateFasting: Debate = debateFastingRaw as Debate;
export const debateNuclear: Debate = debateNuclearRaw as Debate;

export const MOCK_DEBATES: Record<string, Debate> = {
  "4day-week": debate4DayWeek,
  fasting: debateFasting,
  nuclear: debateNuclear,
};

export const SAMPLE_QUESTIONS: SampleQuestion[] = [
  {
    id: "4day-week",
    question: "Should our college switch to a 4-day week?",
    tag: "Campus policy",
    origin: "sample",
  },
  {
    id: "fasting",
    question: "Does intermittent fasting improve long-term weight loss?",
    tag: "Health and science",
    origin: "sample",
  },
  {
    id: "nuclear",
    question:
      "Is nuclear energy essential for achieving net-zero carbon emissions by 2050?",
    tag: "Energy policy",
    origin: "real",
  },
];

export interface SampleQuestion {
  id: string;
  question: string;
  tag: string;
  origin: DebateOrigin;
}

/** "sample" = hand-written demo with illustrative sources; "real" = saved CLI run. */
export type DebateOrigin = "sample" | "real";

export const ORIGIN_LABEL: Record<DebateOrigin, string> = {
  sample: "Sample debate · illustrative sources",
  real: "Real Groq run",
};

export function debateOrigin(id: string): DebateOrigin {
  return SAMPLE_QUESTIONS.find((s) => s.id === id)?.origin ?? "sample";
}

/**
 * Match any typed user question to the closest mock debate by simple keyword match,
 * falling back to sample 1 (`4day-week`) as specified in Plan 004.
 */
export function matchMockDebateId(question: string): string {
  const q = question.toLowerCase();
  const nuclearKeywords = [
    "nuclear",
    "energy",
    "carbon",
    "emissions",
    "net-zero",
    "climate",
  ];
  if (nuclearKeywords.some((kw) => q.includes(kw))) {
    return "nuclear";
  }
  const fastingKeywords = [
    "fasting",
    "intermittent",
    "weight",
    "diet",
    "calorie",
    "obesity",
    "meal",
    "eating",
    "fat",
  ];
  if (fastingKeywords.some((kw) => q.includes(kw))) {
    return "fasting";
  }
  return "4day-week";
}

export function getMockDebate(id: string): Debate {
  return MOCK_DEBATES[id] ?? debate4DayWeek;
}
