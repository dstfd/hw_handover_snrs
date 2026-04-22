# Expandable section in pipeline runs
_Exported on 2026. 04. 22. at 18:46:38 CEST from Cursor (3.1.17)_

---

**User**

I need an expandable section in the pipeline runs 

it needs to be a toggle also
sent and received AI call should be displayed there

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

Exploring the codebase to locate pipeline runs UI, AI call data, and architecture so we can draft a detailed plan.



Confirming: AI payloads live in MongoDB `ai_logs` (`prompt` = sent, `response` = received); step docs only store `ai_log_id`. The list endpoint and `PipelineRunsTable` do not include AI data. The natural place is the pipeline run detail (`StepCard`) or a new section on that page. Creating the detailed plan.



---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Implementing the plan: starting with the Intelligence Layer repository and route, then the UI, docs, and verification.



Implementing repository + route: registering the more specific `ai-log` route before `GET /pipeline/:event_id`.



Resetting AI fetch state when `eventId` or `aiLogId` changes so we don't show stale data after refresh/replay.



Here’s what was implemented:

### Intelligence Layer
- [`apps/intelligence-layer/src/repositories/aiLogsRepo.ts`](apps/intelligence-layer/src/repositories/aiLogsRepo.ts) — added `findAiLogById`.
- [`apps/intelligence-layer/src/routes/pipeline.ts`](apps/intelligence-layer/src/routes/pipeline.ts) — registered **`GET /pipeline/:event_id/ai-log/:ai_log_id`** before `GET /pipeline/:event_id`. Returns `400` for invalid ObjectId, `404` if missing or `doc.event_id !== event_id`, otherwise `toJsonApiValue(doc)`.

### Next.js UI
- [`apps/ui/src/app/api/pipeline/[event_id]/ai-log/[ai_log_id]/route.ts`](apps/ui/src/app/api/pipeline/[event_id]/ai-log/[ai_log_id]/route.ts) — proxies to IL (same pattern as other pipeline routes).
- [`apps/ui/src/lib/types.ts`](apps/ui/src/lib/types.ts) — added **`AiLogDetail`** for the JSON shape.

### `StepCard`
- [`apps/ui/src/components/StepCard.tsx`](apps/ui/src/components/StepCard.tsx) — for **synthesis / impact_evaluation / validation** when `ai_log_id` is set: collapsible **“AI call: sent & received”**, loads on first open, **Sent (prompt)** / **Received (response)** in `<pre>`, plus a short metadata line. **`useEffect`** clears AI state when `eventId` or `aiLogId` changes (e.g. after replay/refresh).

### Docs & tests
- [`DOCS/application_design/ui.md`](DOCS/application_design/ui.md), [`DOCS/application_design/intelligence-layer.md`](DOCS/application_design/intelligence-layer.md), [`DOCS/session-todo/2026-04-22.md`](DOCS/session-todo/2026-04-22.md) — updated as in the plan.
- [`apps/intelligence-layer/src/routes/__tests__/pipeline.test.ts`](apps/intelligence-layer/src/routes/__tests__/pipeline.test.ts) — contract check for the `ai-log` path.

### Verification
- `pnpm --filter intelligence-layer run build` + `test` — pass.  
- `pnpm --filter ui exec tsc --noEmit` + `lint` — pass.

**Notification Gateway** is unchanged: it still only uses `GET /pipeline/:event_id` for aggregates.  

**Manual check:** log in as admin, open a pipeline run with a completed AI step, expand **AI call: sent & received** and confirm text matches `ai_logs` for that `ai_log_id`.

