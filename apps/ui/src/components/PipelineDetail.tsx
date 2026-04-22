"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <CardTitle className="text-base">Source event (Data Scout)</CardTitle>
          {run.source_event_fetch_error != null && run.source_event_fetch_error !== "" ? (
            <Badge variant="destructive">fetch error</Badge>
          ) : run.source_event ? (
            <Badge variant="secondary">loaded</Badge>
          ) : (
            <Badge variant="outline">missing</Badge>
          )}
        </CardHeader>
        <CardContent>
          {run.source_event_fetch_error != null && run.source_event_fetch_error !== "" ? (
            <p className="text-destructive text-sm">{run.source_event_fetch_error}</p>
          ) : run.source_event ? (
            <Collapsible defaultOpen>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="mb-2">
                  Toggle raw JSON
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="max-h-96 overflow-auto rounded-md border bg-muted/50 p-3 text-xs">
                  {JSON.stringify(run.source_event, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <p className="text-muted-foreground text-sm">No source event payload.</p>
          )}
        </CardContent>
      </Card>

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
