# Gemini Connector — Design Document

## Role in the System

The Gemini Connector is the single shared wrapper around all Gemini API calls made by the Intelligence Layer. It is the only place in the codebase that knows about Gemini — individual pipeline steps call the connector, not the Gemini SDK directly.

It owns: loading the manifest, constructing calls with the correct parameters, capturing the reasoning field, logging to `ai_logs`, and failing loudly on any error.

---

## Single Source of Truth

All Gemini call configuration lives in one file:

```
gemini-connector.json
```

No pipeline step defines its own model, temperature, or token limit. Steps reference their step key (`synthesis`, `impact_evaluation`, `validation`) and the connector resolves the correct config from the manifest. This means:

- Tuning a temperature → edit one file, all steps pick it up
- Swapping the model → one field change, applied everywhere
- A/B testing prompt variants → version the manifest, not the step code

---

## Manifest Structure

```json
{
  "model": "gemini-2.5-pro",

  "common": {
    "response_mime_type": "application/json",
    "timeout_ms": 30000,
    "reasoning_field": "reasoning"
  },

  "steps": {
    "synthesis": {
      "temperature": 0.3,
      "max_output_tokens": 2048,
      "reasoning_required": true
    },
    "impact_evaluation": {
      "temperature": 0.2,
      "max_output_tokens": 1024,
      "reasoning_required": true
    },
    "validation": {
      "temperature": 0.1,
      "max_output_tokens": 1024,
      "reasoning_required": true
    }
  },

  "retry_policy": {
    "enabled": false,
    "note": "Fail fast — no retries. Failed calls are logged and the pipeline halts."
  }
}
```

### Temperature rationale

| Step | Temperature | Rationale |
|---|---|---|
| `synthesis` | `0.3` | Surface implied facts and context beyond verbatim news — some interpretive latitude required |
| `impact_evaluation` | `0.2` | Scoring must be grounded; headroom for reasoning across ambiguous signals |
| `validation` | `0.1` | Checklist correctness — near-deterministic, no creativity needed |

---

## Connector Behaviour

### Call interface

Each pipeline step calls the connector with:
- `step` — the step key (must exist in manifest)
- `prompt` — the full prompt string
- `event_id` — for AI log linkage
- `pipeline_version` — carried through from pipeline run config

The connector returns:
- Parsed JSON response body
- Extracted `reasoning` field
- The `ai_log_id` of the written log document (for the step to store as a reference)

### Reasoning field

Gemini 2.5 Pro exposes a native thinking/reasoning trace. The connector extracts this directly from the model response and writes it as the `reasoning` field in `ai_logs`. Prompts for all steps explicitly instruct the model to also include a `reasoning` field in the JSON response body — this is the human-readable rationale captured in each pipeline step document.

### Failure handling

If the Gemini call fails for any reason (network error, timeout, API error, unparseable response, missing required fields including `reasoning`):

1. Write a failed entry to `ai_logs` with the error detail
2. Throw — do not catch downstream
3. The calling pipeline step catches the throw, marks its own document `status: "failed"`, and halts the pipeline

No retry. No fallback. The failure must be visible and fixable.

### AI log entry written by the connector

```json
{
  "_id": "<MongoDB ObjectId>",
  "event_id": "<lineage ID>",
  "pipeline_version": "1.0",
  "step": "synthesis | impact_evaluation | validation",
  "called_at": "<ISO8601>",
  "model": "gemini-2.5-pro",
  "temperature": 0.3,
  "max_output_tokens": 2048,
  "prompt": "<full prompt text>",
  "response": "<full raw response text>",
  "tokens": {
    "input": 0,
    "output": 0
  },
  "reasoning": "<extracted from model thinking trace>",
  "duration_ms": 0,
  "status": "success | failed",
  "error": null
}
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `GEMINI_API_KEY` | Gemini API key | — |
| `GEMINI_MANIFEST_PATH` | Path to `gemini-connector.json` | `./gemini-connector.json` |

The manifest is loaded once at connector initialisation. The model and all step configs are read from the file — not from environment variables — so the manifest is the authoritative source and env vars do not override it.

---

## Versioning Note

When the A/B testing tool arrives, the manifest becomes version-controlled alongside pipeline code. Two concurrent pipeline versions may load different manifests (e.g. different temperatures or prompts) — the `pipeline_version` field on every AI log and pipeline document ties the result back to the exact manifest used.
