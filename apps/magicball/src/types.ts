/** Flat row as stored in SQLite; `tags` is JSON string. */
export type MagicBallEventRow = {
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
  tags: string;
  original_published_at: string;
  queue_position: number;
  is_available: number;
  made_available_at: string | null;
};

/** Public API / Data Scout response shape: `tags` is parsed array. */
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

export type PublishControls = {
  id: number;
  publish_enabled: number;
  interval_min_seconds: number;
  interval_max_seconds: number;
  category_filter: string | null;
  min_severity_filter: string | null;
  manual_mode: number;
};

export type PublishLogRow = {
  id: number;
  event_id: string;
  published_at: string;
  interval_seconds_used: number;
};

export type ApiAccessLogRow = {
  id: number;
  requested_at: string;
  since_cursor: string | null;
  events_returned: number;
};

/** Shape of records in `world_events_test_dataset.json` (nested). */
export type DatasetEvent = {
  id: string;
  category: string;
  headline: string;
  summary: string;
  severity: string;
  geographic_scope: string;
  location: {
    country: string;
    region: string | null;
  };
  source_reliability: string;
  status: string;
  affected_population_estimate: number | null;
  economic_impact_usd: number | null;
  casualties: {
    confirmed: number | null;
    estimated: number | null;
  };
  tags: string[];
  published_at: string;
};

export type MergedLogEntry = {
  timestamp: string;
  service: "magicball";
  level: "info" | "warn" | "error" | "debug";
  event_id: string | null;
  source: "publish_log" | "api_access_log";
  message: string;
};
