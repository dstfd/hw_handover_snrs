import type { ObjectId } from "mongodb";
import { buildValidationPrompt } from "../prompts/validationPrompt.js";
import { coerceValidation } from "./coerce.js";
import { findSynthesisByEvent, synthesisCollection } from "../repositories/pipelineSynthesisRepo.js";
import { findImpactByEvent, impactCollection } from "../repositories/pipelineImpactEvaluationRepo.js";
import { validationCollection, insertValidation } from "../repositories/pipelineValidationRepo.js";
import type { IntelConfig } from "../services/config.js";
import type { Db } from "mongodb";
import type { createGeminiConnector } from "../services/geminiConnector.js";
import type { PipelineValidationDoc } from "../types.js";

type Gemini = ReturnType<typeof createGeminiConnector>;

export async function runValidationStep(
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
  const valC = validationCollection(db);
  const pv = config.pipelineVersion;
  const minC = config.minConfidenceThreshold;
  const now = new Date().toISOString();

  try {
    const syn = await findSynthesisByEvent(synC, event_id, pv);
    const imp = await findImpactByEvent(impC, event_id, pv);
    if (!syn?._id || !syn.output) {
      throw new Error("Validation: missing completed synthesis");
    }
    if (!imp?._id || !imp.output) {
      throw new Error("Validation: missing completed impact evaluation");
    }

    // DETERMINISTIC INTEGRITY PRE-CHECKS
    // These are machine-verifiable facts — must not be delegated to the AI.
    // Catches stale refs from replays and any event_id routing bugs.
    if (syn.event_id !== event_id) {
      throw new Error(
        `Validation integrity: synthesis.event_id mismatch — expected "${event_id}", got "${syn.event_id}"`
      );
    }
    if (imp.event_id !== event_id) {
      throw new Error(
        `Validation integrity: impact.event_id mismatch — expected "${event_id}", got "${imp.event_id}"`
      );
    }
    if (imp.synthesis_ref?.toHexString() !== syn._id?.toHexString()) {
      throw new Error(
        `Validation integrity: impact.synthesis_ref "${imp.synthesis_ref?.toHexString()}" ` +
        `does not match synthesis._id "${syn._id?.toHexString()}" — chain broken`
      );
    }

    const prompt = buildValidationPrompt(
      syn.output,
      imp.output,
      minC,
      syn.source_severity_raw
    );
    const { parsed, aiLogId } = await gemini.call({
      step: "validation",
      prompt,
      event_id,
      pipeline_version: pv,
    });
    const { output, reasoning } = coerceValidation(parsed);

    const doc: PipelineValidationDoc = {
      event_id,
      pipeline_version: pv,
      step: "validation",
      processed_at: now,
      status: "completed",
      error: null,
      ai_log_id: aiLogId,
      synthesis_ref: syn._id,
      impact_evaluation_ref: imp._id,
      output,
      reasoning,
    };
    const id = await insertValidation(valC, doc);
    log.info({ msg: "validation completed", event_id, validation_id: id.toHexString() });
    return id;
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    const fail: PipelineValidationDoc = {
      event_id,
      pipeline_version: pv,
      step: "validation",
      processed_at: new Date().toISOString(),
      status: "failed",
      error: err,
      ai_log_id: null,
      synthesis_ref: null,
      impact_evaluation_ref: null,
    };
    try {
      const syn = await findSynthesisByEvent(synC, event_id, pv);
      const imp = await findImpactByEvent(impC, event_id, pv);
      if (syn?._id) fail.synthesis_ref = syn._id;
      if (imp?._id) fail.impact_evaluation_ref = imp._id;
      await insertValidation(valC, fail);
    } catch (ie) {
      log.error({ msg: "validation failed doc", error: String(ie) });
    }
    log.error({ msg: "validation step failed", event_id, error: err });
    throw e;
  }
}
