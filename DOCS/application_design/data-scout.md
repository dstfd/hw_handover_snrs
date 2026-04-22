# Data Scout — Design Document

## Role in the System

Data Scout is the ingestion service. It polls MagicBall for newly available events, persists them locally, deduplicates, and emits a lightweight signal onto a Redis Stream for downstream processing. It is the origin point of the lineage chain — every event that enters the system is assigned its permanent `event_id` here.

Data Scout has no knowledge of what the Intelligence Layer does with events. It only knows about MagicBall and the Redis Stream.

---

## Responsibilities

- Poll MagicBall every 5 minutes for newly available events
- Assign a stable `event_id` (UUID v4) to each new event — the lineage key for the entire system
- Persist the raw event payload to its own SQLite database
- Deduplicate against already-ingested events before persisting or emitting
- Emit a lightweight signal to Redis Streams for each new unique event
- Log every poll attempt (success, empty, or error) to its own SQLite

---

## Polling Behaviour

- Interval: **every 5 minutes** (300 seconds), fixed
- On each tick, Data Scout reads `last_successful_poll_at` from the `poll_state` table and calls:
  ```
  GET /events?since=<last_successful_poll_at>
  ```
- If the response is successful (even if empty), `last_successful_poll_at` is updated to the current tick time
- If MagicBall is unreachable or returns an error: log the failure to `poll_log` with `status = 'error'`, leave `last_successful_poll_at` unchanged, and wait for the next tick — no retry
- On first run (no cursor yet), `since` is omitted — fetches all currently available events

---

## Deduplication

A dedicated dedup check runs inside Data Scout before any insert or emit. It is intentionally simple.

**Logic:** before processing a fetched event, query:
```sql
SELECT 1 FROM ingested_events WHERE source_event_id = ? LIMIT 1
```
If a row exists, the event is a duplicate — skip it. If not, proceed with insert and emit.

Duplicate counts are recorded in `poll_log` (`events_duplicate` column). No separate dedup table — the ingested_events table is the source of truth.

---

## Lineage IDs

Each ingested event carries two identifiers:

| Field             | Assigned by  | Purpose                                               |
|-------------------|--------------|-------------------------------------------------------|
| `event_id`        | Data Scout   | Permanent lineage key; travels through the entire system |
| `source_event_id` | MagicBall    | Original dataset UUID; preserved for traceability back to source |

Both are stored in SQLite and included in all log entries.

---

## Redis Stream

- **Stream name:** `events:ingested`
- **Message payload:**
  ```json
  {
    "event_id": "<data-scout-generated UUID>",
    "source_event_id": "<magicball UUID>",
    "ingested_at": "<ISO8601>"
  }
  ```
- The full event payload is **not** included — downstream consumers fetch what they need from Data Scout using `event_id`
- One message per event, emitted immediately after a successful insert

---

## SQLite Schema

```sql
-- Raw event store
CREATE TABLE ingested_events (
    event_id                     TEXT PRIMARY KEY,  -- UUID v4 assigned by Data Scout
    source_event_id              TEXT NOT NULL UNIQUE, -- original MagicBall UUID
    category                     TEXT NOT NULL,     -- breaking_news | market_movement | natural_disaster
    headline                     TEXT NOT NULL,
    summary                      TEXT NOT NULL,
    severity                     TEXT NOT NULL,     -- low | medium | high | critical
    geographic_scope             TEXT NOT NULL,     -- local | regional | global
    location_country             TEXT NOT NULL,     -- "Global" is a valid reserved value
    location_region              TEXT,              -- nullable
    source_reliability           TEXT NOT NULL,     -- unverified | single_source | multi_source | confirmed
    status                       TEXT NOT NULL,     -- developing | ongoing | concluded
    affected_population_estimate INTEGER,
    economic_impact_usd          INTEGER,
    casualties_confirmed         INTEGER,
    casualties_estimated         INTEGER,
    tags                         TEXT NOT NULL,     -- JSON array as text
    original_published_at        TEXT NOT NULL,     -- ISO8601 from MagicBall dataset
    ingested_at                  TEXT NOT NULL,     -- ISO8601; when Data Scout stored this event
    emitted_at                   TEXT              -- ISO8601; when the Redis Stream message was sent; null if emit failed
);

-- Cursor state (single-row; always id = 1)
CREATE TABLE poll_state (
    id                       INTEGER PRIMARY KEY DEFAULT 1,
    last_successful_poll_at  TEXT,     -- ISO8601; used as ?since= on next poll; null on first run
    last_poll_attempted_at   TEXT      -- ISO8601; updated on every tick regardless of outcome
);

-- Poll history log
CREATE TABLE poll_log (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    polled_at         TEXT    NOT NULL,  -- ISO8601; when the tick fired
    since_cursor      TEXT,             -- value of ?since= sent to MagicBall; null on first run
    status            TEXT    NOT NULL, -- success | empty | error
    events_fetched    INTEGER NOT NULL DEFAULT 0,  -- total returned by MagicBall
    events_new        INTEGER NOT NULL DEFAULT 0,  -- passed dedup check
    events_duplicate  INTEGER NOT NULL DEFAULT 0,  -- caught by dedup
    events_emitted    INTEGER NOT NULL DEFAULT 0,  -- successfully placed on Redis Stream
    error_message     TEXT              -- null unless status = error
);
```

---

## REST API

Data Scout is primarily a background worker. It exposes a minimal read-only HTTP interface for observability.

```
GET /health
```
Returns service status and time of last poll attempt.

```
GET /events/:event_id
```
Returns the full stored payload for a given `event_id`. Used by downstream consumers (Intelligence Layer) to fetch event detail after receiving a stream message.

```
GET /events/source/:source_event_id
```
Lookup by MagicBall original ID. Useful for tracing back from source.

```
GET /logs?level=&event_id=&page=&limit=
```
Returns Data Scout operational logs from `poll_log`. Used by the Notification Gateway's log aggregator.

```
GET /health
```
Returns service status, last poll timestamp, and SQLite connection state.

---

## Environment Variables

| Variable               | Description                                  | Default              |
|------------------------|----------------------------------------------|----------------------|
| `DATASCOUT_PORT`       | Port the API listens on                      | `4101`               |
| `DATASCOUT_DB_PATH`    | Path to the SQLite database file             | `./datascout.db`     |
| `MAGICBALL_BASE_URL`   | Base URL of the MagicBall API                | `http://localhost:4100` |
| `REDIS_URL`            | Redis connection string                      | `redis://localhost:6379` |
| `POLL_INTERVAL_SEC`    | Poll cadence in seconds                      | `300`                |

---

## Logging

All logs stay within Data Scout's own SQLite. No external log sink.

- Every poll attempt → one row in `poll_log`
- Dedup counts are part of the poll log row (`events_duplicate`)
- Emit failures are visible via `emitted_at = null` on `ingested_events` rows
- No log is written to stdout beyond startup confirmation and fatal errors

---

## Deferred

- Retry logic for failed Redis emits (currently: logged as `emitted_at = null`, not retried)
- Backfill mechanism if Data Scout is down for an extended period and MagicBall cursor drifts
- Authentication between Data Scout and MagicBall API
