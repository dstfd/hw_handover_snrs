"use client";

import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserPublic } from "@/lib/types";

const CATEGORIES: { id: string; label: string }[] = [
  { id: "breaking_news", label: "Breaking News" },
  { id: "market_movement", label: "Market Movements" },
  { id: "natural_disaster", label: "Natural Disasters" },
];

const SEVERITIES = ["low", "medium", "high", "critical"] as const;

export function AlertPreferencesForm({ user }: { user: UserPublic }) {
  const [categories, setCategories] = useState<Set<string>>(
    () => new Set(user.event_categories)
  );
  const [severity, setSeverity] = useState(user.severity_threshold);
  const [channels, setChannels] = useState<Set<string>>(
    () => new Set(user.channels)
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function toggleCategory(id: string) {
    setCategories((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleChannel(id: string) {
    setChannels((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/users/me/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_categories: Array.from(categories),
          severity_threshold: severity,
          channels: Array.from(channels),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      setMessage("Preferences saved.");
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-8">
      <div>
        <h2 className="mb-4 text-lg font-medium">Event categories</h2>
        <div className="space-y-3">
          {CATEGORIES.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <Checkbox
                id={`cat-${c.id}`}
                checked={categories.has(c.id)}
                onCheckedChange={() => toggleCategory(c.id)}
              />
              <Label htmlFor={`cat-${c.id}`}>{c.label}</Label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Minimum severity</Label>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="max-w-xs">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            {SEVERITIES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          Low = all events; Critical = only the most severe.
        </p>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-medium">Notification channels</h2>
        <div className="space-y-3">
          {(["email", "slack"] as const).map((ch) => (
            <div key={ch} className="flex items-center gap-2">
              <Checkbox
                id={`ch-${ch}`}
                checked={channels.has(ch)}
                onCheckedChange={() => toggleChannel(ch)}
              />
              <Label htmlFor={`ch-${ch}`}>
                {ch === "email" ? "Email" : "Slack"}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert>
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save preferences"}
      </Button>
    </form>
  );
}
