/** Flat SQLite row — tags stored as JSON text */
export type IngestedEventRow = {
  event_id: string;
  source_event_id: string;
  category: string;
  headline: string;
  summary: string;
  severity: string;
  geographic_scope: string;
  location_country: string;
  location_region: string | null;
  source_reliability: string;
  status: string;
  affected_population_estimate: number | null;
  economic_impact_usd: number | null;
  casualties_confirmed: number | null;
  casualties_estimated: number | null;
  tags: string; // JSON text
  original_published_at: string;
  ingested_at: string;
  emitted_at: string | null;
};

/** Public API response — tags parsed */
export type IngestedEventResponse = Omit<IngestedEventRow, "tags"> & {
  tags: string[];
};

/** Single-row cursor table */
export type PollState = {
  id: 1;
  last_successful_poll_at: string | null;
  last_poll_attempted_at: string | null;
};

export type PollLogRow = {
  id: number;
  polled_at: string;
  since_cursor: string | null;
  status: "success" | "empty" | "error";
  events_fetched: number;
  events_new: number;
  events_duplicate: number;
  events_emitted: number;
  error_message: string | null;
};

/**
 * Shape MagicBall returns from GET /events.
 * Flat fields (location_country, location_region) — magicball serialize.ts
 * expands the nested dataset shape to flat before responding.
 * tags is string[] (parsed by magicball before sending).
 */
export type MagicBallEventResponse = {
  id: string;
  category: string;
  headline: string;
  summary: string;
  severity: string;
  geographic_scope: string;
  location_country: string;
  location_region: string | null;
  source_reliability: string;
  status: string;
  affected_population_estimate: number | null;
  economic_impact_usd: number | null;
  casualties_confirmed: number | null;
  casualties_estimated: number | null;
  tags: string[];
  original_published_at: string;
  queue_position: number;
  is_available: number;
  made_available_at: string | null;
};

export type DataScoutLogEntry = {
  timestamp: string;
  service: "data-scout";
  level: "info" | "warn" | "error" | "debug";
  event_id: string | null;
  source: "poll_log" | "event_ops";
  message: string;
};
