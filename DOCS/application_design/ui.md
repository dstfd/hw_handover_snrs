# UI — Design Document

## Role in the System

The UI is a display layer only. It holds no business logic, makes no decisions, and performs no data transformation. It fetches data from backend APIs and renders it. All logic lives in the services.

Authentication is handled by the Notification Gateway. The UI stores the JWT and attaches it to every request.

---

## Technology

- **React + TypeScript + Vite** — lightweight, no SSR needed
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
Login form. Posts credentials to `POST /auth/login` on the Notification Gateway. Stores the returned JWT. Redirects to `/alerts` on success.

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

Lists recent pipeline runs. Each run is identified by `event_id`. Calls `GET /pipeline` on the Intelligence Layer.

**Run list columns:** `event_id`, `processed_at`, `outcome` (notified / skipped / failed), `matched_user_count`

**Clicking a run** expands to the pipeline detail view for that `event_id` — calls `GET /pipeline/:event_id`.

**Pipeline detail view:**

Displays each pipeline step as a card in sequential order:

```
[ Event Synthesis ]        [ Impact Evaluation ]        [ Validation ]        [ Relevance Matching ]        [ Notification Signal ]
```

Each card shows:
- Step name and status (`completed` / `failed` / `skipped`)
- `processed_at` timestamp
- Expandable JSON block — the full step output document
- **Delete button** — calls `DELETE /pipeline/:event_id/step/:step`. Clears the step output from MongoDB. Only available if step status is `completed`.
- **Replay button** — calls `POST /pipeline/:event_id/replay/:step`. Only available after the step has been deleted (i.e. when no current output exists for that step).

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
| `VITE_API_NOTIF_GW` | Notification Gateway base URL | `http://localhost:4103` |
| `VITE_API_INTEL` | Intelligence Layer base URL | `http://localhost:4102` |
| `UI_PORT` | Dev server port | `4104` |

---

## Deferred

- Edit / create / deactivate users from admin UI
- A/B testing tool (admin UI — not yet designed)
- Notification history view per user
- Real-time log streaming (currently polling on page load)
