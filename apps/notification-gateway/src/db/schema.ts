export const createUsersTable = `
CREATE TABLE IF NOT EXISTS users (
    user_id            TEXT PRIMARY KEY,
    name               TEXT NOT NULL,
    email              TEXT,
    slack_channel      TEXT,
    severity_threshold TEXT NOT NULL,
    channels           TEXT NOT NULL,
    role               TEXT NOT NULL DEFAULT 'user',
    password_hash      TEXT NOT NULL,
    event_categories   TEXT NOT NULL DEFAULT '["breaking_news","market_movement","natural_disaster"]',
    created_at         TEXT NOT NULL,
    is_active          INTEGER NOT NULL DEFAULT 1
);
`;

export const createNotificationLogTable = `
CREATE TABLE IF NOT EXISTS notification_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id     TEXT NOT NULL,
    user_id      TEXT NOT NULL REFERENCES users(user_id),
    channel      TEXT NOT NULL,
    status       TEXT NOT NULL,
    attempted_at TEXT NOT NULL,
    payload      TEXT NOT NULL,
    error        TEXT
);
`;

/** One row per Redis stream message id — idempotent processing. */
export const createProcessedSignalsTable = `
CREATE TABLE IF NOT EXISTS processed_signals (
    stream_message_id TEXT PRIMARY KEY,
    event_id          TEXT NOT NULL,
    processed_at      TEXT NOT NULL
);
`;

export const createGatewayLogTable = `
CREATE TABLE IF NOT EXISTS gateway_operational_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    logged_at  TEXT NOT NULL,
    level      TEXT NOT NULL,
    event_id   TEXT,
    source     TEXT NOT NULL,
    message    TEXT NOT NULL
);
`;

export const createAppMetaTable = `
CREATE TABLE IF NOT EXISTS app_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
`;
