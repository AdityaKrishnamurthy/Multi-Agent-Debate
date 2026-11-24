"use client";

import { motion } from "motion/react";
import { Award, CheckCircle2, HelpCircle } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { renderTextWithCitations } from "@/components/debate/CitationChip";
import type { Agent, Verdict } from "@/lib/types";

interface VerdictViewProps {
  verdict: Verdict;
  agents: Agent[];
  aggregationMethod: string;
  onSelectEvidence: (id: string) => void;
  activeEvidenceId?: string | null;
}

export function VerdictView({
  verdict,
  agents,
  aggregationMethod,
  onSelectEvidence,
  activeEvidenceId,
}: VerdictViewProps) {
  const confidencePct = Math.round(verdict.confidence * 100);
  const gaugeData = [
    {
      name: "Confidence",
      value: confidencePct,
      fill:
        confidencePct >= 75
          ? "#10b981"
          : confidencePct >= 55
            ? "#f59e0b"
            : "#ef4444",
    },
  ];

  const voteData = verdict.votes.map((v) => {
    const agent = agents.find((a) => a.id === v.agent_id);
    const isPro = v.choice.toLowerCase().includes("pro");
    const isCon = v.choice.toLowerCase().includes("con");
    return {
      name: agent ? agent.name : v.agent_id,
      choice: v.choice,
      weight: Number(v.weight.toFixed(2)),
      fill: isPro ? "#10b981" : isCon ? "#f43f5e" : "#6366f1",
    };
  });

  return (
    <motion.section
      aria-label="Collective Verdict"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-4"
    >
      <Card className="border-primary/30 bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Award className="size-4" />
              </span>
              <div>
                <CardTitle className="text-base sm:text-lg">
                  Collective Verdict
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Aggregation:{" "}
                  <span className="font-mono">{aggregationMethod}</span>
                </p>
              </div>
            </div>
            <Badge className="text-xs font-semibold">
              Calibrated Confidence: {confidencePct}%
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="rounded-xl border bg-muted/40 p-4">
            <p className="text-sm sm:text-base font-semibold text-foreground">
              {verdict.decision}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {renderTextWithCitations(
                verdict.reasoning,
                onSelectEvidence,
                activeEvidenceId
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Confidence Gauge
              </h3>
              <div className="relative h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%"
                    cy="55%"
                    innerRadius="68%"
                    outerRadius="95%"
                    barSize={16}
                    data={gaugeData}
                    startAngle={210}
                    endAngle={-30}
                  >
                    <PolarAngleAxis
                      type="number"
                      domain={[0, 100]}
                      angleAxisId={0}
                      tick={false}
                    />
                    <RadialBar
                      background={{ fill: "var(--muted)" }}
                      dataKey="value"
                      cornerRadius={10}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-4">
                  <span className="text-3xl font-bold tabular-nums">
                    {confidencePct}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Group Confidence
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Weighted Vote Breakdown
              </h3>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={voteData}
                    layout="vertical"
                    margin={{ top: 8, right: 20, left: 10, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      tick={{ fontSize: 11 }}
                    />
                    <RechartsTooltip
                      formatter={(value, _name, item) => [
                        `Weight ${value} (${item?.payload?.choice ?? ""})`,
                        "Vote",
                      ]}
                    />
                    <Bar dataKey="weight" radius={[0, 6, 6, 0]}>
                      {voteData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                Winning Points
              </h3>
              <ul className="space-y-2 text-xs sm:text-sm">
                {verdict.winning_points.map((pt, idx) => (
                  <li
                    key={idx}
                    className="rounded-lg border bg-emerald-500/5 p-2.5 leading-relaxed"
                  >
                    {renderTextWithCitations(
                      pt,
                      onSelectEvidence,
                      activeEvidenceId
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <HelpCircle className="size-4 text-amber-600 dark:text-amber-400" />
                Key Disputed Points
              </h3>
              <ul className="space-y-2 text-xs sm:text-sm">
                {verdict.open_disagreements.map((pt, idx) => (
                  <li
                    key={idx}
                    className="rounded-lg border bg-amber-500/5 p-2.5 leading-relaxed"
                  >
                    {renderTextWithCitations(
                      pt,
                      onSelectEvidence,
                      activeEvidenceId
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.section>
  );
}
