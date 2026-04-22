import { describe, it, expect } from "vitest";
import { coerceSynthesis, coerceImpact, coerceValidation } from "../coerce.js";

const validSynthesisOutput = {
  headline: "Test event",
  category: "natural_disaster",
  event_status: "ongoing",
  date: "2026-04-20T09:35:00Z",
  temporal: { is_developing: false, estimated_duration: "medium" },
  facts: ["Fact one"],
  entities: { people: [], organizations: [], locations: ["Mozambique"], assets: [] },
  geo: { country: "Mozambique", region: "Sofala", scope: "regional", coordinates: null },
  affected_population: 190000,
  economic_dimension: { has_economic_impact: true, impact_usd: 54000000, affected_sectors: ["Fishing"] },
  casualties: { confirmed: 3, estimated: 12 },
  tags: ["storm"],
  provenance: { source_reliability: "confirmed", named_sources: [], provenance_note: "p" },
  confidence: { score: 0.9, reasoning: "high confidence" },
};

const validImpactOutput = {
  severity: "high",
  urgency: "immediate",
  global_effect: "regional",
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

describe("coerceValidation", () => {
  it("parses valid root", () => {
    const r = coerceValidation({
      reasoning: "ok",
      output: {
        is_valid: true,
        proceed: true,
        checks: [{ check: "lineage_synthesis", passed: true, note: "" }],
        validation_summary: "all clear",
      },
    });
    expect(r.output.proceed).toBe(true);
  });

  it("throws on missing reasoning", () => {
    expect(() =>
      coerceValidation({
        output: { is_valid: true, proceed: true, checks: [{ check: "a", passed: true, note: "" }], validation_summary: "x" },
      })
    ).toThrow();
  });

  it("throws on empty checks array", () => {
    expect(() =>
      coerceValidation({ reasoning: "r", output: { is_valid: true, proceed: true, checks: [], validation_summary: "x" } })
    ).toThrow();
  });

  it("throws on empty reasoning string", () => {
    expect(() =>
      coerceValidation({
        reasoning: "",
        output: { is_valid: true, proceed: true, checks: [{ check: "a", passed: true, note: "" }], validation_summary: "x" },
      })
    ).toThrow();
  });
});

describe("coerceSynthesis", () => {
  it("parses valid synthesis", () => {
    const r = coerceSynthesis({ reasoning: "r", output: validSynthesisOutput });
    expect(r.output.category).toBe("natural_disaster");
    expect(r.output.confidence.score).toBe(0.9);
  });

  it("throws on invalid category enum", () => {
    expect(() =>
      coerceSynthesis({ reasoning: "r", output: { ...validSynthesisOutput, category: "INVALID_CATEGORY" } })
    ).toThrow();
  });

  it("throws when confidence.score exceeds 1", () => {
    expect(() =>
      coerceSynthesis({
        reasoning: "r",
        output: { ...validSynthesisOutput, confidence: { score: 1.5, reasoning: "r" } },
      })
    ).toThrow();
  });

  it("throws on invalid geo scope", () => {
    expect(() =>
      coerceSynthesis({
        reasoning: "r",
        output: { ...validSynthesisOutput, geo: { ...validSynthesisOutput.geo, scope: "national" } },
      })
    ).toThrow();
  });

  it("throws on invalid source_reliability", () => {
    expect(() =>
      coerceSynthesis({
        reasoning: "r",
        output: {
          ...validSynthesisOutput,
          provenance: { ...validSynthesisOutput.provenance, source_reliability: "trusted" },
        },
      })
    ).toThrow();
  });
});

describe("coerceImpact", () => {
  it("parses valid impact", () => {
    const r = coerceImpact({ reasoning: "r", output: validImpactOutput });
    expect(r.output.severity).toBe("high");
  });

  it("throws on invalid severity enum", () => {
    expect(() =>
      coerceImpact({ reasoning: "r", output: { ...validImpactOutput, severity: "very_high" } })
    ).toThrow();
  });

  it("throws when overall_impact_score exceeds 10", () => {
    expect(() =>
      coerceImpact({ reasoning: "r", output: { ...validImpactOutput, overall_impact_score: 10.1 } })
    ).toThrow();
  });

  it("throws when impact dimension score is negative", () => {
    expect(() =>
      coerceImpact({
        reasoning: "r",
        output: {
          ...validImpactOutput,
          impact_dimensions: { ...validImpactOutput.impact_dimensions, human: { score: -1, notes: "" } },
        },
      })
    ).toThrow();
  });

  it("throws on invalid urgency enum", () => {
    expect(() =>
      coerceImpact({ reasoning: "r", output: { ...validImpactOutput, urgency: "critical" } })
    ).toThrow();
  });
});
