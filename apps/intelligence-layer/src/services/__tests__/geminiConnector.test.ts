import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { loadManifest } from "../geminiConnector.js";

const dir = fileURLToPath(new URL(".", import.meta.url));

describe("loadManifest", () => {
  it("loads app gemini-connector.json", async () => {
    const p = join(dir, "..", "..", "..", "gemini-connector.json");
    const m = await loadManifest(p);
    expect(m.model).toBeTruthy();
    expect(m.steps.synthesis).toBeDefined();
  });
});
