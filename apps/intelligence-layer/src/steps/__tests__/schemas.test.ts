import { describe, it, expect } from "vitest";
import {
  SynthesisOutputSchema,
  ImpactOutputSchema,
  ValidationOutputSchema,
  GeminiSynthesisResponseSchema,
} from "../../schemas.js";

const validSynthesisOutput = {
  headline: "Test event",
  category: "natural_disaster" as const,
  event_status: "ongoing" as const,
  date: "2026-04-20T09:35:00Z",
  temporal: { is_developing: false, estimated_duration: "medium" as const },
  facts: ["Fact one"],
  entities: { people: [], organizations: [], locations: ["Mozambique"], assets: [] },
  geo: { country: "Mozambique", region: "Sofala", scope: "regional" as const, coordinates: null },
  affected_population: 190000,
  economic_dimension: { has_economic_impact: true, impact_usd: 54000000, affected_sectors: ["Fishing"] },
  casualties: { confirmed: 3, estimated: 12 },
  tags: ["storm"],
  provenance: { source_reliability: "confirmed" as const, named_sources: [], provenance_note: "p" },
  confidence: { score: 0.9, reasoning: "high confidence" },
};

const validImpactOutput = {
  severity: "high" as const,
  urgency: "immediate" as const,
  global_effect: "regional" as const,
  impact_dimensions: {
    human: { score: 7, notes: "ok" },
    economic: { score: 6, notes: "ok" },
    infrastructure: { score: 8, notes: "ok" },
    geopolitical: { score: 1, notes: "ok" },
  },
  overall_impact_score: 7,
  confidence: { score: 0.9, factors: ["confirmed source"] },
  source_reliability_adjustment: "none",
};

describe("SynthesisOutputSchema", () => {
  it("accepts valid output", () => {
    expect(() => SynthesisOutputSchema.parse(validSynthesisOutput)).not.toThrow();
  });

  it("rejects unknown category", () => {
    expect(() => SynthesisOutputSchema.parse({ ...validSynthesisOutput, category: "earthquake" })).toThrow();
  });

  it("rejects unknown event_status", () => {
    expect(() => SynthesisOutputSchema.parse({ ...validSynthesisOutput, event_status: "resolved" })).toThrow();
  });

  it("rejects unknown estimated_duration", () => {
    expect(() =>
      SynthesisOutputSchema.parse({
        ...validSynthesisOutput,
        temporal: { is_developing: false, estimated_duration: "long" },
      })
    ).toThrow();
  });

  it("rejects confidence score below 0", () => {
    expect(() =>
      SynthesisOutputSchema.parse({ ...validSynthesisOutput, confidence: { score: -0.1, reasoning: "r" } })
    ).toThrow();
  });

  it("rejects confidence score above 1", () => {
    expect(() =>
      SynthesisOutputSchema.parse({ ...validSynthesisOutput, confidence: { score: 1.1, reasoning: "r" } })
    ).toThrow();
  });

  it("rejects invalid geo scope", () => {
    expect(() =>
      SynthesisOutputSchema.parse({ ...validSynthesisOutput, geo: { ...validSynthesisOutput.geo, scope: "national" } })
    ).toThrow();
  });

  it("rejects invalid source_reliability", () => {
    expect(() =>
      SynthesisOutputSchema.parse({
        ...validSynthesisOutput,
        provenance: { ...validSynthesisOutput.provenance, source_reliability: "trusted" },
      })
    ).toThrow();
  });

  it("rejects negative affected_population", () => {
    expect(() =>
      SynthesisOutputSchema.parse({ ...validSynthesisOutput, affected_population: -1 })
    ).toThrow();
  });

  it("accepts null affected_population", () => {
    expect(() =>
      SynthesisOutputSchema.parse({ ...validSynthesisOutput, affected_population: null })
    ).not.toThrow();
  });
});

describe("ImpactOutputSchema", () => {
  it("accepts valid output", () => {
    expect(() => ImpactOutputSchema.parse(validImpactOutput)).not.toThrow();
  });

  it("rejects invalid severity", () => {
    expect(() => ImpactOutputSchema.parse({ ...validImpactOutput, severity: "very_high" })).toThrow();
  });

  it("rejects invalid urgency", () => {
    expect(() => ImpactOutputSchema.parse({ ...validImpactOutput, urgency: "critical" })).toThrow();
  });

  it("rejects invalid global_effect", () => {
    expect(() => ImpactOutputSchema.parse({ ...validImpactOutput, global_effect: "national" })).toThrow();
  });

  it("rejects overall_impact_score above 10", () => {
    expect(() => ImpactOutputSchema.parse({ ...validImpactOutput, overall_impact_score: 10.1 })).toThrow();
  });

  it("rejects overall_impact_score below 0", () => {
    expect(() => ImpactOutputSchema.parse({ ...validImpactOutput, overall_impact_score: -1 })).toThrow();
  });

  it("rejects dimension score above 10", () => {
    expect(() =>
      ImpactOutputSchema.parse({
        ...validImpactOutput,
        impact_dimensions: { ...validImpactOutput.impact_dimensions, infrastructure: { score: 11, notes: "" } },
      })
    ).toThrow();
  });

  it("rejects confidence score above 1", () => {
    expect(() =>
      ImpactOutputSchema.parse({ ...validImpactOutput, confidence: { score: 1.5, factors: [] } })
    ).toThrow();
  });
});

describe("ValidationOutputSchema", () => {
  it("accepts valid output", () => {
    expect(() =>
      ValidationOutputSchema.parse({
        is_valid: true,
        proceed: true,
        checks: [{ check: "lineage_synthesis", passed: true, note: "" }],
        validation_summary: "all passed",
      })
    ).not.toThrow();
  });

  it("requires at least one check", () => {
    expect(() =>
      ValidationOutputSchema.parse({ is_valid: true, proceed: true, checks: [], validation_summary: "ok" })
    ).toThrow();
  });

  it("rejects empty validation_summary", () => {
    expect(() =>
      ValidationOutputSchema.parse({
        is_valid: true,
        proceed: true,
        checks: [{ check: "a", passed: true, note: "" }],
        validation_summary: "",
      })
    ).toThrow();
  });
});

describe("GeminiSynthesisResponseSchema", () => {
  it("requires non-empty reasoning", () => {
    expect(() =>
      GeminiSynthesisResponseSchema.parse({ reasoning: "", output: validSynthesisOutput })
    ).toThrow();
  });

  it("accepts valid full response", () => {
    expect(() =>
      GeminiSynthesisResponseSchema.parse({ reasoning: "model reasoning here", output: validSynthesisOutput })
    ).not.toThrow();
  });
});
