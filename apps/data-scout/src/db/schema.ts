export const createIngestedEventsTable = `
CREATE TABLE IF NOT EXISTS ingested_events (
    event_id                     TEXT PRIMARY KEY,
    source_event_id              TEXT NOT NULL UNIQUE,
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
    ingested_at                  TEXT NOT NULL,
    emitted_at                   TEXT
);
`;

export const createPollStateTable = `
CREATE TABLE IF NOT EXISTS poll_state (
    id                       INTEGER PRIMARY KEY DEFAULT 1,
    last_successful_poll_at  TEXT,
    last_poll_attempted_at   TEXT
);
`;

export const createPollLogTable = `
CREATE TABLE IF NOT EXISTS poll_log (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    polled_at         TEXT    NOT NULL,
    since_cursor      TEXT,
    status            TEXT    NOT NULL,
    events_fetched    INTEGER NOT NULL DEFAULT 0,
    events_new        INTEGER NOT NULL DEFAULT 0,
    events_duplicate  INTEGER NOT NULL DEFAULT 0,
    events_emitted    INTEGER NOT NULL DEFAULT 0,
    error_message     TEXT
);
`;

/** Per-event operational lines for admin log trace-by-event_id (alongside poll_log). */
export const createEventOpsLogTable = `
CREATE TABLE IF NOT EXISTS event_ops_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    logged_at  TEXT NOT NULL,
    level      TEXT NOT NULL,
    event_id   TEXT,
    source     TEXT NOT NULL,
    message    TEXT NOT NULL
);
`;

/** Ensures the single cursor row exists (id=1). */
export const seedPollState = `
INSERT OR IGNORE INTO poll_state (id) VALUES (1);
`;
