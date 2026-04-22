import type { ObjectId } from "mongodb";
import { buildImpactPrompt } from "../prompts/impactEvaluationPrompt.js";
import { coerceImpact } from "./coerce.js";
import {
  findSynthesisByEvent,
  synthesisCollection,
} from "../repositories/pipelineSynthesisRepo.js";
import { impactCollection, insertImpact } from "../repositories/pipelineImpactEvaluationRepo.js";
import type { IntelConfig } from "../services/config.js";
import type { Db } from "mongodb";
import type { createGeminiConnector } from "../services/geminiConnector.js";
import type { PipelineImpactDoc } from "../types.js";

type Gemini = ReturnType<typeof createGeminiConnector>;

export async function runImpactEvaluationStep(
  deps: {
    config: IntelConfig;
    db: Db;
    gemini: Gemini;
    log: { info: (o: object) => void; error: (o: object) => void };
  },
  event_id: string
): Promise<ObjectId> {
  const { config, db, gemini, log } = deps;
  const synC = synthesisCollection(db);
  const impC = impactCollection(db);
  const pv = config.pipelineVersion;
  const now = new Date().toISOString();

  try {
    const syn = await findSynthesisByEvent(synC, event_id, pv);
    if (!syn?._id || !syn.output) {
      throw new Error("Impact: missing completed pipeline_synthesis for event");
    }
    const prompt = buildImpactPrompt(syn.output);
    const { parsed, aiLogId } = await gemini.call({
      step: "impact_evaluation",
      prompt,
      event_id,
      pipeline_version: pv,
    });
    const { output, reasoning } = coerceImpact(parsed);

    const doc: PipelineImpactDoc = {
      event_id,
      pipeline_version: pv,
      step: "impact_evaluation",
      processed_at: now,
      status: "completed",
      error: null,
      ai_log_id: aiLogId,
      synthesis_ref: syn._id,
      output,
      reasoning,
    };
    const id = await insertImpact(impC, doc);
    log.info({ msg: "impact completed", event_id, impact_id: id.toHexString() });
    return id;
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    const fail: PipelineImpactDoc = {
      event_id,
      pipeline_version: pv,
      step: "impact_evaluation",
      processed_at: new Date().toISOString(),
      status: "failed",
      error: err,
      ai_log_id: null,
      synthesis_ref: null,
    };
    try {
      const syn = await findSynthesisByEvent(synC, event_id, pv);
      if (syn?._id) fail.synthesis_ref = syn._id;
      await insertImpact(impC, fail);
    } catch (ie) {
      log.error({ msg: "impact failed doc", error: String(ie) });
    }
    log.error({ msg: "impact step failed", event_id, error: err });
    throw e;
  }
}
