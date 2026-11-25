"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FileUp, Info, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  SettingsDrawer,
  type DebateSettings,
} from "@/components/debate/SettingsDrawer";
import { SideTag } from "@/components/debate/SideTag";
import { VoteSplitBar } from "@/components/debate/VoteSplitBar";
import {
  ApiError,
  createDebate,
  getOptions,
  type DebateModelOption,
} from "@/lib/api";
import { scrollToHomeSection } from "@/lib/scroll";
import {
  MOCK_DEBATES,
  SAMPLE_QUESTIONS,
  matchMockDebateId,
} from "@/lib/mock-debates";
import {
  aggregationLabel,
  debaters,
  pct,
  splitDecision,
  verdictSide,
} from "@/lib/debate-display";

const DEFAULT_SETTINGS: DebateSettings = {
  numAgents: 2,
  rounds: 3,
  model: "",
  aggregation: "majority",
  personalities: ["Extraversion (Assertive)", "Conscientiousness (Scholar)"],
};

const STEPS = [
  {
    title: "Opening",
    body: "Each side states its position and its key claims, citing sources by number.",
  },
  {
    title: "Rebuttals",
    body: "Each side answers the other's weakest point. The Critic scores every argument from 0 to 5 and flags unsupported claims.",
  },
  {
    title: "Verdict",
    body: "Votes are weighted by argument strength into one decision, with a calibrated confidence score.",
  },
];

const DEBATE_TOPIC_SUGGESTIONS = [
  "Should AI-generated art be eligible for copyright protection?",
  "Should social media platforms verify users' ages?",
  "Should cities make public transit free for everyone?",
  "Should schools ban smartphones during the school day?",
  "Is nuclear energy essential for reaching net-zero emissions?",
  "Should a 4-day workweek become the standard?",
  "Should public college tuition be free?",
  "Should animal testing for cosmetics be banned worldwide?",
  "Should remote work be the default for office jobs?",
  "Should the voting age be lowered to 16?",
];

export default function HomePage() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [topicSuggestionIndex, setTopicSuggestionIndex] = useState(-1);
  const [settings, setSettings] = useState<DebateSettings>(DEFAULT_SETTINGS);
  const [models, setModels] = useState<DebateModelOption[]>([]);

  // Verified debate models (and the default) come from the backend.
  useEffect(() => {
    let cancelled = false;
    getOptions().then((opts) => {
      if (cancelled || !opts) return;
      setModels(opts.debate_models);
      setSettings((s) => ({
        ...s,
        model: s.model || opts.default_debate_model,
      }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Arriving from another page via /#samples: jump once the list has rendered.
  useEffect(() => {
    if (window.location.hash === "#samples") {
      requestAnimationFrame(() => scrollToHomeSection("samples"));
    }
  }, []);

  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const suggestNextTopic = () => {
    const nextIndex = (topicSuggestionIndex + 1) % DEBATE_TOPIC_SUGGESTIONS.length;
    setQuestion(DEBATE_TOPIC_SUGGESTIONS[nextIndex]);
    setTopicSuggestionIndex(nextIndex);
    setStartError(null);
  };

  // Start a live debate through the API (plan 007).
  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (trimmed.length < 5) {
      setStartError("Type a question of at least a few words first.");
      return;
    }
    setStarting(true);
    setStartError(null);
    try {
      const id = await createDebate({
        question: trimmed,
        num_agents: settings.numAgents,
        rebuttals: Math.max(0, settings.rounds - 1),
        all_roles: settings.numAgents >= 3,
        model: settings.model || undefined,
      });
      router.push(`/debate/${id}`);
    } catch (err) {
      setStartError(
        err instanceof ApiError ? err.message : "Couldn't start the debate."
      );
      setStarting(false);
    }
  };

  // Offline fallback: replay the closest recorded sample for the typed question.
  const replayClosestSample = () => {
    const trimmed = question.trim() || SAMPLE_QUESTIONS[0].question;
    const sampleId = matchMockDebateId(trimmed);
    const params = new URLSearchParams({
      demo: "1",
      q: trimmed,
      agents: String(settings.numAgents),
      rounds: String(settings.rounds),
      model: settings.model,
      agg: settings.aggregation,
      personalities: settings.personalities.join("|"),
    });
    router.push(`/debate/${sampleId}?${params.toString()}`);
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-10 sm:px-8 sm:pt-16">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
        <section aria-labelledby="start-heading">
          <h1
            id="start-heading"
            className="text-[2rem] font-bold leading-tight tracking-tight sm:text-[2.75rem]"
          >
            What should the agents debate?
          </h1>
          <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-muted-foreground">
            Two AI advocates argue it over several rounds, a Critic checks every
            claim and citation, and the group reaches one verdict with a
            confidence score you can trace back to the arguments.
          </p>

          <form
            onSubmit={handleStart}
            className="mt-8 rounded-xl border border-input bg-card shadow-[0_1px_2px_rgba(22,24,29,0.04),0_8px_24px_-12px_rgba(22,24,29,0.12)] focus-within:border-pro"
          >
            <label htmlFor="question" className="sr-only">
              Debate question
            </label>
            <Textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Should our college switch to a 4-day week?"
              rows={3}
              className="min-h-28 resize-none border-0 bg-transparent px-5 pt-5 text-xl leading-snug shadow-none focus-visible:ring-0 dark:bg-transparent md:text-xl"
            />
            <div className="flex flex-wrap items-center gap-3 border-t border-rule px-4 py-3">
              <SettingsDrawer
                settings={settings}
                onChange={setSettings}
                models={models}
              />
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span tabIndex={0} className="inline-flex rounded-lg">
                      <Button type="button" variant="ghost" size="sm" disabled>
                        <FileUp />
                        Attach PDF
                      </Button>
                    </span>
                  }
                />
                <TooltipContent>PDF evidence arrives in Phase 2</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Suggest a debate topic (${((topicSuggestionIndex + 1) % DEBATE_TOPIC_SUGGESTIONS.length) + 1} of ${DEBATE_TOPIC_SUGGESTIONS.length})`}
                      onClick={suggestNextTopic}
                    >
                      <Lightbulb />
                    </Button>
                  }
                />
                <TooltipContent>
                  Cycle through 10 debate topic ideas
                </TooltipContent>
              </Tooltip>
              <span className="tabular hidden min-w-0 truncate text-sm text-muted-foreground xl:inline">
                {settings.numAgents} agents · {settings.rounds} rounds ·{" "}
                {aggregationLabel(settings.aggregation)}
              </span>
              <Button
                type="submit"
                size="lg"
                className="ml-auto"
                disabled={starting}
              >
                {starting ? "Starting…" : "Start debate"}
                <ArrowRight />
              </Button>
            </div>
          </form>

          {startError ? (
            <div
              role="alert"
              className="mt-4 rounded-lg bg-flag-soft px-4 py-3 text-[15px] leading-relaxed"
            >
              <p>{startError}</p>
              <button
                type="button"
                onClick={replayClosestSample}
                className="mt-1 font-semibold underline decoration-input underline-offset-4 hover:decoration-foreground"
              >
                Replay the closest sample debate instead
              </button>
            </div>
          ) : (
            <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" />
              Debates run live on free-tier models (Groq by default; choose
              another in Settings) and take a few minutes. To see one instantly,
              replay a sample below.
            </p>
          )}
        </section>

        <aside aria-labelledby="how-heading" className="lg:pt-3">
          <h2 id="how-heading" className="text-lg font-semibold">
            How a debate runs
          </h2>
          <ol className="mt-5 space-y-6">
            {STEPS.map((step, idx) => (
              <li key={step.title} className="grid grid-cols-[2rem_1fr] gap-3">
                <span className="tabular flex size-8 items-center justify-center rounded-full border border-input text-sm font-semibold">
                  {idx + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      <section
        id="samples"
        aria-labelledby="samples-heading"
        className="mt-20 scroll-mt-24"
      >
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2
            id="samples-heading"
            className="text-2xl font-bold tracking-tight"
          >
            Sample debates
          </h2>
          <p className="text-[15px] text-muted-foreground">
            Replay a full debate, round by round, ending in its verdict.
          </p>
        </div>

        <ul className="mt-6 divide-y divide-rule border-y border-rule">
          {SAMPLE_QUESTIONS.map((sample) => {
            const d = MOCK_DEBATES[sample.id];
            const verdict = d.verdict;
            const side = verdict ? verdictSide(verdict) : "draw";
            const ruling = verdict
              ? splitDecision(verdict.decision).ruling
              : "";
            return (
              <li key={sample.id}>
                <Link
                  href={`/debate/${sample.id}?demo=1`}
                  className="group grid grid-cols-1 items-center gap-4 rounded-md px-2 py-6 transition-colors hover:bg-panel sm:px-4 md:grid-cols-[minmax(0,1fr)_260px_auto]"
                >
                  <div className="min-w-0">
                    <p className="text-lg font-semibold leading-snug group-hover:underline">
                      {d.question}
                    </p>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {sample.tag} ·{" "}
                      {sample.origin === "real"
                        ? "Real Groq run"
                        : "Sample, illustrative sources"}{" "}
                      · {debaters(d).length} debaters · {d.rounds.length} rounds
                      · {aggregationLabel(d.config.aggregation)}
                      {d.evidence.length > 0
                        ? ` · ${d.evidence.length} sources`
                        : " · no sources"}
                    </p>
                  </div>
                  {verdict && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <SideTag side={side} />
                          <span className="truncate font-medium">{ruling}</span>
                        </span>
                        <span className="tabular shrink-0 font-semibold">
                          {pct(verdict.confidence)}
                        </span>
                      </div>
                      <VoteSplitBar verdict={verdict} />
                    </div>
                  )}
                  <span className="hidden items-center gap-1.5 text-[15px] font-semibold md:inline-flex">
                    Replay
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
