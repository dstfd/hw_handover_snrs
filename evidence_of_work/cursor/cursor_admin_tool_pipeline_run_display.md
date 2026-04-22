# Admin tool pipeline run display and errors
_Exported on 2026. 04. 22. at 18:33:12 CEST from Cursor (3.1.17)_

---

**User**

1. in nthe admin tool - pipeline run - i need a display for the event content - so i can check it against the outputs.
2. I have a JSON issue in event synthesis
3. I also have two next errors

Troubleshoot - look into the db-s - bring hard evidence - with timeline 
about the API rate limit issue - im aware. - i have changed to vertex AI endpoint 


---

**Cursor**

Troubleshooting pipeline admin UI, duplicate React keys, event synthesis JSON, and gathering DB evidence. Exploring the codebase and data layer.



Identifying root cause: `listSynthesisForRuns` returns every `pipeline_synthesis` document sorted by `processed_at`, so replays or failed+completed rows produce duplicate `event_id` values. Verifying the detail route and implementing fixes.



Implementing backend deduplication (root cause of duplicate React keys), adding source event to the pipeline detail API and UI, hardening synthesis JSON parsing, and querying MongoDB for evidence.



Implementing fixes: [[Duplicate React keys traced to multiple `pipeline_synthesis` rows per `event_id` (replays/failures). Mongo shows two rows for `4efef09b-...` at 15:46:15Z and 15:50:20Z with 429 on `generativelanguage.googleapis.com`. Separate JSON failures: `ai_logs` show empty `response` and `Unparseable JSON: Unexpected end of JSON input` — `JSON.parse("")`. We'll dedupe the list in the repo, surface source event on detail, and harden the Gemini connector for empty responses and stringified `output`.]]



Removing duplicate `ai_logs` insert: the empty-response path inserted a log then rethrew, causing the outer catch to insert again.



Making new API fields optional so older IL responses don't break the UI.



[[Inner monologue: Delivered backend dedupe as the real fix for duplicate keys; UI key composite is a safety net. Mongo queries proved 429s were from `generativelanguage.googleapis.com` (old API), not Vertex — user’s switch aligns with that evidence. JSON “issue” was empty response → `JSON.parse("")`, addressed with explicit empty handling and clearer errors. Documented everything in DOCS + session-todo per rules.]]

### Evidence timeline (MongoDB `intelligence`, your machine)

| Time (UTC) | Collection | What the data shows |
|------------|------------|---------------------|
| **2026-04-22 15:46:15** | `pipeline_synthesis` | Row for `event_id` `4efef09b-4a67-4002-a5fa-04a0509ac206`, `status: failed`, error **429** from **`https://generativelanguage.googleapis.com/v1beta/...`** (Gemini API free-tier quota). |
| **2026-04-22 15:50:20** | `pipeline_synthesis` | **Second row** for the **same** `event_id` — again failed 429 to the **same** host. |
| **2026-04-22 16:11:00** | `ai_logs` | `event_id` `a977d117-b542-4673-91bc-94eeadeeaa78`, synthesis: `response` **length 0**, `tokens` **0**, `duration_ms` **21521**, error **`Unparseable JSON: Unexpected end of JSON input`**. |

**Duplicate Next.js keys:** `GET /pipeline` returned **one table row per `pipeline_synthesis` document**, so two failed attempts ⇒ two rows with the **same** `event_id` ⇒ `key={row.event_id}` collided. That matches the UUID in your overlay.

**“JSON” synthesis failures:** For the sampled row, the failure is **`JSON.parse` on an empty string** after an **empty model text** response (not `coerceSynthesis` rejecting a filled object). Stored `ai_logs.response` is empty, not truncated JSON.

**Rate limit:** The stored errors explicitly reference **`generativelanguage.googleapis.com`** and free-tier quota metrics — i.e. **Developer API**, not Vertex. Moving to **Vertex** is consistent with eliminating that class of error if billing/quota there is configured.

---

### What we changed in the repo

1. **`pipeline_synthesis` list** — Aggregation: **latest doc per `event_id`**, then sort/page. **`total`** = **distinct** `event_id` count (see `pipelineSynthesisRepo.ts`).
2. **`GET /pipeline/:event_id`** — Adds **`source_event`** (Data Scout payload) and **`source_event_fetch_error`** when fetch fails (`pipeline.ts`).
3. **Admin UI** — “**Source event (Data Scout)**” card with collapsible raw JSON on the run detail page (`PipelineDetail.tsx`); table keys use **`event_id:processed_at`** as a fallback (`PipelineRunsTable.tsx`).
4. **Gemini connector** — Fail fast on **empty** candidate text with **`finish_reason`** in the message; unwrap stringified **`output`**; don’t call `JSON.parse` on an empty trimmed body (`geminiConnector.ts`).
5. **Docs** — `DOCS/application_design/intelligence-layer.md`, `ui.md`, `DOCS/session-todo/2026-04-22.md` updated.

Restart **intelligence-layer** (and UI) so the new `/pipeline` behavior and `source_event` fields are live.

---

`pnpm --filter intelligence-layer test` and **build** pass. **`pnpm --filter ui build`** still fails on **missing routes** (`/admin/users`, `/api/admin/health`, `/api/admin/logs`) — that’s separate from these edits; typecheck/lint on touched files is clean.

