import type { SynthesisOutput } from "../types.js";

export function buildImpactPrompt(synthesis: SynthesisOutput): string {
  return `You are an impact assessor. Given the following synthesis output, produce a single JSON object.
The root object MUST include a string field "reasoning" and a nested "output" object with:

- severity: "low" | "medium" | "high" | "critical"
- urgency: "low" | "medium" | "high" | "immediate"
- global_effect: "isolated" | "regional" | "global"
- impact_dimensions: { human, economic, infrastructure, geopolitical } each { score: number 0-10, notes: string }
- overall_impact_score: number 0-10
- confidence: { score: number 0-1, factors: string[] }
- source_reliability_adjustment: string

Synthesis output:
${JSON.stringify(synthesis, null, 0)}
`;
}
