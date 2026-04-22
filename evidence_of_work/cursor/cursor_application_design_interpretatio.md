# Application design interpretation and intelligence layer
_Exported on 2026. 04. 22. at 16:46:41 CEST from Cursor (3.1.17)_

---

**User**

DOCS/application_design
please interpret these - we'll need to go further with the intelligence layer - but build your context from the docs - codebase. - also utilize subagents - so your context window stays cleaner

---

**Cursor**

[[building context from `DOCS/application_design` first, then I’ll cross-check the codebase for the current intelligence-layer shape using readonly subagents so the analysis stays grounded and the main thread stays clean.]]

[[I found the design set, including `intelligence-layer.md`, `data-scout.md`, `magicball.md`, `gemini-connector.md`, `notification-gateway.md`, and the UI/design brief. Next I’m reading those together while separate readonly subagents map where the codebase already implements or diverges from them.]]

[[the docs are clear: the system is designed as a five-part service chain, but the repo currently implements only the upstream half. I’m pulling the exact code evidence now so I can separate “documented target architecture” from “what already exists” without guessing.]]

[[I have enough to separate the target design from the live implementation. I’m doing one last structural pass over `apps/` so the interpretation includes the real current extension points for the intelligence layer.]]

[[context built from docs + code]]

I interpret `DOCS/application_design` as a **target multi-service architecture**, not a description of what is already built.

The docs define a strict pipeline:

```1:16:DOCS/application_design/intelligence-layer.md
# Intelligence Layer — Design Document

## Role in the System

The Intelligence Layer is the processing pipeline. It consumes ingestion signals from the Redis Stream, runs a sequence of AI-driven steps to analyse each event, and emits a notification signal when warranted. It owns all analytical logic — no other component reasons about event content.

---

## Responsibilities

- Consume `events:ingested` messages from the Redis Stream
- Fetch the full event payload from Data Scout using `event_id`
- Run the pipeline: synthesis → impact evaluation → validation → relevance matching
```

And they pin the orchestration model clearly:

```447:486:DOCS/application_design/intelligence-layer.md
## Orchestration — LlamaIndex Workflows

The pipeline is orchestrated using **LlamaIndex Workflows** (TypeScript). Each pipeline step is a `@step` decorated handler. Steps communicate via typed events — no in-memory state is passed between them beyond the IDs needed to fetch from MongoDB.

### Workflow events

```typescript
class PipelineStartEvent   extends StartEvent   { event_id: string; source_event_id: string; }
class SynthesisCompleted   extends WorkflowEvent { event_id: string; synthesis_id: string; }
class ImpactCompleted      extends WorkflowEvent { event_id: string; impact_id: string; }
class ValidationCompleted  extends WorkflowEvent { event_id: string; validation_id: string; proceed: boolean; }
class RelevanceCompleted   extends WorkflowEvent { event_id: string; relevance_id: string; notification_warranted: boolean; }
class PipelineDone         extends StopEvent     { event_id: string; outcome: "notified" | "skipped" | "failed"; }
```

### Fail-fast in the workflow

If any step throws, LlamaIndex catches at the workflow level. The step writes its own `status: "failed"` document to MongoDB before throwing — so the failure is recorded regardless. The workflow emits `PipelineDone(outcome="failed")` and halts.
```

## What the codebase actually has
The live repo currently contains **only `magicball` and `data-scout` as runnable apps**.

```4:10:package.json
  "scripts": {
    "dev:magicball": "pnpm --filter magicball dev",
    "dev:datascout": "pnpm --filter data-scout dev"
  },
  "pnpm": {
    "onlyBuiltDependencies": ["better-sqlite3", "esbuild"]
  }
```

`data-scout` already produces the exact upstream contract the Intelligence Layer needs:

```6:16:apps/data-scout/src/services/pollWorker.ts
const STREAM_NAME = "events:ingested";

export type PollWorkerHandle = { stop: () => void };

export function startPollWorker(
  db: Database,
  redis: RedisClient,
  log: {
    info: (o: object) => void;
```

```122:138:apps/data-scout/src/services/pollWorker.ts
      try {
        await redis.xadd(
          STREAM_NAME,
          "*",
          "event_id",
          event_id,
          "source_event_id",
          ev.id,
          "ingested_at",
          ingested_at
        );
        const emitted_at = new Date().toISOString();
        db.prepare(
          `UPDATE ingested_events SET emitted_at = ? WHERE event_id = ?`
        ).run(emitted_at, event_id);
```

And `data-scout` already exposes the fetch API the docs say Intelligence Layer should call:

```25:45:apps/data-scout/src/routes/events.ts
  app.get<{ Params: { source_event_id: string } }>(
    "/events/source/:source_event_id",
    (request, reply) => {
      const row = db
        .prepare(`SELECT * FROM ingested_events WHERE source_event_id = ?`)
        .get(request.params.source_event_id) as IngestedEventRow | undefined;
      if (!row) return reply.status(404).send({ error: "Event not found" });
      return rowToResponse(row);
    }
  );

  app.get<{ Params: { event_id: string } }>(
    "/events/:event_id",
```

## Evidence-based interpretation
The system is currently in this state:

1. `MagicBall` exists and publishes source events.
2. `Data Scout` exists and turns them into lineage-based ingested events.
3. The **Intelligence Layer, Notification Gateway, and UI are documented but not implemented in this repo**.

That is not an opinion. It follows from the repo structure and scripts:
- no runnable `intelligence-layer` app
- no `notification-gateway` app
- no UI app
- no MongoDB usage in app code
- no Gemini client in app code
- no consumer for `events:ingested`
- no producer or consumer for `events:notification_signal`

## What this means for “go further with the intelligence layer”
The docs are strong enough to use as the source architecture. The codebase gives these confirmed integration points:

- **Input contract already exists**: Redis stream `events:ingested`
- **Event fetch contract already exists**: `GET /events/:event_id` on `data-scout`
- **Lineage key already exists**: `event_id`
- **Strict behavior is already aligned**: fail-fast, no fallback, explicit persistence per boundary

So the real starting point for the intelligence layer is not “invent the shape”. The shape is already defined. The real task is to build the first missing service that sits **directly after `data-scout`** and implements the documented contracts.

## Clean mental model
Use this as the working system model:

`MagicBall` -> `Data Scout` -> `Intelligence Layer` -> `Notification Gateway` -> `UI`

And inside Intelligence Layer:

`events:ingested` -> `synthesis` -> `impact_evaluation` -> `validation` -> `relevance_matching` -> `events:notification_signal`

## Most important design constraints already fixed by docs
These are not open questions anymore:

- Intelligence Layer is a **standalone service**, not logic inside the UI.
- It owns **all analytical logic**.
- It uses **MongoDB**, not SQLite.
- Gemini config is centralized in `gemini-connector.json`, not scattered in step code.
- It is **fail-fast**, with **no retries and no fallback**.
- Each pipeline step persists its own document and is **replayable**.

If you want, next I can do one of two readonly follow-ups:

1. map the exact file/module structure I would recommend for the new `apps/intelligence-layer`
2. derive the concrete implementation sequence for the first thin vertical slice of the intelligence layer, based only on these docs and the current repo contracts

---

**User**

I want you to create a plan for the intelligence layer

the plan must be made in a very detailed way - code changes included from what - to what - description - and the why - because a way simpler model will execute it

I also want you to
respect the rules, be critical and forwardlooking
you must identify if things are connected
and dependecies like, follow the projects architecture, design, vision, patterns

- session todo updating with reasoning - why we took directions
- deployment paramters update - if relevant
- upstream consistence
- downstream consistency
- alignment, connectedness check
- local development must be ensured without code changes... - cloud differencies!!!! - if relevant
- SACRED DOCU UPDATE??? - if any

think in first, second, third order consequences.




---

**Cursor**

[[to make the plan executable by a simpler model, I need to lock the delivery scope first. The big branch point is whether you want the full documented Intelligence Layer end-to-end, or a thinner first slice; that changes the file plan, APIs, tests, and doc updates materially.]]

**Intelligence Layer Plan Scope**

> **Which scope should the plan target?**
> - Full documented Intelligence Layer service end-to-end: Redis consumer, MongoDB persistence, Gemini connector, all pipeline steps, notification signal emit, observability API, docs/session todo/deployment updates ✔
> - First vertical slice only: enough to consume events and run an initial subset of the pipeline, with later steps deferred

[[scope is now fixed to the full end-to-end Intelligence Layer. I’m mapping the exact implementation seams next: current service patterns, env/deployment conventions, startup/local-dev shape, and where docs/session logs already live so the plan can specify concrete file-by-file changes rather than generic advice.]]

[[I’ve got the repo-level shape. Now I’m reading the small set of files that determine exact “from -> to” code patterns and the current documented gaps, so the plan can name precise edits instead of broad categories.]]

[[I have the evidence set. I’m turning it into an execution-grade plan now: concrete new files, exact existing files to update, dependency/order reasoning, and the system-consistency checks a simpler executor would otherwise miss.]]

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Implementing the Intelligence Layer per the plan. Reading the plan and codebase, then working through the todos.



Creating the service shell and core files, then adding infrastructure, pipeline logic, and routes.



Implementing repositories and service clients.



Fixing `findOne` usage: the MongoDB driver's `findOne` may not support `sort` in all versions—using `find().sort().limit(1).next()`.



Writing prompts and step modules.



Skipping relevance when `proceed` is false (per design). Updating `relevanceMatchingStep` to remove the early branch and gating in the pipeline.



Implementing routes, app, and server.



Adding Vitest config and tests, `scripts/start.sh`, and doc updates.



[[Implemented the full Intelligence Layer service, wired `dev:intelligence` + `dev:stack`, and updated sacred docs + session log.]]

## What was added

### `apps/intelligence-layer/`
- **Fastify** on `INTEL_PORT` (default **4102**), same pattern as MagicBall / Data Scout.
- **Config** in [`apps/intelligence-layer/src/services/config.ts`](apps/intelligence-layer/src/services/config.ts): `INTEL_MONGO_URI`, `INTEL_MONGO_DB`, `REDIS_URL`, `DATASCOUT_BASE_URL`, `NOTIFICATION_GW_BASE_URL`, **`GEMINI_API_KEY` (required)**, `GEMINI_MANIFEST_PATH`, `PIPELINE_VERSION`, `MIN_CONFIDENCE_THRESHOLD`.
- **Runtime manifest**: [`apps/intelligence-layer/gemini-connector.json`](apps/intelligence-layer/gemini-connector.json) (twin of the DOCS file).
- **MongoDB** collections + **indexes** via [`apps/intelligence-layer/src/db/collections.ts`](apps/intelligence-layer/src/db/collections.ts); repositories under `src/repositories/`.
- **Redis**: consumer group on **`events:ingested`**, ack after each run; **skip** if run is already terminal (signal / validation `proceed: false` / relevance done / any `failed` doc).
- **Pipeline**: `runIntelligencePipeline` in [`apps/intelligence-layer/src/workflows/intelligencePipeline.ts`](apps/intelligence-layer/src/workflows/intelligencePipeline.ts) — synthesis → impact → validation → relevance → **optional** `events:notification_signal` emit. Docs describe LlamaIndex; code is a **sequential, design-equivalent** runner (documented in `intelligence-layer.md`).
- **Gemini**: single [`apps/intelligence-layer/src/services/geminiConnector.ts`](apps/intelligence-layer/src/services/geminiConnector.ts) + prompts under `src/prompts/`.
- **API**: `GET /pipeline`, `GET /pipeline/:event_id`, `DELETE/POST` replay, `GET /logs`, `GET /health` per design.
- **Tests**: Vitest; `pnpm --filter intelligence-layer test`.
- **`.env.example`**: [`apps/intelligence-layer/.env.example`](apps/intelligence-layer/.env.example)

### Monorepo / ops
- Root [`package.json`](package.json): `dev:intelligence`, **`dev:stack`** → `bash scripts/start.sh`.
- [`scripts/start.sh`](scripts/start.sh): MagicBall → Data Scout → Intelligence Layer with **health poll**; **`SKIP_INTELLIGENCE=1`** skips IL.

### Docs + session
- [`DOCS/application_design/intelligence-layer.md`](DOCS/application_design/intelligence-layer.md) — env + implementation note + runner wording.
- [`DOCS/application_design/gemini-connector.md`](DOCS/application_design/gemini-connector.md) — runtime file location.
- [`DOCS/application_design/design-brief.md`](DOCS/application_design/design-brief.md) — `start.sh` real + prereqs.
- [`DOCS/application_design/notification-gateway.md`](DOCS/application_design/notification-gateway.md) — `GET /pipeline/:event_id` aggregate; deferred `pipeline_notification_signals` updated.
- [`DOCS/session-todo/2026-04-22.md`](DOCS/session-todo/2026-04-22.md) — implementation + reasoning table.

**Plan file** was not edited (per your request).

## How to run locally
1. **Redis** + **MongoDB** + **`GEMINI_API_KEY`** in the environment.
2. From `apps/intelligence-layer`: copy `.env.example` → `.env` and set `GEMINI_API_KEY`.
3. `pnpm dev:stack` **or** `pnpm dev:magicball` / `dev:datascout` / `dev:intelligence` in separate shells.

**Note:** Relevance needs **Notification Gateway** on `NOTIFICATION_GW_BASE_URL` for `GET /users?...` — if it is down, that step **fails** (by design, fail-fast). For stack testing without a gateway, run upstream only or add a small mock service later.

---

**User**

I want you to on the recent changes
respect the rules, be critical and forwardlooking
you must identify if things are connected
and dependecies like

- session todo updating
- deployment paramters update - if relevant
- upstream consistence
- downstream consistency
- alignment, connectedness check
- local development must be ensured without code changes... - cloud differencies!!!! - if relevant
- SACRED DOCU UPDATE??? - if any

think in first, second, third order consequences.



---

**Cursor**

Reviewing the repo for evidence: session notes, env/deployment touchpoints, and integration boundaries.



Here’s a **critical, evidence-based** read of the recent Intelligence Layer work and how it fits the system. I’m in **Ask mode** (no edits).

---

### Session todo

**What’s in good shape:** [`DOCS/session-todo/2026-04-22.md`](DOCS/session-todo/2026-04-22.md) now records the IL build, reasoning table, deferred items (e.g. no Notification Gateway, partial log story), and links to `scripts/start.sh`. That matches your “decisions + consequences” ask.

**Connectedness gap:** The Cursor rule in [`.cursor/rules/strict-nextjs-engineering.mdc`](.cursor/rules/strict-nextjs-engineering.mdc) tells agents to use **`/docs/session-todo/`** (lines 36–39), but the repo’s real path is **`DOCS/session-todo/`** (see file you have). That’s a process/consistency issue for humans and tools, not a runtime bug. Someone should either align the rule to `DOCS/` or add a single canonical path—otherwise “sacred doc” updates and agent behavior drift.

---

### Deployment / parameters

**In repo:** IL exposes deployment knobs via env only—see [`apps/intelligence-layer/.env.example`](apps/intelligence-layer/.env.example): `INTEL_MONGO_URI`, `INTEL_MONGO_DB`, `REDIS_URL`, `DATASCOUT_BASE_URL`, `NOTIFICATION_GW_BASE_URL`, `GEMINI_API_KEY`, `GEMINI_MANIFEST_PATH`, `PIPELINE_VERSION`, `MIN_CONFIDENCE_THRESHOLD`, `INTEL_PORT`. **No** checked-in Docker/Kubernetes/Helm/CI in this tree from what we saw—so “cloud” is **URI + secrets + `cwd`/manifest path**, not a second code path. That’s the right *shape* for “local and cloud differ only by env.”

**Critical detail:** The session note says the IL needs **`GEMINI_API_KEY`**; without it, `loadConfig()` requires it and the process will not start. That is fail-fast, not a silent fallback.

**`scripts/start.sh`:** It health-checks **fixed** `http://127.0.0.1:4xxx/health` (see [scripts/start.sh](scripts/start.sh))—that’s a **local orchestration** script, not the deployable artifact. In cloud you’d use the same **apps** with env pointing at your Redis/Mongo/URLs; you wouldn’t normally run this exact bash on a PaaS unless you mirror those URLs. No contradiction, but the script is **not** a deployment definition—only a dev convenience.

**Second order:** If `pnpm dev` in each app doesn’t auto-load `.env` (depends on how each `server.ts` is run), operators must still **export** vars or use a process manager that injects them. “No code change” to switch environments still assumes **config injection** is solved outside the repo.

---

### Upstream consistency

**Evidence the chain is wired:**

- Data Scout still emits `events:ingested` with `event_id`, `source_event_id`, `ingested_at` (your session doc states this; implementation predates IL).
- IL is documented to read the full event via **Data Scout** `GET /events/:event_id`—**not** MagicBall—preserving the lineage contract.

**First order:** Ingest message shape and HTTP read path are the right integration surfaces.

**Third order:** Session already flags **`event_id` as a system invariant**; Mongo artifacts keyed by `event_id` + `pipeline_version` only stay coherent if you never “half reset” one store without the others. That’s an operational discipline problem, not something one service can fully enforce.

---

### Downstream consistency

**Notification Gateway (not implemented in code** per session**):** IL’s relevance step **HTTP-calls** `NOTIFICATION_GW_BASE_URL` (see [`.env.example`](apps/intelligence-layer/.env.example)). If nothing listens on 4103, the pipeline will **fail at relevance** (fail-fast by design). Session explicitly calls that out. That’s **consistent with strict rules** but **blocks** a happy-path “full stack” without a stub or the real gateway.

**Docs updated:** [notification-gateway.md](DOCS/application_design/notification-gateway.md) was adjusted to point at **`GET {INTEL}/pipeline/:event_id`** as the stable inspection aggregate—good for future gateway work.

**Log aggregator mismatch (important):** The **design** for Data Scout’s `GET /logs` includes `level` and `event_id` (see [data-scout.md](DOCS/application_design/data-scout.md) grep context). **Code** only implements `page` and `limit`—e.g. [apps/data-scout/src/routes/logs.ts](apps/data-scout/src/routes/logs.ts) (lines 11–12). The future **admin log merge** in the gateway design (forwarding filters to each service) is **not** achievable for Data Scout with the current API—this was already noted in earlier session work; it’s still a **downstream/alignment debt**, not introduced by IL alone, but IL doesn’t remove it.

**IL `GET /logs`:** Session admits it is **mainly `ai_logs`**; “pipeline failure” text in the design is only partially matched—failures in non-AI steps are visible through **`GET /pipeline/:event_id`**, not necessarily unified in `/logs`. That’s a **documentation vs implementation** gap to close when you want a single “ops view.”

---

### Alignment and connectedness (checklist)

| Link | Status |
|------|--------|
| MagicBall → Data Scout → Redis stream | Still the spine; IL subscribes to the stream. |
| Data Scout → IL (HTTP + Redis) | Two contracts (ingest + fetch); both needed. |
| IL → Notification Gateway (HTTP) | **Contract exists in code+env**; **service** does not. |
| IL → Redis `events:notification_signal` | **Only** when relevance says notify; else skipped. |
| Admin/UI docs (`ui.md` etc.) | Not re-verified here line-by-line; UI app still not in `apps/` from earlier work. |
| `gemini-connector` twin (DOCS + `apps/...`) | Documented; **must** stay in sync on manifest edits. |

---

### Local vs cloud (no “special” code paths)

**Good:** `GEMINI_MANIFEST_PATH` and DB/Redis URLs are env-driven; manifest path comment in [intelligence-layer.md](DOCS/application_design/intelligence-layer.md) says resolve from **`cwd` or absolute path**—cloud should use **absolute** or a known working directory.

**Watch:** `start.sh` **hardcodes** localhost health URLs; that is **not** a cloud path—treat it as dev-only. Production should use the same **binaries** with different env, not this script as-is.

---

### Sacred / architecture docs

Updated per session: `intelligence-layer.md`, `gemini-connector.md`, `design-brief.md` (start script), `notification-gateway.md`, plus the session file. **Remaining sacred debt:** the **`/docs/` vs `DOCS/`** mismatch in the workspace rule; and **Data Scout `/logs` query** vs design. **Open** in session: MagicBall `.env.example` interval vars not read by the process (misleading for ops—still a small doc/ops landmine).

---

### First / second / third order (concise)

1. **First order:** A single event can be ingested, processed through Gemini steps, and optionally emit a signal—**if** Mongo, Redis, Gemini key, and (for full path) the gateway are available.
2. **Second order:** No gateway means **no** full happy path; `SKIP_INTELLIGENCE` in `start.sh` avoids starting IL but does **not** “mock” the gateway for pipelines you already start manually. Aggregated admin logs and filter forwarding remain **incomplete** when Data Scout (and possibly others) don’t support the documented query surface.
3. **Third order:** Multi-store lineage + replay + future A/B by `pipeline_version` **depends** on operator discipline and consistent docs. Any “quick fix” that adds fallbacks in the pipeline would **violate** your stated fail-fast product rules unless explicitly requested as a named feature.

If you want this turned into a short **reconciliation checklist** (docs vs code table) or **follow-up PR scope**, say so—in **Agent mode** I could apply doc/rule fixes; in Ask mode I can only outline them as above.

---

**User**

First / second / third order (concise)
First order: A single event can be ingested, processed through Gemini steps, and optionally emit a signal—if Mongo, Redis, Gemini key, and (for full path) the gateway are available.
Second order: No gateway means no full happy path; SKIP_INTELLIGENCE in start.sh avoids starting IL but does not “mock” the gateway for pipelines you already start manually. Aggregated admin logs and filter forwarding remain incomplete when Data Scout (and possibly others) don’t support the documented query surface.
Third order: Multi-store lineage + replay + future A/B by pipeline_version depends on operator discipline and consistent docs. Any “quick fix” that adds fallbacks in the pipeline would violate your stated fail-fast product rules unless explicitly requested as a named feature.
If you want this turned into a short reconciliation checklist (docs vs code table) or follow-up PR scope, say so—in Agent mode I could apply doc/rule fixes; in Ask mode I can only outline them as above.

yes please - keep adding these to the sessiontodo - as open issues

---

**Cursor**

Appending a reconciliation checklist and first/second/third-order open issues to the session todo. Verifying a few code-vs-doc facts for accuracy.



Appending the reconciliation checklist and open issues to the session todo file.



Updates are in [`DOCS/session-todo/2026-04-22.md`](DOCS/session-todo/2026-04-22.md), appended after the “Rejected / deferred” block.

**Added:**

1. **`## Open — reconciliation checklist (docs vs code)`** — markdown table with: Data Scout `/logs` filters, MagicBall `/logs`, IL `/logs` vs pipeline failures, gateway aggregator + missing gateway app, **Cursor rule ` /docs/` vs `DOCS/`**, `start.sh` localhost scope, and `SKIP_INTELLIGENCE` semantics.

2. **`## Open issues — first / second / third order (concise)`** — the three levels you wanted, phrased as open follow-ups (deps for one run, cross-service/ops gaps, long-term discipline and no-fallback policy).

I did **not** change `.cursor/rules` or product docs; the checklist itself lists the rule path as an **open action** so you can fix it in a dedicated PR if you want.

