"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  FileUp,
  MessageSquare,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { SAMPLE_QUESTIONS, matchMockDebateId } from "@/lib/mock-debates";

const DEFAULT_SETTINGS: DebateSettings = {
  numAgents: 2,
  rounds: 3,
  model: "llama-3.3-70b-versatile",
  aggregation: "evidence_weighted",
  personalities: ["Extraversion (Assertive)", "Conscientiousness (Scholar)"],
};

export default function HomePage() {
  const router = useRouter();
  const [question, setQuestion] = useState(SAMPLE_QUESTIONS[0].question);
  const [settings, setSettings] = useState<DebateSettings>(DEFAULT_SETTINGS);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <section className="space-y-3 text-center">
        <Badge variant="secondary" className="gap-1.5 px-3 py-1">
          <Sparkles className="size-3.5 text-primary" />
          Personality-Shaped Adversarial Reasoning
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Debate with Real Evidence, Not Gut Feelings
        </h1>
        <p className="mx-auto max-w-2xl text-sm sm:text-base text-muted-foreground">
          Big Five personality-shaped agents argue Pro and Con across rounds, a
          skeptical Critic audits every claim and citation, and a weighted
          aggregator delivers a calibrated verdict.
        </p>
      </section>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Start a Debate</CardTitle>
              <CardDescription>
                Enter any policy, scientific, or factual question below.
              </CardDescription>
            </div>
            <SettingsDrawer settings={settings} onChange={setSettings} />
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleStart} className="space-y-4">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., Should our college switch to a 4-day week?"
              rows={3}
              className="resize-none text-base"
              aria-label="Debate question"
            />

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Try a recorded sample:
              </span>
              {SAMPLE_QUESTIONS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => setQuestion(sample.question)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors cursor-pointer ${
                    question.trim() === sample.question
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {sample.tag}: &ldquo;{sample.question}&rdquo;
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span tabIndex={0} className="inline-flex">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled
                        className="gap-1.5"
                      >
                        <FileUp className="size-4" />
                        Attach PDF Evidence
                      </Button>
                    </span>
                  }
                />
                <TooltipContent>Coming in Phase 2</TooltipContent>
              </Tooltip>

              <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-xs text-muted-foreground">
                  {settings.numAgents} agents · {settings.rounds} rounds ·{" "}
                  <span className="font-mono">{settings.aggregation}</span>
                </span>
                <Button type="submit" size="lg" className="gap-2">
                  Start Debate
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MessageSquare className="size-4 text-emerald-600 dark:text-emerald-400" />
              Adversarial Lanes
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs leading-relaxed text-muted-foreground">
            Pro and Con advocates shaped by Big Five traits clash over opening
            statements and targeted rebuttals.
          </CardContent>
        </Card>

        <Card className="bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="size-4 text-amber-600 dark:text-amber-400" />
              Socratic Critic &amp; Citations
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs leading-relaxed text-muted-foreground">
            Every claim links to clickable evidence cards [E#], while a Critic
            flags unsupported leaps and cherry-picking.
          </CardContent>
        </Card>

        <Card className="bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Scale className="size-4 text-primary" />
              Calibrated Verdict
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs leading-relaxed text-muted-foreground">
            Collective voting combines argument strength with confidence
            calibration, winning points, and open disagreements.
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
