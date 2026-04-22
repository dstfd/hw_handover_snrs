import { z } from "zod";

export const SynthesisOutputSchema = z.object({
  headline: z.string().min(1),
  category: z.enum(["breaking_news", "market_movement", "natural_disaster"]),
  event_status: z.enum(["developing", "ongoing", "concluded"]),
  date: z.string().min(1),
  temporal: z.object({
    is_developing: z.boolean(),
    estimated_duration: z.enum(["short", "medium", "extended", "unknown"]),
  }),
  facts: z.array(z.string()),
  entities: z.object({
    people: z.array(z.string()),
    organizations: z.array(z.string()),
    locations: z.array(z.string()),
    assets: z.array(z.string()),
  }),
  geo: z.object({
    country: z.string().min(1),
    region: z.string().nullable(),
    scope: z.enum(["local", "regional", "global"]),
    coordinates: z.null(),
  }),
  affected_population: z.number().int().nonnegative().nullable(),
  economic_dimension: z.object({
    has_economic_impact: z.boolean(),
    impact_usd: z.number().nonnegative().nullable(),
    affected_sectors: z.array(z.string()),
  }),
  casualties: z.object({
    confirmed: z.number().int().nonnegative().nullable(),
    estimated: z.number().int().nonnegative().nullable(),
  }),
  tags: z.array(z.string()),
  provenance: z.object({
    source_reliability: z.enum(["unverified", "single_source", "multi_source", "confirmed"]),
    named_sources: z.array(z.string()),
    provenance_note: z.string(),
  }),
  confidence: z.object({
    score: z.number().min(0).max(1),
    reasoning: z.string().min(1),
  }),
});

export const ImpactOutputSchema = z.object({
  severity: z.enum(["low", "medium", "high", "critical"]),
  urgency: z.enum(["low", "medium", "high", "immediate"]),
  global_effect: z.enum(["isolated", "regional", "global"]),
  impact_dimensions: z.object({
    human: z.object({ score: z.number().min(0).max(10), notes: z.string() }),
    economic: z.object({ score: z.number().min(0).max(10), notes: z.string() }),
    infrastructure: z.object({ score: z.number().min(0).max(10), notes: z.string() }),
    geopolitical: z.object({ score: z.number().min(0).max(10), notes: z.string() }),
  }),
  overall_impact_score: z.number().min(0).max(10),
  confidence: z.object({
    score: z.number().min(0).max(1),
    factors: z.array(z.string()),
  }),
  source_reliability_adjustment: z.string(),
});

export const ValidationCheckSchema = z.object({
  check: z.string().min(1),
  passed: z.boolean(),
  note: z.string(),
});

export const ValidationOutputSchema = z.object({
  is_valid: z.boolean(),
  proceed: z.boolean(),
  checks: z.array(ValidationCheckSchema).min(1),
  validation_summary: z.string().min(1),
});

export const GeminiSynthesisResponseSchema = z.object({
  reasoning: z.string().min(1),
  output: SynthesisOutputSchema,
});

export const GeminiImpactResponseSchema = z.object({
  reasoning: z.string().min(1),
  output: ImpactOutputSchema,
});

export const GeminiValidationResponseSchema = z.object({
  reasoning: z.string().min(1),
  output: ValidationOutputSchema,
});
