"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import type { AdminHealthResponse } from "@/lib/types";

function statusVariant(
  s: "up" | "down" | "degraded"
): "default" | "destructive" | "warning" | "success" {
  if (s === "up") return "success";
  if (s === "degraded") return "warning";
  return "destructive";
}

export function SystemHealth() {
  const [data, setData] = useState<AdminHealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admin/health", { cache: "no-store" });
        if (!res.ok) {
          setError(`Failed (${res.status})`);
          return;
        }
        const j = (await res.json()) as AdminHealthResponse;
        if (!cancelled) {
          setData(j);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Network error");
      }
    }
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (error && !data) {
    return <p className="text-destructive">{error}</p>;
  }

  if (!data) {
    return <p className="text-muted-foreground">Loading health…</p>;
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="text-destructive text-sm">Last refresh error: {error}</p>
      ) : null}
      <p className="text-muted-foreground text-sm">
        Checked at {new Date(data.checked_at).toLocaleString()} — refreshes every
        30s
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {data.services.map((s) => (
          <Card key={s.name}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                {s.name}
                <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    Response detail
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <pre className="mt-2 max-h-64 overflow-auto rounded border bg-muted/50 p-2 text-xs">
                    {JSON.stringify(s.detail, null, 2)}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
