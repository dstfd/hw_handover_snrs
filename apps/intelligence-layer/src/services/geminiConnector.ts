import { readFile } from "node:fs/promises";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Collection, ObjectId } from "mongodb";
import type { AiLogDoc, GeminiManifest } from "../types.js";
import { insertAiLog } from "../repositories/aiLogsRepo.js";

export type GeminiStepKey = "synthesis" | "impact_evaluation" | "validation";

function stripJsonFences(text: string): string {
  const t = text.trim();
  if (t.startsWith("```")) {
    const without = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    return without.trim();
  }
  return t;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const to = setTimeout(
      () => reject(new Error(`${label}: timeout after ${ms}ms`)),
      ms
    );
    p.then(
      (v) => {
        clearTimeout(to);
        resolve(v);
      },
      (e) => {
        clearTimeout(to);
        reject(e);
      }
    );
  });
}

export async function loadManifest(path: string): Promise<GeminiManifest> {
  const raw = await readFile(path, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("gemini-connector.json: invalid root");
  }
  return parsed as GeminiManifest;
}

export type GeminiCallResult = {
  parsed: unknown;
  reasoning: string;
  aiLogId: ObjectId;
  rawText: string;
};

export function createGeminiConnector(deps: {
  manifest: GeminiManifest;
  apiKey: string;
  aiLogs: Collection<AiLogDoc>;
}): {
  call: (args: {
    step: GeminiStepKey;
    prompt: string;
    event_id: string;
    pipeline_version: string;
  }) => Promise<GeminiCallResult>;
} {
  const { manifest, apiKey, aiLogs } = deps;
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: manifest.model });

  async function call(args: {
    step: GeminiStepKey;
    prompt: string;
    event_id: string;
    pipeline_version: string;
  }): Promise<GeminiCallResult> {
    const stepCfg = manifest.steps[args.step];
    if (!stepCfg) {
      throw new Error(`Unknown step key in manifest: ${args.step}`);
    }
    if (manifest.retry_policy.enabled) {
      throw new Error("Manifest retry_policy.enabled must be false (fail-fast)");
    }

    const called_at = new Date().toISOString();
    const timeoutMs = manifest.common.timeout_ms;
    const start = Date.now();

    let rawText = "";
    let duration_ms = 0;
    let tokens = { input: 0, output: 0 };

    try {
      const gen = model.generateContent({
        contents: [{ role: "user", parts: [{ text: args.prompt }] }],
        generationConfig: {
          temperature: stepCfg.temperature,
          maxOutputTokens: stepCfg.max_output_tokens,
          responseMimeType: manifest.common.response_mime_type,
        },
      });
      const result = await withTimeout(gen, timeoutMs, "gemini");
      const response = result.response;
      rawText = response.text();
      duration_ms = Date.now() - start;
      const u = response.usageMetadata;
      if (u) {
        tokens = {
          input: u.promptTokenCount ?? 0,
          output: u.candidatesTokenCount ?? 0,
        };
      }
    } catch (err) {
      duration_ms = Date.now() - start;
      const errText = err instanceof Error ? err.message : String(err);
      const failDoc: Omit<AiLogDoc, "_id"> = {
        event_id: args.event_id,
        pipeline_version: args.pipeline_version,
        step: args.step,
        called_at,
        model: manifest.model,
        temperature: stepCfg.temperature,
        max_output_tokens: stepCfg.max_output_tokens,
        prompt: args.prompt,
        response: "",
        tokens: { input: 0, output: 0 },
        reasoning: "",
        duration_ms,
        status: "failed",
        error: errText,
      };
      await insertAiLog(aiLogs, failDoc);
      throw err;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFences(rawText)) as unknown;
    } catch (e) {
      const errText = `Unparseable JSON: ${e instanceof Error ? e.message : String(e)}`;
      const failDoc: Omit<AiLogDoc, "_id"> = {
        event_id: args.event_id,
        pipeline_version: args.pipeline_version,
        step: args.step,
        called_at,
        model: manifest.model,
        temperature: stepCfg.temperature,
        max_output_tokens: stepCfg.max_output_tokens,
        prompt: args.prompt,
        response: rawText,
        tokens,
        reasoning: "",
        duration_ms,
        status: "failed",
        error: errText,
      };
      const id = await insertAiLog(aiLogs, failDoc);
      const err = new Error(errText);
      (err as Error & { aiLogId?: ObjectId }).aiLogId = id;
      throw err;
    }

    if (!parsed || typeof parsed !== "object") {
      const errText = "Model JSON root must be an object";
      const failDoc: Omit<AiLogDoc, "_id"> = {
        event_id: args.event_id,
        pipeline_version: args.pipeline_version,
        step: args.step,
        called_at,
        model: manifest.model,
        temperature: stepCfg.temperature,
        max_output_tokens: stepCfg.max_output_tokens,
        prompt: args.prompt,
        response: rawText,
        tokens,
        reasoning: "",
        duration_ms,
        status: "failed",
        error: errText,
      };
      await insertAiLog(aiLogs, failDoc);
      throw new Error(errText);
    }

    const reasoningField = manifest.common.reasoning_field;
    const o = parsed as Record<string, unknown>;
    const reasoningRaw = o[reasoningField];
    if (typeof reasoningRaw !== "string" || reasoningRaw.trim() === "") {
      const errText = `Missing or invalid "${reasoningField}" in model JSON`;
      const failDoc: Omit<AiLogDoc, "_id"> = {
        event_id: args.event_id,
        pipeline_version: args.pipeline_version,
        step: args.step,
        called_at,
        model: manifest.model,
        temperature: stepCfg.temperature,
        max_output_tokens: stepCfg.max_output_tokens,
        prompt: args.prompt,
        response: rawText,
        tokens,
        reasoning: "",
        duration_ms,
        status: "failed",
        error: errText,
      };
      await insertAiLog(aiLogs, failDoc);
      throw new Error(errText);
    }
    const reasoning = reasoningRaw.trim();

    const successDoc: Omit<AiLogDoc, "_id"> = {
      event_id: args.event_id,
      pipeline_version: args.pipeline_version,
      step: args.step,
      called_at,
      model: manifest.model,
      temperature: stepCfg.temperature,
      max_output_tokens: stepCfg.max_output_tokens,
      prompt: args.prompt,
      response: rawText,
      tokens,
      reasoning,
      duration_ms,
      status: "success",
      error: null,
    };
    const aiLogId = await insertAiLog(aiLogs, successDoc);

    return { parsed, reasoning, aiLogId, rawText };
  }

  return { call };
}
