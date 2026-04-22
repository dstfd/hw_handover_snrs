import type {
  ImpactOutput,
  SynthesisOutput,
  ValidationOutput,
} from "../types.js";

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isStr(v: unknown): v is string {
  return typeof v === "string";
}

function isStrOrNull(v: unknown): v is string | null {
  return v === null || typeof v === "string";
}

export function coerceSynthesis(
  root: unknown
): { output: SynthesisOutput; reasoning: string } {
  if (!root || typeof root !== "object") throw new Error("Synthesis: invalid root");
  const o = root as Record<string, unknown>;
  if (!isStr(o["reasoning"]) || o["reasoning"].trim() === "")
    throw new Error("Synthesis: missing reasoning");
  const out = o["output"];
  if (!out || typeof out !== "object")
    throw new Error("Synthesis: missing output");
  const u = out as Record<string, unknown>;
  if (!isStr(u["headline"])) throw new Error("Synthesis: output.headline");
  if (!isStr(u["category"])) throw new Error("Synthesis: output.category");
  return {
    reasoning: o["reasoning"] as string,
    output: u as unknown as SynthesisOutput,
  };
}

export function coerceImpact(
  root: unknown
): { output: ImpactOutput; reasoning: string } {
  if (!root || typeof root !== "object") throw new Error("Impact: invalid root");
  const o = root as Record<string, unknown>;
  if (!isStr(o["reasoning"]) || o["reasoning"].trim() === "")
    throw new Error("Impact: missing reasoning");
  const out = o["output"];
  if (!out || typeof out !== "object")
    throw new Error("Impact: missing output");
  const u = out as Record<string, unknown>;
  if (!isStr(u["severity"])) throw new Error("Impact: output.severity");
  if (!isNum(u["overall_impact_score"]))
    throw new Error("Impact: output.overall_impact_score");
  return {
    reasoning: o["reasoning"] as string,
    output: u as unknown as ImpactOutput,
  };
}

export function coerceValidation(
  root: unknown
): { output: ValidationOutput; reasoning: string } {
  if (!root || typeof root !== "object")
    throw new Error("Validation: invalid root");
  const o = root as Record<string, unknown>;
  if (!isStr(o["reasoning"]) || o["reasoning"].trim() === "")
    throw new Error("Validation: missing reasoning");
  const out = o["output"];
  if (!out || typeof out !== "object")
    throw new Error("Validation: missing output");
  const u = out as Record<string, unknown>;
  if (typeof u["proceed"] !== "boolean")
    throw new Error("Validation: output.proceed");
  if (typeof u["is_valid"] !== "boolean")
    throw new Error("Validation: output.is_valid");
  if (!Array.isArray(u["checks"]))
    throw new Error("Validation: output.checks");
  if (!isStr(u["validation_summary"]))
    throw new Error("Validation: output.validation_summary");
  return {
    reasoning: o["reasoning"] as string,
    output: u as unknown as ValidationOutput,
  };
}

export { isStr, isStrOrNull, isNum };
