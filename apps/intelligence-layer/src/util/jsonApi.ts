import { ObjectId } from "mongodb";

export function toJsonApiValue(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (v instanceof ObjectId) return v.toHexString();
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map((x) => toJsonApiValue(x));
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o)) {
      out[k] = toJsonApiValue(o[k]);
    }
    return out;
  }
  return v;
}
