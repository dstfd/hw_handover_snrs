"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StepCard } from "@/components/StepCard";
import type { PipelineDetailResponse, StepName } from "@/lib/types";

const STEPS: StepName[] = [
  "synthesis",
  "impact_evaluation",
  "validation",
  "relevance_matching",
  "notification_signal",
];

function outcomeBadge(
  outcome: PipelineDetailResponse["outcome"]
): ReactNode {
  switch (outcome) {
    case "notified":
      return <Badge variant="success">notified</Badge>;
    case "skipped":
      return <Badge variant="warning">skipped</Badge>;
    case "failed":
      return <Badge variant="destructive">failed</Badge>;
    case "incomplete":
      return <Badge variant="muted">incomplete</Badge>;
    default:
      return <Badge variant="outline">{outcome}</Badge>;
  }
}

export function PipelineDetail({
  run,
  eventId,
}: {
  run: PipelineDetailResponse;
  eventId: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/pipeline">← Back to list</Link>
        </Button>
        <span className="font-mono text-sm">{eventId}</span>
        {outcomeBadge(run.outcome)}
        <span className="text-muted-foreground text-sm">
          pipeline_version {run.pipeline_version} · matched{" "}
          {run.matched_user_count}
        </span>
      </div>

      <div className="grid gap-4">
        {STEPS.map((step) => (
          <StepCard
            key={step}
            eventId={eventId}
            step={step}
            doc={
              (run.steps[step] as Record<string, unknown> | null) ?? null
            }
          />
        ))}
      </div>
    </div>
  );
}
