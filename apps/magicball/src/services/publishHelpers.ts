import type { Database } from "better-sqlite3";
import type { MagicBallEventRow, PublishControls } from "../types.js";

const SEVERITY_RANK: Readonly<Record<string, number>> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function severityRank(s: string): number {
  return SEVERITY_RANK[s] ?? -1;
}

/**
 * `min_severity_filter` = minimum bar: only events at least as severe as the filter
 * (e.g. `high` allows high and critical).
 */
export function eventMeetsMinSeverity(
  eventSeverity: string,
  minFilter: string | null
): boolean {
  if (minFilter === null) return true;
  return severityRank(eventSeverity) >= severityRank(minFilter);
}

export function eventMeetsCategoryFilter(
  eventCategory: string,
  categoryFilterJson: string | null
): boolean {
  if (categoryFilterJson === null) return true;
  let allowed: string[];
  try {
    const parsed: unknown = JSON.parse(categoryFilterJson);
    if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === "string")) {
      return false;
    }
    allowed = parsed;
  } catch {
    return false;
  }
  return allowed.includes(eventCategory);
}

export function readPublishControls(db: Database): PublishControls {
  const row = db
    .prepare(
      `SELECT id, publish_enabled, interval_min_seconds, interval_max_seconds,
              category_filter, min_severity_filter, manual_mode
         FROM publish_controls WHERE id = 1`
    )
    .get() as PublishControls | undefined;
  if (!row) {
    throw new Error("publish_controls row id=1 missing");
  }
  return row;
}

export function nextPublishableEvent(
  db: Database,
  controls: PublishControls
): MagicBallEventRow | null {
  const candidates = db
    .prepare(
      `SELECT * FROM events WHERE is_available = 0 ORDER BY queue_position ASC`
    )
    .all() as MagicBallEventRow[];

  for (const ev of candidates) {
    if (!eventMeetsCategoryFilter(ev.category, controls.category_filter)) {
      continue;
    }
    if (!eventMeetsMinSeverity(ev.severity, controls.min_severity_filter)) {
      continue;
    }
    return ev;
  }
  return null;
}

export function randomIntervalMs(minSec: number, maxSec: number): number {
  const min = Math.max(1, minSec);
  const max = Math.max(min, maxSec);
  const span = max - min + 1;
  const seconds = min + Math.floor(Math.random() * span);
  return seconds * 1000;
}
