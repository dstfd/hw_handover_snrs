import { describe, it, expect } from "vitest";
import { coerceValidation } from "../coerce.js";

describe("coerceValidation", () => {
  it("parses valid validation root", () => {
    const r = coerceValidation({
      reasoning: "ok",
      output: {
        is_valid: true,
        proceed: true,
        checks: [{ check: "a", passed: true, note: "" }],
        validation_summary: "s",
      },
    });
    expect(r.output.proceed).toBe(true);
  });
});
