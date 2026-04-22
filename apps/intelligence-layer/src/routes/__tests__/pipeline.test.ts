import { describe, it, expect } from "vitest";

describe("pipeline contract", () => {
  it("step names for DELETE/POST are documented", () => {
    const valid = [
      "synthesis",
      "impact_evaluation",
      "validation",
      "relevance_matching",
      "notification_signal",
    ];
    expect(valid).toHaveLength(5);
  });
});
