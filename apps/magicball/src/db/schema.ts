export const createEventsTable = `
CREATE TABLE IF NOT EXISTS events (
    id                           TEXT PRIMARY KEY,
    category                     TEXT NOT NULL,
    headline                     TEXT NOT NULL,
    summary                      TEXT NOT NULL,
    severity                     TEXT NOT NULL,
    geographic_scope             TEXT NOT NULL,
    location_country             TEXT NOT NULL,
    location_region              TEXT,
    source_reliability           TEXT NOT NULL,
    status                       TEXT NOT NULL,
    affected_population_estimate INTEGER,
    economic_impact_usd          INTEGER,
    casualties_confirmed         INTEGER,
    casualties_estimated         INTEGER,
    tags                         TEXT NOT NULL,
    original_published_at        TEXT NOT NULL,
    queue_position               INTEGER NOT NULL,
    is_available                 INTEGER NOT NULL DEFAULT 0,
    made_available_at            TEXT
);
`;

export const createPublishLog = `
CREATE TABLE IF NOT EXISTS publish_log (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id              TEXT NOT NULL REFERENCES events(id),
    published_at          TEXT NOT NULL,
    interval_seconds_used INTEGER NOT NULL
);
`;

export const createApiAccessLog = `
CREATE TABLE IF NOT EXISTS api_access_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    requested_at    TEXT NOT NULL,
    since_cursor    TEXT,
    events_returned INTEGER NOT NULL
);
`;

export const createPublishControls = `
CREATE TABLE IF NOT EXISTS publish_controls (
    id                   INTEGER PRIMARY KEY DEFAULT 1,
    publish_enabled      INTEGER NOT NULL DEFAULT 1,
    interval_min_seconds INTEGER NOT NULL DEFAULT 300,
    interval_max_seconds INTEGER NOT NULL DEFAULT 900,
    category_filter      TEXT    DEFAULT NULL,
    min_severity_filter  TEXT    DEFAULT NULL,
    manual_mode          INTEGER NOT NULL DEFAULT 0
);
`;

/** Ensures the single config row exists (id=1). */
export const seedPublishControls = `
INSERT OR IGNORE INTO publish_controls (id) VALUES (1);
`;
