import type { ObjectId } from "mongodb";
import { fetchEventById } from "../services/dataScoutClient.js";
import { buildSynthesisPrompt } from "../prompts/synthesisPrompt.js";
import { coerceSynthesis } from "./coerce.js";
import { synthesisCollection, insertSynthesis } from "../repositories/pipelineSynthesisRepo.js";
import type { IntelConfig } from "../services/config.js";
import type { Db } from "mongodb";
import type { createGeminiConnector } from "../services/geminiConnector.js";
import type { PipelineSynthesisDoc } from "../types.js";

type Gemini = ReturnType<typeof createGeminiConnector>;

export async function runSynthesisStep(
  deps: {
    config: IntelConfig;
    db: Db;
    gemini: Gemini;
    log: { info: (o: object) => void; error: (o: object) => void };
  },
  event_id: string,
  source_event_id: string
): Promise<ObjectId> {
  const { config, db, gemini, log } = deps;
  const col = synthesisCollection(db);
  const now = new Date().toISOString();
  const pv = config.pipelineVersion;

  try {
    const raw = await fetchEventById(config.datascoutBaseUrl, event_id);
    if (raw.source_event_id !== source_event_id) {
      log.error({
        msg: "synthesis source_event_id mismatch",
        event_id,
        expected: source_event_id,
        got: raw.source_event_id,
      });
    }
    const prompt = buildSynthesisPrompt(raw);
    const { parsed, reasoning, aiLogId } = await gemini.call({
      step: "synthesis",
      prompt,
      event_id,
      pipeline_version: pv,
    });
    const { output, reasoning: stepReasoning } = coerceSynthesis(parsed);

    const doc: PipelineSynthesisDoc = {
      event_id,
      source_event_id,
      pipeline_version: pv,
      step: "synthesis",
      processed_at: now,
      status: "completed",
      error: null,
      ai_log_id: aiLogId,
      source_severity_raw: raw.severity,
      output,
      reasoning: stepReasoning,
    };
    const id = await insertSynthesis(col, doc);
    log.info({ msg: "synthesis completed", event_id, synthesis_id: id.toHexString() });
    return id;
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    const fail: PipelineSynthesisDoc = {
      event_id,
      source_event_id,
      pipeline_version: pv,
      step: "synthesis",
      processed_at: new Date().toISOString(),
      status: "failed",
      error: err,
      ai_log_id: null,
    };
    try {
      await insertSynthesis(col, fail);
    } catch (ie) {
      log.error({ msg: "synthesis failed doc insert", error: String(ie) });
    }
    log.error({ msg: "synthesis step failed", event_id, error: err });
    throw e;
  }
}
