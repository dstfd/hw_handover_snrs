import type { ImpactOutput, SynthesisOutput } from "../types.js";

export function buildValidationPrompt(
  synthesis: SynthesisOutput,
  impact: ImpactOutput,
  min_confidence: number
): string {
  return `You are a strict validator. You must verify lineage and plausibility of pipeline outputs.
Return a single JSON object with a string "reasoning" and nested "output":
- is_valid: boolean
- proceed: boolean (if false, notifications must not be sent)
- checks: array of { check: string, passed: boolean, note: string } for these checks in order:
  - lineage_synthesis
  - lineage_impact_evaluation
  - lineage_ids_consistent
  - synthesis_completeness
  - impact_score_consistency
  - severity_alignment
  - confidence_threshold_met (synthesis and impact confidence must be >= ${min_confidence} for this to pass)
- validation_summary: string

Synthesis (contains facts and category):
${JSON.stringify(synthesis, null, 0)}

Impact:
${JSON.stringify(impact, null, 0)}

Set proceed=true only if all checks pass and the event should continue toward notifications.
`;
}
