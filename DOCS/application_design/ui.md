# UI — Design Document

## Role in the System

The UI is a display layer only. It holds no business logic, makes no decisions, and performs no data transformation. It fetches data from backend APIs and renders it. All logic lives in the services.

Authentication is handled by the Notification Gateway. The **implemented** UI ([`apps/ui`](../../apps/ui)) stores the JWT in an HTTP-only cookie and **proxies** all service calls through Next.js Route Handlers (`/api/...`); the browser never holds service base URLs or calls MagicBall / Data Scout / IL / NotifGW directly.

---

## Architecture notes (implementation)

- **Proxy pattern:** The browser only talks to the Next.js app. Route Handlers under `src/app/api/` read the JWT from the `sonrise_jwt` cookie and forward `Authorization: Bearer <token>` to the Notification Gateway and Intelligence Layer. Service URLs are **server-side env** only (`NOTIF_GW_URL`, `INTEL_URL`) — no `NEXT_PUBLIC_*` for those.
- **JWT storage:** After `POST /api/auth/login`, the app sets an HTTP-only `SameSite=Lax` cookie. Client-side JS cannot read the token (XSS-hardening vs `localStorage`).
- **Edge middleware** (`src/middleware.ts`) decodes the JWT payload (no signature verification; the UI does not hold `JWT_SECRET`) to guard routes and return `401`/`403` JSON for `/api/*`. Services remain the source of truth for auth.
- **Admin API protection:** In addition to backend checks, middleware rejects non-`admin` access to `/admin/*`, `/api/admin/*`, `/api/users` (list), and `/api/pipeline*`.

---

## Technology

- **Next.js + TypeScript + shadcn** — display-only; no business logic in the app layer (all logic stays in services)
- **Port:** `4104`

---

## Access Model

| Role | Access |
|---|---|
| Unauthenticated | Login page only |
| `user` | Alerts opt-in page |
| `admin` | Alerts opt-in page + all admin tools |

---

## Pages & Routes

### `/login`
Login form. Posts credentials to **`POST /api/auth/login`** (Next.js), which calls Notification Gateway `POST /auth/login`, then stores the returned JWT in an HTTP-only cookie. Redirects to `/alerts` on success.

---

### `/alerts` — User: Alert Preferences

Available to all authenticated users.

Displays the user's current alert subscription and allows them to update it. On save, calls `PATCH /users/me/preferences` on the Notification Gateway.

**What the user configures:**

- **Event categories** (multi-select checkboxes):
  - Breaking News
  - Market Movements
  - Natural Disasters

- **Minimum severity** (single select):
  - Low — all events
  - Medium
  - High
  - Critical — only the most severe

- **Notification channels** (multi-select checkboxes):
  - Email
  - Slack

No logic in the UI — the form sends the selection as-is to the backend. The backend validates and stores it.

---

### `/admin/pipeline` — Admin: Pipeline Runs

Available to `admin` role only.

Lists recent pipeline runs. Each run is identified by `event_id` (**one list row per lineage** — the Intelligence Layer dedupes multiple `pipeline_synthesis` documents per `event_id`). Calls `GET /pipeline` on the Intelligence Layer.

**Run list columns:** `event_id`, `processed_at`, `outcome` (notified / skipped / failed), `matched_user_count`

**Clicking a run** expands to the pipeline detail view for that `event_id` — calls `GET /pipeline/:event_id`.

**Pipeline detail view:**

- **Source event (Data Scout)** — first card: raw JSON from Data Scout `GET /events/:event_id` (`source_event` on the IL response), or `source_event_fetch_error` if the fetch failed. Use this to compare ingested content to the synthesis step output.

Displays each pipeline step as a card in sequential order:

```
[ Event Synthesis ]        [ Impact Evaluation ]        [ Validation ]        [ Relevance Matching ]        [ Notification Signal ]
```

Each card shows:
- Step name and status (`completed` / `failed` / `skipped`)
- `processed_at` timestamp
- **AI call (synthesis, impact evaluation, validation only)** — when the step document has `ai_log_id`, a collapsible **“AI call: sent & received”** loads `GET /api/pipeline/:event_id/ai-log/:ai_log_id` (proxy to IL) on first open and shows **Sent (prompt)** and **Received (response)** plus a one-line metadata summary (status, duration, token counts, model, error if any). Lazy-loaded so `GET /pipeline/:event_id` stays lean for other callers.
- Expandable JSON block — the full step output document
- **Delete button** — calls `DELETE /api/pipeline/:event_id/step/:step` (proxy to IL `DELETE /pipeline/...`). Clears the step output from MongoDB. Shown when the step document exists and status is a successful terminal state (`completed` for AI steps, `emitted` for the notification signal step).
- **Replay button** — calls `POST /api/pipeline/:event_id/replay/:step` (proxy to IL). Only available when no current output exists for that step (e.g. after delete).

No logic in the UI — delete and replay are direct API calls. The UI re-fetches the run after each action.

---

### `/admin/logs` — Admin: Aggregated Logs

Available to `admin` role only.

Calls `GET /admin/logs` on the Notification Gateway (which aggregates from all services). Displays a unified log table.

**Columns:** `timestamp`, `service`, `level`, `event_id` (if present), `message`

**Filters (passed as query params to the API — no client-side filtering):**
- By service: MagicBall / Data Scout / Intelligence Layer / Notification Gateway
- By level: error / warn / info / debug
- By `event_id` — trace a single event across all services

Logs are paginated. The UI renders what the API returns.

---

### `/admin/users` — Admin: User Management

Available to `admin` role only.

Lists all users. Calls `GET /users` on the Notification Gateway (admin-auth required).

**Columns:** `name`, `email`, `role`, `severity_threshold`, `channels`, `event_categories`, `is_active`

Read-only for now — no create/edit/delete in this phase. Deferred to a later admin tool iteration.

---

### `/admin/system` — Admin: System Health

Available to `admin` role only.

Calls `GET /admin/health` on the Notification Gateway (which aggregates health checks from all services). Displays a status card per service.

**Per service card shows:**
- Service name
- Status: `up` / `down` / `degraded`
- Last seen timestamp
- Key operational metric (e.g. last poll time for Data Scout, last pipeline run for Intelligence Layer, last signal processed for Notification Gateway)

Auto-refreshes every 30 seconds. The UI sets a timer — no WebSocket needed.

---

## API Surface the UI Consumes

| Page | Method | Endpoint | Service |
|---|---|---|---|
| Login | `POST` | `/auth/login` | Notification Gateway |
| Alerts | `GET` | `/users/me` | Notification Gateway |
| Alerts | `PATCH` | `/users/me/preferences` | Notification Gateway |
| Pipeline list | `GET` | `/pipeline` | Intelligence Layer |
| Pipeline detail | `GET` | `/pipeline/:event_id` | Intelligence Layer |
| Pipeline delete step | `DELETE` | `/pipeline/:event_id/step/:step` | Intelligence Layer |
| Pipeline replay step | `POST` | `/pipeline/:event_id/replay/:step` | Intelligence Layer |
| Logs | `GET` | `/admin/logs` | Notification Gateway (aggregator) |
| Users | `GET` | `/users` | Notification Gateway |
| System health | `GET` | `/admin/health` | Notification Gateway (aggregator) |

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NOTIF_GW_URL` | Notification Gateway base URL — **server-side only** (Route Handlers) | `http://localhost:4103` |
| `INTEL_URL` | Intelligence Layer base URL — **server-side only** (Route Handlers) | `http://localhost:4102` |
| `UI_PORT` | Next.js `dev` / `start` listen port | `4104` |

Copy [`apps/ui/.env.example`](../../apps/ui/.env.example) to `apps/ui/.env.local` and adjust for cloud (internal service URLs, `UI_PORT` if the platform assigns ports).

---

## Deferred

- Edit / create / deactivate users from admin UI
- A/B testing tool (admin UI — not yet designed)
- Notification history view per user
- Real-time log streaming (currently polling on page load)
