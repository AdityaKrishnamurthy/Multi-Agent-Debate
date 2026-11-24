"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";

export interface DebateSettings {
  numAgents: number;
  rounds: number;
  model: string;
  aggregation: string;
  personalities: string[];
}

const PERSONALITY_OPTIONS = [
  "Extraversion (Assertive)",
  "Conscientiousness (Scholar)",
  "Openness (Explorer)",
  "Agreeableness (Synthesizer)",
  "Neuroticism (Skeptic)",
];

const MODEL_OPTIONS = [
  { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Groq)" },
  { value: "openai/gpt-oss-120b", label: "GPT-OSS 120B (Groq)" },
  { value: "qwen/qwen3-32b", label: "Qwen 3 32B (Groq)" },
  {
    value: "meta-llama/llama-4-scout-17b-16e-instruct",
    label: "Llama 4 Scout 17B (Groq)",
  },
];

const AGGREGATION_OPTIONS = [
  { value: "evidence_weighted", label: "Evidence-Weighted Vote (Ours)" },
  { value: "majority", label: "Majority Vote" },
  { value: "confidence_weighted", label: "Confidence-Weighted Vote" },
  { value: "judge_panel", label: "Multi-Model Judge Panel" },
  { value: "bayesian", label: "Bayesian per Sub-Claim" },
];

interface SettingsDrawerProps {
  settings: DebateSettings;
  onChange: (next: DebateSettings) => void;
}

export function SettingsDrawer({ settings, onChange }: SettingsDrawerProps) {
  const handleAgentsChange = (val: number | readonly number[]) => {
    const count = Array.isArray(val) ? val[0] : val;
    const nextPersonalities = Array.from({ length: count }, (_, idx) => {
      return (
        settings.personalities[idx] ??
        PERSONALITY_OPTIONS[idx % PERSONALITY_OPTIONS.length]
      );
    });
    onChange({
      ...settings,
      numAgents: count,
      personalities: nextPersonalities,
    });
  };

  const handleRoundsChange = (val: number | readonly number[]) => {
    const rounds = Array.isArray(val) ? val[0] : val;
    onChange({ ...settings, rounds });
  };

  const handlePersonalityChange = (idx: number, trait: string | null) => {
    if (!trait) return;
    const next = [...settings.personalities];
    next[idx] = trait;
    onChange({ ...settings, personalities: next });
  };

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
          />
        }
      >
        <SlidersHorizontal className="size-4" />
        Settings
      </SheetTrigger>

      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Debate Configuration</SheetTitle>
          <SheetDescription>
            Customize panel size, rounds, personalities, model, and aggregation
            method. Values persist in the URL.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Debating Agents</Label>
              <span className="font-mono text-xs text-muted-foreground">
                {settings.numAgents} agents
              </span>
            </div>
            <Slider
              min={2}
              max={5}
              step={1}
              value={[settings.numAgents]}
              onValueChange={handleAgentsChange}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Debate Rounds</Label>
              <span className="font-mono text-xs text-muted-foreground">
                {settings.rounds} rounds
              </span>
            </div>
            <Slider
              min={1}
              max={4}
              step={1}
              value={[settings.rounds]}
              onValueChange={handleRoundsChange}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>Personality per Agent</Label>
            <div className="space-y-2.5">
              {Array.from({ length: settings.numAgents }, (_, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-xs text-muted-foreground w-20 shrink-0">
                    Agent {idx + 1} ({idx % 2 === 0 ? "Pro" : "Con"})
                  </span>
                  <Select
                    value={
                      settings.personalities[idx] ??
                      PERSONALITY_OPTIONS[idx % PERSONALITY_OPTIONS.length]
                    }
                    onValueChange={(v) => handlePersonalityChange(idx, v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERSONALITY_OPTIONS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Primary Model</Label>
            <Select
              value={settings.model}
              onValueChange={(v) => v && onChange({ ...settings, model: v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Aggregation Method</Label>
            <Select
              value={settings.aggregation}
              onValueChange={(v) =>
                v && onChange({ ...settings, aggregation: v })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGGREGATION_OPTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
