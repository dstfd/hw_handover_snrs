import {
  GeminiSynthesisResponseSchema,
  GeminiImpactResponseSchema,
  GeminiValidationResponseSchema,
} from "../schemas.js";
import type { ImpactOutput, SynthesisOutput, ValidationOutput } from "../types.js";

export function coerceSynthesis(root: unknown): { output: SynthesisOutput; reasoning: string } {
  return GeminiSynthesisResponseSchema.parse(root);
}

export function coerceImpact(root: unknown): { output: ImpactOutput; reasoning: string } {
  return GeminiImpactResponseSchema.parse(root);
}

export function coerceValidation(root: unknown): { output: ValidationOutput; reasoning: string } {
  return GeminiValidationResponseSchema.parse(root);
}
