# Alert System — High-Level Design Brief

## Problem Statement

Users need to be notified when something important happens in the world (breaking news, market movements, natural disasters). Notifications must support email and Slack, with the architecture extensible to future channels. An admin view is required.

---

## System Components

### 1. MagicBall (Data Source)
- Fictional aggregated data provider, accessed via API
- Covers three event categories: **breaking news**, **market movements**, **natural disasters**
- Backed by **SQLite**
- Events are pre-generated and stored in advance
- A publish routine surfaces events at random intervals between **5 and 15 minutes**
- Requires a granular mechanism for controlling how events are "presented" (cadence, type, volume) — to be designed separately

### 2. Data Scout (Ingestion)
- Polls MagicBall API and retrieves new events
- Persists raw events to **SQLite** (for traceability)
- **Assigns a stable `event_id` to every ingested event** — this ID is the lineage spine for the entire system
- Emits ingested events onto a **message bus** — all downstream communication is event-driven from this point
- Data Scout logs are stored in its own **SQLite**

### 3. Intelligence Layer (Pipeline)
- Consumes events from the message bus
- The `event_id` assigned by Data Scout is the **pipeline run identifier** — knowing this ID, every processing artifact can be traced back to its origin
- Runs a deterministic pipeline:
  1. **Event synthesis** — normalise, enrich, and generate facts from the raw event
  2. **Impact evaluation** — assess significance
  3. **Validation** — sanity-check the output
  4. **Relevance matching** — match event against user alert subscriptions
  5. **Notification signal** — emit a signal for matched users
- Each pipeline step is **discrete and replayable independently**
- Persistence: **MongoDB** (document/JSON-native, suited to the structured but variable shape of pipeline outputs)
- Pipeline processing logs are stored in **MongoDB**

### 4. Notification Gateway (Delivery)
- Consumes notification signals from the message bus
- Owns all message delivery logic
- Implements channel interfaces/wrappers — initially:
  - **Email**
  - **Slack**
  - Designed for extensibility (further channels added without structural changes)
- Backed by **SQLite**
- Notification Gateway logs are stored in its own **SQLite**

---

## Cross-Cutting Concerns

### Lineage & Traceability
- Every event is assigned a stable `event_id` at ingestion (Data Scout)
- That ID propagates through every stage: ingest → pipeline steps → notification signal → delivery
- All logs, pipeline artifacts, and AI call records reference this ID
- This makes the full processing chain of any event reconstructable from a single ID

### Language

All services are implemented in **TypeScript**.

### Logger Setup

Each service uses a structured JSON logger (`pino` recommended). Logs are written to stdout — no centralised log sink.

Every log entry must include:
- `service` — the service name (e.g. `data-scout`, `intelligence-layer`)
- `level` — `error | warn | info | debug`
- `timestamp` — ISO8601
- `event_id` — included on any log entry where an event is in scope

Each service also persists operational logs to its own database (as per the logging locality decision). Stdout logging and DB logging are independent — one does not replace the other.

### Authentication

JWT-based auth, issued and validated by the Notification Gateway (which owns the user directory). Internal service-to-service communication has no auth — only the external-facing API (UI, admin tool) requires a token.

User roles: `user` | `admin`. Admin endpoints require the `admin` role. Auth is mocked at this stage — no external identity provider.

> **Decision: Notification Gateway issues JWTs**
> Auth lives where the user directory lives. No separate auth service introduced at this stage.

### Pure Block Architecture
- Each component owns its logic entirely — no logic bleeds across service boundaries
- UI (when introduced) will be **display-only**: it holds no business logic

### Logging Locality
Each component logs into its own database — logs do not cross service boundaries:

| Component            | Logs stored in |
|----------------------|----------------|
| Data Scout           | SQLite (own)   |
| Intelligence Layer   | MongoDB        |
| Notification Gateway | SQLite (own)   |

### AI Logging
- No external AI API gateway is used — AI calls are made directly from within the relevant pipeline step
- Every AI call is logged to a **dedicated MongoDB collection** (`ai_logs`)
- Each log entry captures:
  - `event_id` (lineage reference)
  - Pipeline step name
  - Prompt sent (full text)
  - Response received (full text)
  - Token counts (input and output)
  - `reasoning` field — pipeline steps that produce decisions or generated facts (e.g. synthesis, impact evaluation) **explicitly instruct the model to output its reasoning**; this is captured as a first-class field, not inferred after the fact

> **Decision: Reasoning as a first-class output**
> Rather than inferring model reasoning from responses, prompts at decision-making steps will explicitly request a structured `reasoning` field. This keeps the AI's decision rationale auditable and queryable, and supports future A/B testing and pipeline replay analysis.

### AI Model
- **`gemini-2.5-pro`** — selected for its native reasoning/thinking capability, which is used to populate the `reasoning` field directly from the model's thinking trace rather than as a prompted afterthought

---

## Architectural Decisions

> **Decision: User directory lives in the Notification Gateway**
> Rather than introducing a separate user directory service, user records and alert subscriptions are owned and stored by the Notification Gateway (SQLite). This keeps the service count low and co-locates delivery configuration with the delivery owner. To be revisited if the user model grows in complexity.

> **Decision: MongoDB for the Intelligence Layer**
> Pipeline steps produce structured but variably-shaped JSON documents (facts, scores, match results). MongoDB's document model fits this naturally without requiring schema migrations as the pipeline evolves.

> **Decision: Event-driven communication from Data Scout onwards**
> MagicBall → Data Scout is a pull (API polling). Everything downstream is event-driven via message bus. This decouples pipeline stages and makes individual steps replayable without re-polling the source.

> **Decision: Pipeline steps are replayable**
> Each step is self-contained and can be re-run against a stored input using the `event_id` as the key. This enables debugging, regression testing, and future A/B testing of pipeline variants without re-ingesting events.

---

### Startup Script

A single startup script launches all services in dependency order. Port range: **4100–4110**.

| Port | Service |
|------|---------|
| `4100` | MagicBall |
| `4101` | Data Scout |
| `4102` | Intelligence Layer |
| `4103` | Notification Gateway |
| `4104` | UI |

**Launch order:**
1. MagicBall (no dependencies)
2. Data Scout (depends on MagicBall + Redis)
3. Intelligence Layer (depends on Data Scout + Redis + MongoDB)
4. Notification Gateway (depends on Intelligence Layer + Redis)
5. UI (depends on Intelligence Layer + Notification Gateway)

The script polls each service's `GET /health` endpoint before starting the next. If a service fails to become healthy within a timeout, the script halts with a clear error.

Script location: `scripts/start.sh` (**implemented**). It starts **MagicBall → Data Scout → Intelligence Layer → Notification Gateway** (ports 4100–4103) in that order, health-gated on each `GET /health`. Set `SKIP_INTELLIGENCE=1` to run only MagicBall and Data Scout (e.g. when MongoDB/Gemini are not available). Set `SKIP_NOTIFICATION_GATEWAY=1` after Intelligence Layer to skip the gateway (IL-only local). **Prerequisites:** local Redis, MongoDB, a valid `GEMINI_API_KEY` for Intelligence Layer AI steps, and a seeded Notification Gateway user directory (`pnpm --filter notification-gateway seed`) before relevance/delivery end-to-end runs.

---

## Communication Style

| Leg | Style |
|-----|-------|
| MagicBall → Data Scout | Pull (API polling) |
| Data Scout → Intelligence Layer | Event-driven (message bus) |
| Intelligence Layer → Notification Gateway | Event-driven (message bus) |

---

## Storage Summary

| Component            | Storage   | Notes                              |
|----------------------|-----------|------------------------------------|
| MagicBall            | SQLite    |                                    |
| Data Scout           | SQLite    | Raw events + ingest logs           |
| Intelligence Layer   | MongoDB   | Pipeline artifacts + AI logs       |
| Notification Gateway | SQLite    | User directory + delivery logs     |

---

## Deferred

- **Admin view** — scoped out until the backend layer is fully designed and built
- **A/B testing tool** — noted for inclusion in the admin tool; requires **database versioning support** in MongoDB to be accounted for in schema design now, even though the tool itself is deferred
- **MagicBall granular presentation controls** — cadence, type, and volume controls to be designed in a separate conversation
- **AI model version** — `gemini-2.5-pro` confirmed
