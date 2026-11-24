import debate4DayWeekRaw from "@/mock/debate-4day-week.json";
import debateFastingRaw from "@/mock/debate-fasting.json";
import type { Debate } from "@/lib/types";

export const debate4DayWeek: Debate = debate4DayWeekRaw as Debate;
export const debateFasting: Debate = debateFastingRaw as Debate;

export const MOCK_DEBATES: Record<string, Debate> = {
  "4day-week": debate4DayWeek,
  fasting: debateFasting,
};

export const SAMPLE_QUESTIONS = [
  {
    id: "4day-week",
    question: "Should our college switch to a 4-day week?",
    tag: "Campus Policy",
  },
  {
    id: "fasting",
    question: "Does intermittent fasting improve long-term weight loss?",
    tag: "Health & Science",
  },
];

/**
 * Match any typed user question to the closest mock debate by simple keyword match,
 * falling back to sample 1 (`4day-week`) as specified in Plan 004.
 */
export function matchMockDebateId(question: string): string {
  const q = question.toLowerCase();
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
