# Application design assessment
_Exported on 2026. 04. 22. at 18:14:18 CEST from Cursor (3.1.17)_

---

**User**

@DOCS/application_design 

please understand the app - check what is done - what is not againts the codebase

i will want to go for the UI implementation - but first you'd need to build your context

---

**Cursor**

[[ I’m mapping the app from `DOCS/application_design` first, then I’ll compare that design to the actual codebase so we can see what already exists, what is partial, and what is still missing before UI work starts. ]]

[[ I’ve confirmed this is a multi-app workspace, not a single Next.js UI app yet. Next I’m reading the design docs plus the existing service packages so I can compare intended architecture against what is actually implemented. ]]

[[ The design docs are clear: 4 backend services are specified and the UI is planned as a separate display-only app on top. I’m now checking each service implementation against those contracts so we can separate “documented”, “actually built”, and “still missing”. ]]

[[ The main pattern is already visible: backend services are real, UI is still only a design artifact. I’m pulling a few direct code references now so I can give you a precise “done vs not done” map with hard evidence, not guesses. ]]

## Current Reality

This repo is a **backend monorepo with 4 implemented services**:

- `magicball`
- `data-scout`
- `intelligence-layer`
- `notification-gateway`

That is backed by the root scripts and startup flow:

```4:10:package.json
  "scripts": {
    "dev:magicball": "pnpm --filter magicball dev",
    "dev:datascout": "pnpm --filter data-scout dev",
    "dev:intelligence": "pnpm --filter intelligence-layer dev",
    "dev:notification-gateway": "pnpm --filter notification-gateway dev",
    "dev:stack": "bash scripts/start.sh"
```

```32:57:scripts/start.sh
pnpm --filter magicball dev & pids+=($!)
wait_health "http://127.0.0.1:4100/health" "MagicBall"

pnpm --filter data-scout dev & pids+=($!)
wait_health "http://127.0.0.1:4101/health" "DataScout"
...
pnpm --filter notification-gateway dev & pids+=($!)
wait_health "http://127.0.0.1:4103/health" "NotificationGateway"

echo "All four services are up. PIDs: ${pids[*]}. Press Ctrl+C to stop."
```

There is **no UI app in the codebase yet**. I checked for `next.config.*`, `*.tsx`, and `next` / `react` / `@radix-ui` deps across `package.json` files and found none. So `DOCS/application_design/ui.md` is currently a **plan**, not an implemented app.

---

## What Is Already Done

The backend is not just scaffolding. Core product behavior is already implemented.

**1. MagicBall exists and matches the “source simulator” role.**  
It has publish controls, queue inspection, manual publish, events API, health, and logs.

```35:50:apps/magicball/src/routes/admin.ts
  app.get("/admin/controls", () => {
    const row = db
      .prepare(
        `SELECT id, publish_enabled, interval_min_seconds, interval_max_seconds,
                category_filter, min_severity_filter, manual_mode
           FROM publish_controls WHERE id = 1`
      )
```

```164:186:apps/magicball/src/routes/admin.ts
  app.post<{
    Params: { id: string };
  }>("/admin/publish/:id", (request, reply) => {
...
      db.prepare(
        `INSERT INTO publish_log (event_id, published_at, interval_seconds_used)
         VALUES (?, ?, 0)`
      ).run(id, now);
```

**2. Data Scout is implemented as the ingestion worker.**  
It polls MagicBall, dedups by `source_event_id`, assigns a stable `event_id`, stores raw events, and emits to Redis.

```48:67:apps/data-scout/src/services/pollWorker.ts
    const url = cursor
      ? `${magicballBase}/events?since=${encodeURIComponent(cursor)}`
      : `${magicballBase}/events`;

    let events: MagicBallEventResponse[];
    try {
      const resp = await fetch(url);
...
      db.prepare(
        `INSERT INTO poll_log
         (polled_at, since_cursor, status, events_fetched,
          events_new, events_duplicate, events_emitted, error_message)
```

```75:88:apps/data-scout/src/services/pollWorker.ts
    for (const ev of events) {
      const dup = db
        .prepare(
          `SELECT 1 FROM ingested_events WHERE source_event_id = ? LIMIT 1`
        )
        .get(ev.id);
...
      const event_id = randomUUID();
      const ingested_at = new Date().toISOString();
```

```122:138:apps/data-scout/src/services/pollWorker.ts
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
```

It also exposes the downstream lookup API the Intelligence Layer needs:

```25:45:apps/data-scout/src/routes/events.ts
  app.get<{ Params: { source_event_id: string } }>(
    "/events/source/:source_event_id",
...
  app.get<{ Params: { event_id: string } }>(
    "/events/:event_id",
    (request, reply) => {
      const row = db
        .prepare(`SELECT * FROM ingested_events WHERE event_id = ?`)
```

**3. Intelligence Layer is implemented as a real sequential pipeline.**  
It is not just mocked docs. It runs synthesis -> impact -> validation -> relevance -> notification signal.

```16:27:apps/intelligence-layer/src/workflows/intelligencePipeline.ts
/**
 * Functionally matches the design doc’s LlamaIndex workflow: sequential steps,
 * no in-memory handoff of analytical content — only IDs + fetches from Mongo.
 */
export async function runIntelligencePipeline(
```

```37:66:apps/intelligence-layer/src/workflows/intelligencePipeline.ts
  await runSynthesisStep(base, event_id, source_event_id);
  await runImpactEvaluationStep(base, event_id);
  await runValidationStep(base, event_id);
...
  await runRelevanceMatchingStep(baseNoAi, event_id);
...
  await runEmitNotificationSignalStep(
    { config, db, redis: deps.redis, log },
    event_id
  );
  return "notified";
```

The admin/pipeline API from the docs is also present:

```89:110:apps/intelligence-layer/src/routes/pipeline.ts
  app.get<{
    Querystring: { page?: string; limit?: string; pipeline_version?: string };
  }>("/pipeline", async (request) => {
...
    return { data, page, limit, total };
  });
```

```112:137:apps/intelligence-layer/src/routes/pipeline.ts
  app.get<{
    Params: { event_id: string };
    Querystring: { pipeline_version?: string };
  }>("/pipeline/:event_id", async (request) => {
...
      steps: {
        synthesis: syn ?? null,
        impact_evaluation: imp ?? null,
        validation: val ?? null,
        relevance_matching: rel ?? null,
        notification_signal: sig ?? null,
      },
```

```139:170:apps/intelligence-layer/src/routes/pipeline.ts
  app.delete<{
    Params: { event_id: string; step: string };
...
  }>("/pipeline/:event_id/step/:step", async (request, reply) => {
...
    return { deleted, event_id, step, pipeline_version };
  });
```

```172:229:apps/intelligence-layer/src/routes/pipeline.ts
  app.post<{
    Params: { event_id: string; step: string };
...
  }>("/pipeline/:event_id/replay/:step", async (request, reply) => {
...
      if (step === "synthesis") {
        await runSynthesisStep(base, event_id, source_event_id);
```

The Gemini connector is also real, centralised, and fail-fast:

```53:80:apps/intelligence-layer/src/services/geminiConnector.ts
export function createGeminiConnector(deps: {
  manifest: GeminiManifest;
  apiKey: string;
  aiLogs: Collection<AiLogDoc>;
}) {
...
    const stepCfg = manifest.steps[args.step];
    if (!stepCfg) {
      throw new Error(`Unknown step key in manifest: ${args.step}`);
    }
    if (manifest.retry_policy.enabled) {
      throw new Error("Manifest retry_policy.enabled must be false (fail-fast)");
```

**4. Notification Gateway is implemented beyond auth only.**  
It handles JWT login, user preferences, admin aggregation, stream consumption, and mocked delivery.

Login exists:

```14:46:apps/notification-gateway/src/routes/auth.ts
  app.post<{
    Body: { email?: string; password?: string };
  }>("/auth/login", async (request, reply) => {
...
    const token = signToken(config, row.user_id, role);
...
    return {
      token,
      user: {
```

User-facing preferences exist:

```43:55:apps/notification-gateway/src/routes/users.ts
  app.get("/users/me", async (request, reply) => {
...
    return rowToPublic(row);
  });
```

```57:125:apps/notification-gateway/src/routes/users.ts
  app.patch<{
    Body: Partial<{
      event_categories: string[];
      severity_threshold: string;
      channels: string[];
    }>;
  }>("/users/me/preferences", async (request, reply) => {
...
    return rowToPublic(updated);
```

Admin health and merged logs exist:

```91:126:apps/notification-gateway/src/routes/admin.ts
  app.get("/admin/health", async (request, reply) => {
...
    for (const [name, base] of Object.entries(bases)) {
      try {
        const res = await fetch(`${base.replace(/\/$/, "")}/health`);
...
    return { services, checked_at: new Date().toISOString() };
  });
```

```137:196:apps/notification-gateway/src/routes/admin.ts
  }>("/admin/logs", async (request, reply) => {
...
    for (const t of targets) {
      try {
        const { data } = await fetchLogsPage(t.base, qs);
...
    return { data, page, limit, total };
  });
```

Delivery planning is also wired against Intelligence Layer pipeline output:

```47:57:apps/notification-gateway/src/services/deliveryOrchestrator.ts
export async function planDeliveryLogRows(
  db: Database,
  intelBaseUrl: string,
  event_id: string
): Promise<NotificationLogInsert[]> {
  const pipeline = await fetchPipelineAggregate(intelBaseUrl, event_id);
...
  if (!matched?.length) {
    throw new Error("No matched users in pipeline");
```

---

## What Is Not Done Yet

### 1. The UI itself is not implemented
This is the biggest gap if your next step is UI work.

The design doc clearly specifies the intended UI:

```11:15:DOCS/application_design/ui.md
## Technology

- **Next.js + TypeScript + shadcn** — display-only; no business logic in the app layer (all logic stays in services)
- **Port:** `4104`
```

But the repo has no UI package, no Next app, no React files, and the startup script never launches a port `4104` service.

### 2. Some documented features remain deferred or partially implemented
Main ones I could verify:

- **Admin user management CRUD** is still deferred; only listing exists.
- **Real delivery transports** are not done; email/slack are mocked.
- **A/B testing tooling** is not present.
- **Realtime UI/log streaming** is not present.
- **Notification history UI** is not present.

### 3. The system is backend-first, not “UI-ready complete”
Important distinction: the backend contracts are mostly there, but the repo is not yet a full product because the display layer is missing.

---

## Docs vs Code Mismatches

These matter, because if we build UI on top of wrong docs, we will hit the wrong target.

### 1. `design-brief.md` is internally inconsistent about the UI
It says the startup order includes UI on `4104`:

```136:149:DOCS/application_design/design-brief.md
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
```

But the actual script only starts four services, no UI. So for implementation planning, **the codebase wins**.

### 2. `ui.md` says Next.js, but its env vars are Vite-style
The same UI doc says Next.js, but lists `VITE_*` env vars:

```153:159:DOCS/application_design/ui.md
| Variable | Description | Default |
|---|---|---|
| `VITE_API_NOTIF_GW` | Notification Gateway base URL | `http://localhost:4103` |
| `VITE_API_INTEL` | Intelligence Layer base URL | `http://localhost:4102` |
| `UI_PORT` | Dev server port | `4104` |
```

If we build a **Next.js** UI, those env names should be treated as a doc bug, not a source of truth.

### 3. Notification Gateway auth doc is inconsistent on `/health`
The doc says both “public” and “authenticated” in different places. Code shows `/health` is public:

```11:40:apps/notification-gateway/src/routes/health.ts
  app.get("/health", async () => {
...
    return {
      status: dbOk && redisOk ? "ok" : "degraded",
      service: "notification-gateway",
      timestamp: now,
```

### 4. Some “strict design” details are looser in code
Examples:

- Intelligence Layer uses a sequential runner, not actual LlamaIndex workflow classes.
- Gemini reasoning is taken from the returned JSON field, not a special thinking-trace API surface.
- Notification Gateway has a default `JWT_SECRET` in code, while the doc suggests none.
- Data Scout logs to stdout more than the doc says.

These are not fatal, but they mean the docs are **not fully trustworthy** for implementation details.

---

## What This Means For UI Work

You now have enough evidence to treat the project as:

- **Implemented backend domain/services**
- **Implemented API surface for most UI needs**
- **No UI code yet**
- **Docs partly accurate, partly stale/conflicted**

So the correct next move for UI is **not** “start from `ui.md` blindly”.  
The correct move is:

1. Treat the **existing backend routes** as primary truth.
2. Use `ui.md` as a **product/page map**, not as an exact technical contract.
3. First define a **UI contract sheet**:
   - actual available endpoints
   - auth flow shape
   - response shapes
   - gaps/mismatches to resolve before building pages

If you want, next I can build that exact **UI implementation context pack** for you:
- page-by-page backend mapping
- what each page can already call
- where the API contracts are still risky
- what must be fixed in docs before coding the UI

---

**User**

I need the UI to be implemented - you must make sure about that - the pipeline can be inspected - in details 
I want you to create a plan

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

[[ I need to read the key response shapes from both services before I can write a prescriptive, dependency-correct plan. Also need to check env.example files and the full types. ]]

[[ I now have all the evidence. Let me verify one more critical thing - the notification gateway's `.env.example` for data-scout and magicball, and check the `apps/magicball/.env.example`, then build the complete plan. ]]

[[ I have all evidence needed. Now composing the full plan. ]]

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Implementing the UI per the plan: reading the plan and workspace, then working through the todos.



Creating the `apps/ui` package and installing dependencies.



Adding shadcn UI primitives: creating component files.



Implementing `lib` files, middleware, API routes, pages, and components.



Updating middleware to return JSON 401/403 for `/api/*` instead of redirecting.



Replacing Radix `Select` in the logs filter form with native `<select>` so GET form submission works.



Here’s what was implemented:

## Summary

### New app: [`apps/ui`](apps/ui)
- **Next.js 15** (App Router) + **TypeScript** + **Tailwind** + **shadcn-style** primitives (`button`, `card`, `badge`, `checkbox`, `label`, `select`, `separator`, `table`, `input`, `alert`, `collapsible`)
- **`src/middleware.ts`**: JWT from `sonrise_jwt` cookie (Edge-safe `atob` decode); JSON **401/403** for `/api/*`; redirects for pages; **admin-only** for `/admin/*`, `/api/admin/*`, **`/api/users`** (list), **`/api/pipeline*`** **(so the IL’s open pipeline routes are not exposed to non-admins via the UI host)**
- **Route Handlers** in `src/app/api/**` proxy to `NOTIF_GW_URL` and `INTEL_URL` with `Authorization: Bearer` ([`src/lib/proxy.ts`](apps/ui/src/lib/proxy.ts))
- **Login**: `POST /api/auth/login` → gateway `POST /auth/login` → HTTP-only cookie
- **Pages**: `/login`, `/alerts`, `/admin/pipeline`, `/admin/pipeline/[event_id]`, `/admin/logs`, `/admin/users`, `/admin/system`
- **Health for stack script**: `GET /api/health` → `{ "status": "ok", "service": "ui" }`

### Workspace
- Root [`package.json`](package.json): `"dev:ui": "pnpm --filter ui dev"`
- [`scripts/start.sh`](scripts/start.sh): starts UI after the gateway, **`wait_health` on `http://127.0.0.1:4104/api/health`**, supports **`SKIP_UI=1`**
- [`.gitignore`](.gitignore): `.next/`
- [`apps/ui/.env.example`](apps/ui/.env.example) for `NOTIF_GW_URL`, `INTEL_URL`, `UI_PORT`

### Docs
- [`DOCS/application_design/ui.md`](DOCS/application_design/ui.md): architecture, proxy, cookie, `NOTIF_GW_URL` / `INTEL_URL`, login/pipeline text updates
- [`DOCS/application_design/design-brief.md`](DOCS/application_design/design-brief.md): 5-service stack, `/api/health`, `SKIP_UI`
- [`DOCS/session-todo/2026-04-22.md`](DOCS/session-todo/2026-04-22.md): UI section with decisions

### Verify locally
```bash
pnpm --filter ui dev
# or full stack (needs Redis, MongoDB, GEMINI_API_KEY, seeded gateway):
pnpm dev:stack
```

**Dev login** (from gateway seed): e.g. `alice@example.com` / `devpassword` — see [`apps/notification-gateway/.env.example`](apps/notification-gateway/.env.example).

`pnpm --filter ui build` and `pnpm --filter ui lint` both pass.

---

**User**

git commit and push - ui implemented - no tests were done yet - but services are up

---

**Cursor**

Staging changes, committing with a clear message, and pushing.



Staging the UI work and related repo updates. Intelligence-layer has separate Vertex/GCP changes; we'll include them in the commit with a clear message, or commit UI-only. Checking whether to exclude `evidence_of_work` and the intelligence-layer diff.



Fixing `.gitignore`: `logs/` ignored `apps/ui/.../admin/logs` and `api/admin/logs`. Scoping the ignore so those routes can be committed.



Here’s what was done:

### Commit
- **Hash:** `859e602`
- **Branch:** `main` → pushed to `origin` (`https://github.com/dstfd/hw_handover_snrs.git`)

**Message (summary):** `feat(ui): Next.js display layer on 4104 with proxy auth and admin tools`

The commit body notes:
- New `apps/ui`, `dev:ui`, `start.sh` + `SKIP_UI`, docs/session-todo
- **No automated UI tests**; services described as verified manually
- **Intelligence layer** changes are included: switch from `@google/generative-ai` + `GEMINI_API_KEY` to **Vertex AI** (`GCP_PROJECT_ID`, `GCP_LOCATION`). If that was only local/experimental, you may want a follow-up commit or revert on `apps/intelligence-layer/`.
- **`.gitignore` fix:** `logs/` was ignoring Next.js routes like `admin/logs`. It’s now **`/logs/`** (root only), and the missing **`admin/logs` page** + **`api/admin/logs` route** are in the commit.

### Not committed
- `evidence_of_work/` (still untracked)

If you want `apps/intelligence-layer` reverted to the API-key flow in a separate commit, say so and we can do that next.

