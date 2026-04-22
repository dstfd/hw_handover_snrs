# Intelligence Layer — Design Document

## Role in the System

The Intelligence Layer is the processing pipeline. It consumes ingestion signals from the Redis Stream, runs a sequence of AI-driven steps to analyse each event, and emits a notification signal when warranted. It owns all analytical logic — no other component reasons about event content.

---

## Responsibilities

- Consume `events:ingested` messages from the Redis Stream
- Fetch the full event payload from Data Scout using `event_id`
- Run the pipeline: synthesis → impact evaluation → validation → relevance matching
- Persist each step's output to its own MongoDB collection
- Emit a notification signal to Redis Streams when relevance matching produces matched users
- Log all AI calls to a dedicated `ai_logs` collection

---

## Pipeline Overview

```
Redis Stream (events:ingested)
        ↓
  [1] Event Synthesis          → pipeline_synthesis
        ↓
  [2] Impact Evaluation        → pipeline_impact_evaluation
        ↓
  [3] Validation               → pipeline_validation
        ↓ (only if proceed = true)
  [4] Relevance Matching       → pipeline_relevance_matching
        ↓ (only if notification_warranted = true)
  Redis Stream (events:notification_signal)
```

---

## Fail-Fast Policy

All AI steps follow strict fail-fast behaviour:

- If an AI call fails, times out, or returns output that cannot be parsed into the expected schema: the pipeline **stops immediately**
- The step document is written to MongoDB with `status: "failed"` and an `error` field containing the full error detail
- No retry. No fallback. No partial processing passed downstream.
- The failure is loud — error logged, pipeline halted, downstream steps do not run

This is intentional. A silent or degraded result is harder to diagnose than a clean failure.

---

## Pipeline Steps

### Step 1 — Event Synthesis

**Purpose:** Transform the raw event from Data Scout into a structured analytical document. Extract facts, entities, geographic context, temporal framing, and economic dimensions. Assign a confidence score.

**AI:** Yes — `gemini-2.5-pro`, temperature `0.3`

Slightly elevated temperature allows the model to surface implied facts, contextual connections, and sector effects that are not stated verbatim in the raw event — rather than transcribing the news 1:1. The native reasoning capability of Gemini 2.5 Pro is used to populate the `reasoning` field directly from the model's thinking trace.

**Input:** Full event payload fetched from Data Scout API by `event_id`

**MongoDB collection:** `pipeline_synthesis`

**Document schema:**
```json
{
  "_id": "<MongoDB ObjectId>",
  "event_id": "<lineage ID>",
  "source_event_id": "<MagicBall original UUID>",
  "pipeline_version": "1.0",
  "step": "synthesis",
  "processed_at": "<ISO8601>",
  "status": "completed | failed",
  "error": null,
  "ai_log_id": "<reference to ai_logs._id>",

  "output": {
    "headline": "<normalised headline>",
    "category": "breaking_news | market_movement | natural_disaster",
    "event_status": "developing | ongoing | concluded",
    "date": "<ISO8601 — event date>",
    "temporal": {
      "is_developing": true,
      "estimated_duration": "short | medium | extended | unknown"
    },
    "facts": [
      "<discrete factual statement extracted from the event>",
      "<...>"
    ],
    "entities": {
      "people": [],
      "organizations": [],
      "locations": ["<place names mentioned>"],
      "assets": ["<financial assets, infrastructure, commodities>"]
    },
    "geo": {
      "country": "<country name or 'Global'>",
      "region": "<region or null>",
      "scope": "local | regional | global",
      "coordinates": null
    },
    "affected_population": "<integer or null>",
    "economic_dimension": {
      "has_economic_impact": true,
      "impact_usd": "<integer or null>",
      "affected_sectors": ["<sector names>"]
    },
    "casualties": {
      "confirmed": "<integer or null>",
      "estimated": "<integer or null>"
    },
    "tags": ["<keyword>"],
    "provenance": {
      "source_reliability": "unverified | single_source | multi_source | confirmed",
      "named_sources": [],
      "provenance_note": "Generated dataset — no named sources available"
    },
    "confidence": {
      "score": 0.0,
      "reasoning": "<why this confidence score was assigned>"
    }
  },

  "reasoning": "<model's chain of reasoning for this synthesis>"
}
```

---

### Step 2 — Impact Evaluation

**Purpose:** Assess the significance of the event across multiple impact dimensions. Score human, economic, infrastructure, and geopolitical effect. Assign urgency and global reach. Adjust for source reliability.

**AI:** Yes — `gemini-2.5-pro`, temperature `0.2`

Lower than synthesis — scoring and dimension assessment should be grounded and consistent, with enough headroom to reason across ambiguous signals (e.g. unverified source + high estimated casualties). Reasoning field captured from model's thinking trace.

**Input:** `pipeline_synthesis` document for this `event_id`

**MongoDB collection:** `pipeline_impact_evaluation`

**Document schema:**
```json
{
  "_id": "<MongoDB ObjectId>",
  "event_id": "<lineage ID>",
  "pipeline_version": "1.0",
  "step": "impact_evaluation",
  "processed_at": "<ISO8601>",
  "status": "completed | failed",
  "error": null,
  "ai_log_id": "<reference to ai_logs._id>",
  "synthesis_ref": "<pipeline_synthesis._id>",

  "output": {
    "severity": "low | medium | high | critical",
    "urgency": "low | medium | high | immediate",
    "global_effect": "isolated | regional | global",
    "impact_dimensions": {
      "human":          { "score": 0, "notes": "<explanation>" },
      "economic":       { "score": 0, "notes": "<explanation>" },
      "infrastructure": { "score": 0, "notes": "<explanation>" },
      "geopolitical":   { "score": 0, "notes": "<explanation>" }
    },
    "overall_impact_score": 0.0,
    "confidence": {
      "score": 0.0,
      "factors": ["<what influenced the confidence level>"]
    },
    "source_reliability_adjustment": "<explanation of how source_reliability affected scoring>"
  },

  "reasoning": "<model's chain of reasoning for this evaluation>"
}
```

---

### Step 3 — Validation

**Purpose:** Sanity-check the pipeline outputs before any notification is triggered. Validates both the content quality of previous steps and the structural integrity of the lineage chain — every step document must carry the correct `event_id`.

**AI:** Yes — `gemini-2.5-pro`, temperature `0.1`

Near-deterministic. Validation is a correctness check — the model must assess facts against a checklist, not be creative. Low temperature produces consistent, reproducible verdicts. Reasoning field captured from model's thinking trace.

**Input:** `pipeline_synthesis` + `pipeline_impact_evaluation` documents for this `event_id`

**MongoDB collection:** `pipeline_validation`

**Checks performed:**

| Check | Description |
|-------|-------------|
| `lineage_synthesis` | `pipeline_synthesis` document exists and carries the correct `event_id` |
| `lineage_impact_evaluation` | `pipeline_impact_evaluation` document exists and carries the correct `event_id` |
| `lineage_ids_consistent` | `event_id` is identical across all pipeline documents processed so far |
| `synthesis_completeness` | Required output fields are present and non-null where expected |
| `impact_score_consistency` | `overall_impact_score` is consistent with the individual dimension scores |
| `severity_alignment` | Severity assigned in impact evaluation is plausible given synthesis facts and confidence |
| `confidence_threshold_met` | Confidence scores in both synthesis and impact evaluation exceed the minimum threshold |

The `proceed` flag gates the pipeline. If `proceed: false`, relevance matching does not run.

**Document schema:**
```json
{
  "_id": "<MongoDB ObjectId>",
  "event_id": "<lineage ID>",
  "pipeline_version": "1.0",
  "step": "validation",
  "processed_at": "<ISO8601>",
  "status": "completed | failed",
  "error": null,
  "ai_log_id": "<reference to ai_logs._id>",
  "synthesis_ref": "<pipeline_synthesis._id>",
  "impact_evaluation_ref": "<pipeline_impact_evaluation._id>",

  "output": {
    "is_valid": true,
    "proceed": true,
    "checks": [
      { "check": "lineage_synthesis",           "passed": true, "note": "" },
      { "check": "lineage_impact_evaluation",   "passed": true, "note": "" },
      { "check": "lineage_ids_consistent",      "passed": true, "note": "" },
      { "check": "synthesis_completeness",      "passed": true, "note": "" },
      { "check": "impact_score_consistency",    "passed": true, "note": "" },
      { "check": "severity_alignment",          "passed": true, "note": "" },
      { "check": "confidence_threshold_met",    "passed": true, "note": "" }
    ],
    "validation_summary": "<overall assessment>"
  },

  "reasoning": "<model's reasoning about the validity of the pipeline outputs>"
}
```

---

### Step 4 — Relevance Matching

**Purpose:** Determine which users should be notified. Queries the Notification Gateway for users whose severity threshold is met by this event. Deterministic for now — no AI. AI-driven personalisation is a future enhancement.

**AI:** No

**Input:** Impact evaluation severity + Notification Gateway user directory (via HTTP)

**MongoDB collection:** `pipeline_relevance_matching`

**Logic:**
1. Read `severity` and `category` from `pipeline_impact_evaluation` and `pipeline_synthesis` for this `event_id`
2. Call Notification Gateway: `GET /users?min_severity=<severity>&category=<category>` — returns users whose severity threshold is met AND who have opted into this event category
3. Record matched users and their configured channels
4. Set `notification_warranted: true` if at least one user matched

**Document schema:**
```json
{
  "_id": "<MongoDB ObjectId>",
  "event_id": "<lineage ID>",
  "pipeline_version": "1.0",
  "step": "relevance_matching",
  "processed_at": "<ISO8601>",
  "status": "completed | failed",
  "error": null,
  "impact_evaluation_ref": "<pipeline_impact_evaluation._id>",
  "validation_ref": "<pipeline_validation._id>",

  "output": {
    "event_severity": "low | medium | high | critical",
    "matched_users": [
      {
        "user_id": "<string>",
        "channels": ["email", "slack"],
        "severity_threshold": "medium",
        "match_reason": "event severity >= user threshold"
      }
    ],
    "total_matched": 0,
    "notification_warranted": false
  }
}
```

---

## AI Logging

Every AI step writes a document to the `ai_logs` collection before the step document is finalised. The step document then references the AI log via `ai_log_id`.

**Collection:** `ai_logs`

```json
{
  "_id": "<MongoDB ObjectId>",
  "event_id": "<lineage ID>",
  "pipeline_version": "1.0",
  "step": "synthesis | impact_evaluation | validation",
  "called_at": "<ISO8601>",
  "model": "gemini-2.5-pro",
  "temperature": 0.0,
  "max_output_tokens": 0,
  "prompt": "<full prompt text sent to model>",
  "response": "<full response text received>",
  "tokens": {
    "input": 0,
    "output": 0
  },
  "reasoning": "<model's reasoning field, extracted from structured response>",
  "duration_ms": 0,
  "status": "success | failed",
  "error": null
}
```

---

## Redis Stream — Output

When `notification_warranted: true`, the pipeline emits to:

**Stream name:** `events:notification_signal`

**Payload:**
```json
{
  "event_id": "<lineage ID>",
  "relevance_matching_ref": "<pipeline_relevance_matching._id>",
  "emitted_at": "<ISO8601>"
}
```

The Notification Gateway fetches the full matched user list from `pipeline_relevance_matching` using `event_id`.

The emit is recorded in `pipeline_notification_signals`:

**Collection:** `pipeline_notification_signals`

```json
{
  "_id": "<MongoDB ObjectId>",
  "event_id": "<lineage ID>",
  "pipeline_version": "1.0",
  "step": "notification_signal",
  "emitted_at": "<ISO8601>",
  "status": "emitted | failed",
  "error": null,
  "relevance_matching_ref": "<pipeline_relevance_matching._id>",
  "matched_user_count": 0,
  "stream_message_id": "<Redis Stream message ID>"
}
```

---

## MongoDB Collections Summary

| Collection | Owner step | Contains |
|---|---|---|
| `pipeline_synthesis` | Step 1 | Structured event facts, entities, geo, provenance, confidence |
| `pipeline_impact_evaluation` | Step 2 | Severity, urgency, impact scores, confidence |
| `pipeline_validation` | Step 3 | Lineage and quality checks, proceed gate |
| `pipeline_relevance_matching` | Step 4 | Matched users, channels, notification flag |
| `pipeline_notification_signals` | Signal emit | Redis Stream emission record — event_id, matched user count, stream message ID |
| `ai_logs` | Cross-cutting | Full AI call record for every AI step |

---

## Schema Versioning (A/B Testing Readiness)

Every pipeline document carries `pipeline_version`. When A/B testing is introduced via the admin tool:

- Two pipeline runs for the same `event_id` may exist under different `pipeline_version` values
- Comparison queries filter by `pipeline_version` across any collection
- The version string is set at pipeline startup from environment config — all steps in a single run share the same version

> **Decision: `pipeline_version` on every document from day one**
> The A/B testing admin tool is deferred, but the version field is included now so the data is queryable when the tool arrives. Retrofitting version onto a large collection is expensive.

---

## Replayability

Each step reads its input exclusively from MongoDB (or Data Scout API for step 1) — there is no in-memory chaining between steps.

To replay step N for a given `event_id`:
1. Delete (or archive) the existing document for that step in its collection
2. Re-run the step — it fetches its input from the previous step's collection as normal

This means any step can be replayed in isolation without re-ingesting the event or re-running prior steps.

---

## Pipeline Management API

Used by the admin UI to browse, inspect, delete, and replay pipeline runs.

```
GET /pipeline?page=&limit=
```
Lists recent pipeline runs. Returns `event_id`, `processed_at`, `outcome`, `matched_user_count` for each run. Sourced from `pipeline_notification_signals` + `pipeline_relevance_matching`.

```
GET /pipeline/:event_id
```
Returns all step documents for a given `event_id` across all collections, ordered by step sequence. Used to populate the pipeline detail view in the admin UI.

`outcome` values: `notified | skipped | failed | incomplete`. `incomplete` means the pipeline run exists but has not yet reached a terminal state (e.g. a step was deleted for replay and the replay has not run yet). The list endpoint (`GET /pipeline`) maps `incomplete` to `failed`; the detail endpoint exposes the raw value — callers must handle `incomplete`.

```
DELETE /pipeline/:event_id/step/:step
```
Deletes the MongoDB document for the named step (`synthesis`, `impact_evaluation`, `validation`, `relevance_matching`, `notification_signal`). Enables replay of that step.

```
POST /pipeline/:event_id/replay/:step
```
Re-runs the named step for the given `event_id`. The step fetches its input from the previous step's stored document as normal. Fails if the previous step's document does not exist.

**Version constraint:** `pipeline_version` must match the service's current `PIPELINE_VERSION` env var. Replaying a run stored under a different version is rejected — this prevents mixing pipeline configs across versions. Pass `?pipeline_version=<version>` if the default does not match the stored run's version (though cross-version replay will still be rejected).

```
GET /logs?level=&event_id=&page=&limit=
```
Returns normalized log lines for aggregation: each item has `timestamp`, `service: "intelligence-layer"`, `level`, `event_id`, `source: "ai_logs"`, `message` (derived from `ai_logs` documents). Query `level=error` filters MongoDB `status=failed`; `level=info` filters successful AI calls; `warn` / `debug` return empty (not stored on `ai_logs` today). Used by the Notification Gateway's log aggregator.

```
GET /health
```
Returns service status, last pipeline run timestamp, and MongoDB connection state.

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `INTEL_PORT` | Port for the observability API | `4102` |
| `INTEL_MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017` |
| `INTEL_MONGO_DB` | Database name | `intelligence` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `DATASCOUT_BASE_URL` | Data Scout API base URL | `http://localhost:4101` |
| `NOTIFICATION_GW_BASE_URL` | Notification Gateway API base URL — **required for the full pipeline path** (Step 4 calls `GET /users` here; fails fast if unavailable) | `http://localhost:4103` |
| `GEMINI_API_KEY` | Gemini API key | — |
| `GEMINI_MANIFEST_PATH` | Path to the Gemini connector manifest (absolute or **resolved from process `cwd`**) | `./gemini-connector.json` |

**Runtime note (this repo):** the executable copy of the manifest lives at [`apps/intelligence-layer/gemini-connector.json`](../../apps/intelligence-layer/gemini-connector.json) (same content as the design copy under `DOCS/application_design/gemini-connector.json`). Start the service with `cwd` = `apps/intelligence-layer` or set `GEMINI_MANIFEST_PATH` to an absolute path. Cloud and local use the same code; only env/connections differ.

Model, temperatures, token limits, and retry policy are **not configured here** — they are owned by `gemini-connector.json`. See [gemini-connector.md](gemini-connector.md).
| `PIPELINE_VERSION` | Version tag applied to all pipeline documents | `1.0` |
| `MIN_CONFIDENCE_THRESHOLD` | Minimum confidence score to pass validation | `0.5` |

---

## Orchestration — LlamaIndex Workflows

The design uses **LlamaIndex Workflows** (TypeScript) for clarity of step boundaries, typed events, and fail-fast semantics. **In this repository**, the same behaviour is implemented as a **sequential `runIntelligencePipeline`** in `apps/intelligence-layer` (one module per step, all analytical inputs read from MongoDB / Data Scout — no in-memory handoff of facts). A future change could swap the runner for `@llamaindex/workflow` without changing persistence contracts.

Concretely, the architectural model is: each pipeline step is a discrete handler, steps communicate as **typed design events** (see below) — no in-memory analytical state is passed between them beyond the IDs needed to fetch from MongoDB.

### Workflow events

```typescript
class PipelineStartEvent   extends StartEvent   { event_id: string; source_event_id: string; }
class SynthesisCompleted   extends WorkflowEvent { event_id: string; synthesis_id: string; }
class ImpactCompleted      extends WorkflowEvent { event_id: string; impact_id: string; }
class ValidationCompleted  extends WorkflowEvent { event_id: string; validation_id: string; proceed: boolean; }
class RelevanceCompleted   extends WorkflowEvent { event_id: string; relevance_id: string; notification_warranted: boolean; }
class PipelineDone         extends StopEvent     { event_id: string; outcome: "notified" | "skipped" | "failed"; }
```

### State management

LlamaIndex workflow `Context` carries minimal state for a single pipeline run:
- `event_id` — lineage key, available to all steps via context
- `pipeline_version` — version tag for all documents written in this run
- `step_refs` — map of step name → MongoDB `_id`, built up as steps complete

Steps read their analytical input from MongoDB (not from context). Context only carries IDs and run-level metadata.

### Step wiring

```
PipelineStartEvent
  → synthesis()         emits SynthesisCompleted
  → impactEvaluation()  emits ImpactCompleted
  → validation()        emits ValidationCompleted
      if proceed=false  → emits PipelineDone(outcome="skipped")
  → relevanceMatching() emits RelevanceCompleted
      if !warranted     → emits PipelineDone(outcome="skipped")
  → emitSignal()        emits PipelineDone(outcome="notified")
```

### Fail-fast in the workflow

If any step throws, LlamaIndex catches at the workflow level. The step writes its own `status: "failed"` document to MongoDB before throwing — so the failure is recorded regardless. The workflow emits `PipelineDone(outcome="failed")` and halts.

---

## Deferred

- AI-driven relevance matching (personalisation beyond severity threshold)
- Retry / dead-letter queue for failed pipeline runs
- A/B testing tooling (admin tool — not yet designed)
