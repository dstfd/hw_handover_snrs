import type { Db } from "mongodb";
import type { Redis } from "ioredis";
import { validationCollection, findValidationByEvent } from "../repositories/pipelineValidationRepo.js";
import { relevanceCollection, findRelevanceByEvent } from "../repositories/pipelineRelevanceMatchingRepo.js";
import { runSynthesisStep } from "../steps/synthesisStep.js";
import { runImpactEvaluationStep } from "../steps/impactEvaluationStep.js";
import { runValidationStep } from "../steps/validationStep.js";
import { runRelevanceMatchingStep } from "../steps/relevanceMatchingStep.js";
import { runEmitNotificationSignalStep } from "../steps/emitNotificationSignalStep.js";
import type { IntelConfig } from "../services/config.js";
import type { createGeminiConnector } from "../services/geminiConnector.js";
import type { PipelineOutcome } from "../types.js";

type Gemini = ReturnType<typeof createGeminiConnector>;

/**
 * Functionally matches the design doc’s LlamaIndex workflow: sequential steps,
 * no in-memory handoff of analytical content — only IDs + fetches from Mongo.
 */
export async function runIntelligencePipeline(
  deps: {
    config: IntelConfig;
    db: Db;
    gemini: Gemini;
    redis: Redis;
    log: { info: (o: object) => void; error: (o: object) => void };
  },
  input: { event_id: string; source_event_id: string }
): Promise<PipelineOutcome> {
  const { event_id, source_event_id } = input;
  const { config, db } = deps;
  const pv = config.pipelineVersion;
  const log = deps.log;
  const base = { config, db, gemini: deps.gemini, log };
  const baseNoAi = { config, db, log };

  await runSynthesisStep(base, event_id, source_event_id);
  await runImpactEvaluationStep(base, event_id);
  await runValidationStep(base, event_id);

  const vCol = validationCollection(db);
  const val = await findValidationByEvent(vCol, event_id, pv);
  if (!val?.output) {
    log.error({ msg: "pipeline: missing validation after run", event_id });
    return "failed";
  }
  if (!val.output.proceed) {
    return "skipped";
  }

  await runRelevanceMatchingStep(baseNoAi, event_id);
  const rCol = relevanceCollection(db);
  const rel = await findRelevanceByEvent(rCol, event_id, pv);
  if (!rel?.output) {
    log.error({ msg: "pipeline: missing relevance after run", event_id });
    return "failed";
  }
  if (!rel.output.notification_warranted) {
    return "skipped";
  }

  await runEmitNotificationSignalStep(
    { config, db, redis: deps.redis, log },
    event_id
  );
  return "notified";
}
