import { describe, expect, it } from "vitest";
import { VertexAI } from "@google-cloud/vertexai";

/**
 * Opt-in e2e: calls the live Vertex Generative API (not mocked).
 * Requires Application Default Credentials (e.g. `gcloud auth application-default login`
 * or `GOOGLE_APPLICATION_CREDENTIALS`) and `GCP_PROJECT_ID` in the environment.
 *
 * Run: `GCP_PROJECT_ID=... pnpm test:vertex-e2e` from `apps/intelligence-layer`
 * (script sets `VERTEX_E2E=1`; requires ADC or `GOOGLE_APPLICATION_CREDENTIALS`).
 */
const runE2E = process.env["VERTEX_E2E"] === "1";
const gcpProjectId = process.env["GCP_PROJECT_ID"]?.trim() ?? "";
const gcpLocation = process.env["GCP_LOCATION"]?.trim() || "us-central1";

describe.skipIf(!runE2E)("Vertex AI e2e (live)", () => {
  it(
    "returns model text for a minimal prompt",
    async () => {
      if (gcpProjectId === "") {
        throw new Error(
          "VERTEX_E2E=1 requires GCP_PROJECT_ID (and ADC or GOOGLE_APPLICATION_CREDENTIALS)"
        );
      }
      const vertex = new VertexAI({
        project: gcpProjectId,
        location: gcpLocation,
      });
      const model = vertex.getGenerativeModel({
        model: "gemini-2.5-pro",
      });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: "Reply with the single word: ok" }] }],
        generationConfig: {
          temperature: 0.3,
          /** Pro models may use internal “thinking” tokens; keep headroom so text appears before MAX_TOKENS. */
          maxOutputTokens: 512,
          responseMimeType: "text/plain",
        },
      });
      const raw = result.response;
      if (!raw.candidates?.length) {
        throw new Error(
          `No candidates. promptFeedback=${JSON.stringify(raw.promptFeedback)}`
        );
      }
      const first = raw.candidates[0];
      const parts = first?.content?.parts ?? [];
      const text = parts
        .map((p) => (p && "text" in p && typeof p.text === "string" ? p.text : ""))
        .join("");
      if (text.trim().length === 0) {
        const fr = first?.finishReason ?? "unknown";
        const fm = first?.finishMessage ?? "";
        throw new Error(
          `Empty model text (finish=${String(fr)} ${fm}). ` +
            `First candidate: ${JSON.stringify(first).slice(0, 1500)}`
        );
      }
      expect(text.length).toBeGreaterThan(0);
    },
    120_000
  );
});
