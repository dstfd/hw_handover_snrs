# Notification Gateway — Design Document

## Role in the System

The Notification Gateway is the delivery service. It consumes notification signals, looks up matched users from its own directory, fetches the event content from the Intelligence Layer, and routes a notification through the appropriate channel interfaces.

It owns no analytical logic. It does not decide who gets notified or why — that decision arrives with the signal. It only owns delivery.

---

## Responsibilities

- Consume `events:notification_signal` from the Redis Stream
- Fetch matched users from `pipeline_relevance_matching` via Intelligence Layer API
- Fetch event headline and facts from `pipeline_synthesis` via Intelligence Layer API

**Implemented IL read surface (this repo):** the gateway (when built) should use `GET {INTEL_BASE_URL}/pipeline/:event_id` and read the `steps.relevance_matching` and `steps.synthesis` objects from the response (or narrow endpoints can be added later; the aggregate route is the stable contract for inspection).
- Look up full user records (contact details, channels) from its own SQLite
- Route each notification through the correct channel interface
- Log every delivery attempt to its own SQLite

---

## Delivery Flow

```
Redis Stream (events:notification_signal)
        ↓
Fetch pipeline_relevance_matching  →  matched user_ids + channels
Fetch pipeline_synthesis           →  headline + facts
        ↓
For each matched user:
  Look up user record in SQLite
  For each channel in user.channels:
    Call channel interface send(user, payload)   ← mocked
    Write to notification_log
```

---

## Notification Payload

What the channel interface receives (and would send):

```json
{
  "event_id": "<lineage ID>",
  "headline": "<from pipeline_synthesis output>",
  "facts": ["<fact 1>", "<fact 2>"],
  "severity": "<from pipeline_impact_evaluation>",
  "sent_at": "<ISO8601>"
}
```

This is also what is stored as `payload` in the notification log.

---

## Channel Interfaces

Channels are implemented as discrete, interchangeable interfaces. Adding a new channel means implementing the interface — no changes to core delivery logic.

**Interface contract:**
```
Channel.send(user, payload) → void
```

**Implemented channels:**

| Channel | Transport | Status |
|---|---|---|
| `EmailChannel` | SMTP | Mocked |
| `SlackChannel` | Incoming Webhook | Mocked |

**Mock behaviour:** The `send()` method is fully invoked with correct parameters. Instead of transmitting, it writes a structured mock record to the log. All downstream logging, status tracking, and lineage recording happen as normal. Delivery `status` is written as `"mocked"` to distinguish from real sends when transport is wired up.

---

## SQLite Schema

```sql
-- User directory
CREATE TABLE users (
    user_id            TEXT PRIMARY KEY,
    name               TEXT NOT NULL,
    email              TEXT,                 -- required if 'email' in channels
    slack_channel      TEXT,                 -- webhook or channel ID; required if 'slack' in channels
    severity_threshold TEXT NOT NULL,        -- low | medium | high | critical
    channels           TEXT NOT NULL,        -- JSON array e.g. '["email","slack"]'
    role               TEXT NOT NULL DEFAULT 'user',  -- user | admin
    password_hash      TEXT NOT NULL,        -- bcrypt hash; used for JWT auth
    event_categories   TEXT NOT NULL DEFAULT '["breaking_news","market_movement","natural_disaster"]', -- JSON array; categories user has opted into
    created_at         TEXT NOT NULL,
    is_active          INTEGER NOT NULL DEFAULT 1
);

-- Delivery log
CREATE TABLE notification_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id     TEXT NOT NULL,              -- lineage ID
    user_id      TEXT NOT NULL REFERENCES users(user_id),
    channel      TEXT NOT NULL,              -- email | slack
    status       TEXT NOT NULL,              -- mocked | failed
    attempted_at TEXT NOT NULL,              -- ISO8601
    payload      TEXT NOT NULL,              -- JSON of what would have been sent
    error        TEXT                        -- null unless status = failed
);
```

---

## Seed Users

Five users covering all combinations of channel and severity threshold. No teams, no hierarchy.

```json
[
  {
    "user_id": "usr-001",
    "name": "Alice",
    "email": "alice@example.com",
    "slack_channel": null,
    "severity_threshold": "low",
    "channels": ["email"],
    "role": "admin"
  },
  {
    "user_id": "usr-002",
    "name": "Bob",
    "email": null,
    "slack_channel": "#alerts-bob",
    "severity_threshold": "medium",
    "channels": ["slack"],
    "role": "user"
  },
  {
    "user_id": "usr-003",
    "name": "Carol",
    "email": "carol@example.com",
    "slack_channel": "#alerts-carol",
    "severity_threshold": "high",
    "channels": ["email", "slack"],
    "role": "user"
  },
  {
    "user_id": "usr-004",
    "name": "Dave",
    "email": "dave@example.com",
    "slack_channel": null,
    "severity_threshold": "critical",
    "channels": ["email"],
    "role": "user"
  },
  {
    "user_id": "usr-005",
    "name": "Eve",
    "email": null,
    "slack_channel": "#alerts-eve",
    "severity_threshold": "medium",
    "channels": ["slack"],
    "role": "admin"
  }
]
```

**Threshold coverage:**
- `low` → Alice/admin (receives all events)
- `medium` → Bob, Eve/admin
- `high` → Carol
- `critical` → Dave (receives only critical events)

**Role coverage:** Alice and Eve are admins. Bob, Carol, Dave are regular users. Passwords are bcrypt-hashed at seed time from a fixed dev-only plaintext value per user (stored in the seed script, never in the DB).

---

## Authentication

JWT-based. Mocked for now — no external identity provider. The Notification Gateway issues and validates its own tokens.

> **Decision: Auth lives in the Notification Gateway**
> The user directory is here, so token issuance belongs here. The UI and admin tool will authenticate against this service. Other internal services (Data Scout, Intelligence Layer) communicate without auth — they are internal only and not exposed.

### Token

- Signed with `JWT_SECRET` (env var)
- Payload: `{ user_id, role, iat, exp }`
- Expiry: 24 hours
- Role values: `user` | `admin`

### Protected endpoints

| Role required | Endpoints |
|---|---|
| Any authenticated | `GET /users/me`, `GET /health` |
| `admin` only | `GET /users` (list mode), `GET /users/:user_id`, `GET /admin/health`, `GET /admin/logs` |
| Internal (no auth) | `GET /users?min_severity=&category=` (both required; called by Intelligence Layer — internal network only) |

---

## REST API

```
POST /auth/login
```
Body: `{ "email": "...", "password": "..." }`. Returns a signed JWT on success.

```
GET /health
```
Returns service status and timestamp of last processed signal. Public.

```
GET /users/me
```
Returns the authenticated user's own record. Requires valid JWT.

```
GET /users?min_severity=<severity>&category=<category>
```
Returns all active users whose `severity_threshold` is at or below the given severity AND who have opted into the given `category`. Used internally by the Intelligence Layer — no auth required on this route (internal network boundary).

Severity order for comparison: `low < medium < high < critical`
Category values: `breaking_news | market_movement | natural_disaster`

```
GET /users/:user_id
```
Returns a single user record. Requires `admin` role.

```
GET /users/me
```
Returns the authenticated user's own full record including `event_categories`, `channels`, `severity_threshold`. Used by the UI to populate the opt-in form.

```
PATCH /users/me/preferences
```
Updates the authenticated user's `event_categories`, `severity_threshold`, and `channels`. Body is a partial JSON object — only provided fields are updated.

```
GET /admin/health
```
Aggregates health responses from all services (MagicBall, Data Scout, Intelligence Layer, Notification Gateway self) and returns a unified status object. Requires `admin` role.

```
GET /admin/logs?service=&level=&event_id=&page=&limit=
```
Fetches logs from each service's `GET /logs` endpoint, merges by timestamp, and returns a paginated unified response. Requires `admin` role. Filter params are forwarded to each service where applicable.

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NOTIF_GW_PORT` | Port the API listens on | `4103` |
| `NOTIF_GW_DB_PATH` | Path to SQLite database | `./notifgw.db` |
| `NOTIF_GW_PUBLIC_URL` | This service’s own HTTP base URL (for `/admin/health` and `/admin/logs` when calling itself; set to public URL in cloud) | `http://127.0.0.1:<NOTIF_GW_PORT>` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `INTEL_BASE_URL` | Intelligence Layer API base URL | `http://localhost:4102` |
| `DATASCOUT_BASE_URL` | Data Scout API base URL | `http://localhost:4101` |
| `MAGICBALL_BASE_URL` | MagicBall API base URL | `http://localhost:4100` |
| `JWT_SECRET` | Secret for signing JWTs | — |
| `JWT_EXPIRY` | Token expiry duration | `24h` |
| `SMTP_HOST` | SMTP host (present but unused while mocked) | `localhost` |
| `SMTP_PORT` | SMTP port (present but unused while mocked) | `1025` |
| `SLACK_WEBHOOK_URL` | Slack webhook URL (present but unused while mocked) | — |

---

## Implementation notes (this repository)

- **Service:** `apps/notification-gateway` — Fastify + SQLite + Redis consumer on `events:notification_signal`, consumer group `notification-gateway`.
- **Idempotency:** table `processed_signals` keyed by Redis stream message id; one successful delivery transaction per message before `XACK`.
- **Delivery:** reads `GET {INTEL_BASE_URL}/pipeline/:event_id`, uses `steps.relevance_matching` for matched users/channels, mocked `email` / `slack` channels, rows in `notification_log` with `status` `mocked` or `failed`.
- **`GET /users`:** without auth query params → admin-only list `{ users: [...] }`. With `min_severity` and `category` → internal relevance array (no JWT), same contract as Intelligence Layer `fetchUsersForRelevance`.
- **`PATCH /admin/controls`:** not implemented — reserved; no contract defined yet.

---

## Architectural Decision — User Directory Here

> **Decision: User directory lives in the Notification Gateway**
> Rather than a separate user service, user records are owned by the Notification Gateway. The gateway is the only component that needs contact details — co-locating them here avoids an extra service and an extra network hop. To be revisited if user management grows in scope.

---

## Logging

All logs stay within the Notification Gateway's own SQLite. No external log sink.

- Every delivery attempt → one row in `notification_log` per user per channel
- `status: "mocked"` while transport is not wired up
- `payload` column stores the full JSON that would have been sent — preserves full traceability even without real delivery
- `event_id` on every log row — full lineage traceable from any delivery record

---

## Deferred

- Real SMTP delivery (replace mock in `EmailChannel`)
- Real Slack webhook delivery (replace mock in `SlackChannel`)
- Additional channel interfaces (e.g. SMS, push, webhook)
- User management endpoints (create, update, deactivate) — for admin UI
- ~~`pipeline_notification_signals` MongoDB collection (Intelligence Layer side of delivery records)~~ **Implemented in Intelligence Layer**; gateway may still add its own cross-reference rows if needed for delivery analytics
