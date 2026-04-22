"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { StepName } from "@/lib/types";

function stepLabel(step: StepName): string {
  switch (step) {
    case "synthesis":
      return "Event synthesis";
    case "impact_evaluation":
      return "Impact evaluation";
    case "validation":
      return "Validation";
    case "relevance_matching":
      return "Relevance matching";
    case "notification_signal":
      return "Notification signal";
    default:
      return step;
  }
}

function canDelete(doc: { status?: string } | null): boolean {
  if (!doc) return false;
  return doc.status === "completed" || doc.status === "emitted";
}

function canReplay(doc: unknown): boolean {
  return doc == null;
}

export function StepCard({
  eventId,
  step,
  doc,
}: {
  eventId: string;
  step: StepName;
  doc: Record<string, unknown> | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const status =
    doc && typeof doc["status"] === "string" ? doc["status"] : null;
  const processedAt =
    doc && typeof doc["processed_at"] === "string"
      ? doc["processed_at"]
      : null;

  async function doDelete() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch(
        `/api/pipeline/${encodeURIComponent(eventId)}/step/${encodeURIComponent(step)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? `Delete failed (${res.status})`);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  async function doReplay() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch(
        `/api/pipeline/${encodeURIComponent(eventId)}/replay/${encodeURIComponent(step)}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? `Replay failed (${res.status})`);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{stepLabel(step)}</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {status ? (
            <Badge variant={status === "failed" ? "destructive" : "secondary"}>
              {status}
            </Badge>
          ) : (
            <Badge variant="outline">missing</Badge>
          )}
          {processedAt ? (
            <span className="text-muted-foreground text-xs">
              {new Date(processedAt).toLocaleString()}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {doc ? (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="mb-2">
                Toggle JSON
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="max-h-96 overflow-auto rounded-md border bg-muted/50 p-3 text-xs">
                {JSON.stringify(doc, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <p className="text-muted-foreground text-sm">
            No step output — not run or deleted for replay.
          </p>
        )}
        {error ? (
          <p className="text-destructive mt-2 text-sm">{error}</p>
        ) : null}
      </CardContent>
      <CardFooter className="gap-2">
        {doc && canDelete(doc as { status?: string }) ? (
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            type="button"
            onClick={() => void doDelete()}
          >
            Delete step
          </Button>
        ) : null}
        {canReplay(doc) ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            type="button"
            onClick={() => void doReplay()}
          >
            Replay step
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
