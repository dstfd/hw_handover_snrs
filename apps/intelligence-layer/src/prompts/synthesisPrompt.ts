import type { DataScoutEventPayload } from "../types.js";

export function buildSynthesisPrompt(raw: DataScoutEventPayload): string {
  return `You are an event analysis system. Convert the following ingested world event (from Data Scout) into a single JSON object.
The root object MUST include a string field "reasoning" (your step rationale, auditable) and a nested object "output" containing ALL fields in the schema below.
Use the exact enum strings and types shown. "date" and temporal fields: use ISO 8601 where applicable. Numbers where noted.

Schema for "output" (all required at top level of output):
- headline: string (normalised)
- category: "breaking_news" | "market_movement" | "natural_disaster"
- event_status: "developing" | "ongoing" | "concluded"
- date: string ISO 8601
- temporal: { is_developing: boolean, estimated_duration: "short" | "medium" | "extended" | "unknown" }
- facts: string[] (discrete statements)
- entities: { people: string[], organizations: string[], locations: string[], assets: string[] }
- geo: { country: string, region: string | null, scope: "local" | "regional" | "global", coordinates: null }
- affected_population: number | null
- economic_dimension: { has_economic_impact: boolean, impact_usd: number | null, affected_sectors: string[] }
- casualties: { confirmed: number | null, estimated: number | null }
- tags: string[]
- provenance: { source_reliability: "unverified" | "single_source" | "multi_source" | "confirmed", named_sources: string[], provenance_note: string }
- confidence: { score: number 0-1, reasoning: string }

Raw event JSON:
${JSON.stringify(raw, null, 0)}
`;
}
