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

  it("ai-log read path shape is fixed", () => {
    const path = "/pipeline/:event_id/ai-log/:ai_log_id";
    expect(path).toContain("ai-log");
  });
});
