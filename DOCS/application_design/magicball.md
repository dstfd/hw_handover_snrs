# MagicBall — Design Document

## Role in the System

MagicBall is the fictional aggregated data provider. It holds a pre-generated dataset of world events and exposes them progressively via a REST API, simulating a live data feed. Data Scout polls this API on a schedule.

MagicBall has no knowledge of downstream components. It only knows about its own dataset and its publish routine.

---

## Responsibilities

- Store the full pre-generated event dataset in SQLite
- Run an internal publish routine that makes events retrievable at random intervals
- Expose a REST API for Data Scout to poll
- Provide admin controls to manipulate the publish behaviour during testing

---

## Publish Routine

- Runs on a background timer
- On each tick, selects the next unpublished event from the queue and marks it as available
- Interval between ticks is randomised: **between 5 and 15 minutes** (300–900 seconds), redrawn after each tick
- Queue order: **chronological by `original_published_at`** — events surface in the order they were originally timestamped
- Exactly **one event per tick** — no batching
- The routine records the actual interval used on each tick (for audit and replay analysis)
- The routine respects the `publish_controls` config at the moment of each tick — if paused, it skips that tick without publishing

---

## SQLite Schema

```sql
-- Core event store
CREATE TABLE events (
    id                           TEXT PRIMARY KEY,  -- UUID from dataset
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
    tags                         TEXT NOT NULL,     -- JSON array as text e.g. '["flood","region"]'
    original_published_at        TEXT NOT NULL,     -- ISO8601 from dataset; used for queue ordering
    queue_position               INTEGER NOT NULL,  -- assigned at import; sort order of original_published_at ASC

    -- Publish state
    is_available                 INTEGER NOT NULL DEFAULT 0,  -- 0 = queued, 1 = available via API
    made_available_at            TEXT                          -- ISO8601; set by publish routine on release
);

-- Publish routine audit log
CREATE TABLE publish_log (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id              TEXT NOT NULL REFERENCES events(id),
    published_at          TEXT NOT NULL,     -- ISO8601; when routine released this event
    interval_seconds_used INTEGER NOT NULL   -- actual random interval that preceded this publish
);

-- API poll log (Data Scout requests)
CREATE TABLE api_access_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    requested_at    TEXT NOT NULL,  -- ISO8601
    since_cursor    TEXT,           -- value of ?since= param; null if absent
    events_returned INTEGER NOT NULL
);

-- Publish routine controls (single-row config; always id = 1, use UPDATE to change)
CREATE TABLE publish_controls (
    id                   INTEGER PRIMARY KEY DEFAULT 1,
    publish_enabled      INTEGER NOT NULL DEFAULT 1,    -- 0 = paused, 1 = running
    interval_min_seconds INTEGER NOT NULL DEFAULT 300,  -- lower bound of random interval
    interval_max_seconds INTEGER NOT NULL DEFAULT 900,  -- upper bound of random interval
    category_filter      TEXT    DEFAULT NULL,          -- NULL = all; else JSON array e.g. '["breaking_news"]'
    min_severity_filter  TEXT    DEFAULT NULL,          -- NULL = all; else: low | medium | high | critical
    manual_mode          INTEGER NOT NULL DEFAULT 0     -- 1 = routine paused; publish only via admin endpoint
);
```

### Schema Notes

- `tags` stored as JSON text — SQLite has no array type; use `json_each()` for filtering queries
- `location_country` uses `"Global"` as a literal reserved value for events with no specific country — downstream consumers must handle this
- `queue_position` is immutable after import — assigned once by sorting `original_published_at` ascending
- `economic_impact_usd` is present across all categories, not just market movements — some breaking news and natural disaster events carry economic figures

---

## REST API

### Authentication

No authentication for now — MagicBall runs as a local service within a trusted dev environment. This is a deliberate scope decision; not the focus of the exercise.

### Endpoints

#### Data Scout — polling

```
GET /events?since=<ISO8601>
```

Returns all events where `is_available = 1` and `made_available_at > since`.
If `since` is omitted, returns all currently available events.
Response: JSON array ordered by `made_available_at` ascending.

```
GET /events/:id
```

Returns a single event by ID regardless of availability state. Useful for debugging.

#### Admin — publish controls

```
GET /admin/controls
```
Returns current publish controls config.

```
PATCH /admin/controls
```
Updates one or more fields in the publish controls row. Accepts a partial JSON body.

```
POST /admin/publish/:id
```
Manually marks a specific event as available immediately, bypassing the routine. Useful for targeted testing of a specific event type or severity.

```
GET /admin/queue
```
Returns all events with their queue position and current availability state — shows what has been released and what is pending.

```
GET /logs?level=&event_id=&page=&limit=
```
Returns MagicBall operational logs from `publish_log` and `api_access_log`. Used by the Notification Gateway's log aggregator.

```
GET /health
```
Returns service status, publish routine state (running / paused), and last publish timestamp.

---

## Reset Script

Resetting MagicBall (for test replay) is done via a standalone script, not a built-in API endpoint. This is intentional — reset is a destructive dev-time operation and should not be reachable at runtime.

```
scripts/reset.js   (or reset.py)
```

**What it does:**
1. Sets `is_available = 0` and `made_available_at = NULL` on all rows in `events`
2. Truncates `publish_log`
3. Truncates `api_access_log`
4. Resets the publish controls row to defaults

**Usage:**
```bash
node scripts/reset.js --db ./magicball.db
```

The script requires explicit `--db` path to avoid accidental runs against the wrong file.

---

## Data Import (Seeder)

On first run, the seeder reads `world_events_test_dataset.json`, inserts all 35 events, and assigns `queue_position` by sorting `original_published_at` ascending. All events start with `is_available = 0`.

The seeder is idempotent — re-running on a populated DB does nothing (`INSERT OR IGNORE`).

```bash
# From monorepo root: `cd apps/magicball && pnpm seed -- --db ./magicball.db`
# Or with env: `MAGICBALL_DB_PATH=./magicball.db pnpm seed -- --data <path-to-json>`
# Default data file: repo `Temp/dataset_magicball/world_events_test_dataset.json`
```

---

## Environment Variables

| Variable              | Description                            | Default          |
|-----------------------|----------------------------------------|------------------|
| `MAGICBALL_PORT`      | Port the API listens on                | `4100`           |
| `MAGICBALL_DB_PATH`   | Path to the SQLite database file       | `./magicball.db` |
| `INTERVAL_MIN_SEC`    | Default lower bound for publish interval | `300`          |
| `INTERVAL_MAX_SEC`    | Default upper bound for publish interval | `900`          |

---

## Deferred

- Granular presentation controls beyond category and severity filters (e.g. volume throttle, topic clustering)
- Multiple datasets / dataset switching
