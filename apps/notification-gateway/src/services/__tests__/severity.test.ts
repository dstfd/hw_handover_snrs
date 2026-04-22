import { describe, expect, it } from "vitest";
import { userMatchesEventSeverity } from "../severity.js";

describe("userMatchesEventSeverity", () => {
  it("includes low-threshold user for high event", () => {
    expect(userMatchesEventSeverity("low", "high")).toBe(true);
  });
  it("excludes critical-only user for high event", () => {
    expect(userMatchesEventSeverity("critical", "high")).toBe(false);
  });
});
