import type { FastifyPluginAsync } from "fastify";
import type { Db } from "mongodb";
import { ObjectId } from "mongodb";
import type { IntelConfig } from "../services/config.js";
import { fetchEventById } from "../services/dataScoutClient.js";
import type { DataScoutEventPayload } from "../types.js";
import {
  listSynthesisForRuns,
  countSynthesis,
  deleteSynthesis,
  synthesisCollection,
  findSynthesisByEvent,
} from "../repositories/pipelineSynthesisRepo.js";
import { impactCollection, deleteImpact } from "../repositories/pipelineImpactEvaluationRepo.js";
import {
  deleteValidation,
  findValidationByEvent,
  validationCollection,
} from "../repositories/pipelineValidationRepo.js";
import { deleteRelevance, relevanceCollection, findRelevanceByEvent } from "../repositories/pipelineRelevanceMatchingRepo.js";
import { deleteSignal, findSignalByEvent, signalCollection } from "../repositories/pipelineNotificationSignalsRepo.js";
import { C } from "../db/collections.js";
import { runSynthesisStep } from "../steps/synthesisStep.js";
import { runImpactEvaluationStep } from "../steps/impactEvaluationStep.js";
import { runValidationStep } from "../steps/validationStep.js";
import { runRelevanceMatchingStep } from "../steps/relevanceMatchingStep.js";
import { runEmitNotificationSignalStep } from "../steps/emitNotificationSignalStep.js";
import { toJsonApiValue } from "../util/jsonApi.js";
import type { createGeminiConnector } from "../services/geminiConnector.js";
import type { Redis } from "ioredis";
import { findImpactByEvent } from "../repositories/pipelineImpactEvaluationRepo.js";
import { aiLogsCollection, findAiLogById } from "../repositories/aiLogsRepo.js";

type Gemini = ReturnType<typeof createGeminiConnector>;

async function computeOutcome(
  db: Db,
  event_id: string,
  pipelineVersion: string
): Promise<{
  outcome: "notified" | "skipped" | "failed" | "incomplete";
  matched_user_count: number;
}> {
  if (
    (await db.collection(C.pipeline_synthesis).countDocuments({ event_id, pipeline_version: pipelineVersion, status: "failed" })) > 0
  ) {
    return { outcome: "failed", matched_user_count: 0 };
  }
  for (const name of [C.pipeline_impact_evaluation, C.pipeline_validation, C.pipeline_relevance_matching] as const) {
    if ((await db.collection(name).countDocuments({ event_id, pipeline_version: pipelineVersion, status: "failed" })) > 0) {
      return { outcome: "failed", matched_user_count: 0 };
    }
  }
  if ((await db.collection(C.pipeline_notification_signals).countDocuments({ event_id, pipeline_version: pipelineVersion, status: "failed" })) > 0) {
    return { outcome: "failed", matched_user_count: 0 };
  }
  const sigC = signalCollection(db);
  const signal = await findSignalByEvent(sigC, event_id, pipelineVersion);
  if (signal) {
    return { outcome: "notified", matched_user_count: signal.matched_user_count };
  }
  const vCol = validationCollection(db);
  const val = await findValidationByEvent(vCol, event_id, pipelineVersion);
  if (val?.output && !val.output.proceed) {
    return { outcome: "skipped", matched_user_count: 0 };
  }
  const rCol = relevanceCollection(db);
  const rel = await findRelevanceByEvent(rCol, event_id, pipelineVersion);
  if (rel?.output) {
    if (rel.output.notification_warranted) {
      if (await findSignalByEvent(sigC, event_id, pipelineVersion)) {
        return { outcome: "notified", matched_user_count: rel.output.total_matched };
      }
      return { outcome: "incomplete", matched_user_count: rel.output.total_matched };
    }
    return { outcome: "skipped", matched_user_count: 0 };
  }
  return { outcome: "incomplete", matched_user_count: 0 };
}

export const pipelinePlugin: FastifyPluginAsync<{
  db: Db;
  config: IntelConfig;
  gemini: Gemini;
  redis: Redis;
}> = async (app, opts) => {
  const { db, config, gemini, redis } = opts;
  const pvDefault = config.pipelineVersion;
  const log = app.log;
  const base = { config, db, gemini, log };

  app.get<{
    Querystring: { page?: string; limit?: string; pipeline_version?: string };
  }>("/pipeline", async (request) => {
    const page = Math.max(1, Math.floor(Number(request.query.page ?? "1")) || 1);
    const limit = Math.min(200, Math.max(1, Math.floor(Number(request.query.limit ?? "20")) || 20));
    const pipeline_version = request.query.pipeline_version ?? pvDefault;
    const col = synthesisCollection(db);
    const total = await countSynthesis(col, pipeline_version);
    const rows = await listSynthesisForRuns(col, pipeline_version, page, limit);
    const data = await Promise.all(
      rows.map(async (r) => {
        const o = await computeOutcome(db, r.event_id, pipeline_version);
        return {
          event_id: r.event_id,
          processed_at: r.processed_at,
          outcome: o.outcome === "incomplete" ? "failed" : o.outcome,
          matched_user_count: o.matched_user_count,
        };
      })
    );
    return { data, page, limit, total };
  });

  app.get<{
    Params: { event_id: string; ai_log_id: string };
  }>("/pipeline/:event_id/ai-log/:ai_log_id", async (request, reply) => {
    const { event_id, ai_log_id } = request.params;
    if (!ObjectId.isValid(ai_log_id)) {
      return reply.status(400).send({ error: "Invalid ai_log_id" });
    }
    const col = aiLogsCollection(db);
    const doc = await findAiLogById(col, new ObjectId(ai_log_id));
    if (doc == null || doc.event_id !== event_id) {
      return reply.status(404).send({ error: "Not found" });
    }
    return toJsonApiValue(doc);
  });

  app.get<{
    Params: { event_id: string };
    Querystring: { pipeline_version?: string };
  }>("/pipeline/:event_id", async (request) => {
    const { event_id } = request.params;
    const pipeline_version = request.query.pipeline_version ?? pvDefault;
    const syn = await findSynthesisByEvent(synthesisCollection(db), event_id, pipeline_version);
    const imp = await findImpactByEvent(impactCollection(db), event_id, pipeline_version);
    const val = await findValidationByEvent(validationCollection(db), event_id, pipeline_version);
    const rel = await findRelevanceByEvent(relevanceCollection(db), event_id, pipeline_version);
    const sig = await findSignalByEvent(signalCollection(db), event_id, pipeline_version);
    const o = await computeOutcome(db, event_id, pipeline_version);
    let source_event: DataScoutEventPayload | null = null;
    let source_event_fetch_error: string | null = null;
    try {
      source_event = await fetchEventById(config.datascoutBaseUrl, event_id);
    } catch (e) {
      source_event_fetch_error = e instanceof Error ? e.message : String(e);
    }
    return toJsonApiValue({
      event_id,
      pipeline_version,
      outcome: o.outcome,
      matched_user_count: o.matched_user_count,
      source_event,
      source_event_fetch_error,
      steps: {
        synthesis: syn ?? null,
        impact_evaluation: imp ?? null,
        validation: val ?? null,
        relevance_matching: rel ?? null,
        notification_signal: sig ?? null,
      },
    });
  });

  app.delete<{
    Params: { event_id: string; step: string };
    Querystring: { pipeline_version?: string };
  }>("/pipeline/:event_id/step/:step", async (request, reply) => {
    const { event_id, step: raw } = request.params;
    const pipeline_version = request.query.pipeline_version ?? pvDefault;
    const step = raw;
    if (
      ![
        "synthesis",
        "impact_evaluation",
        "validation",
        "relevance_matching",
        "notification_signal",
      ].includes(step)
    ) {
      return reply.status(400).send({ error: "Invalid step" });
    }
    let deleted = 0;
    if (step === "synthesis") {
      deleted = await deleteSynthesis(synthesisCollection(db), event_id, pipeline_version);
    } else if (step === "impact_evaluation") {
      deleted = await deleteImpact(impactCollection(db), event_id, pipeline_version);
    } else if (step === "validation") {
      deleted = await deleteValidation(validationCollection(db), event_id, pipeline_version);
    } else if (step === "relevance_matching") {
      deleted = await deleteRelevance(relevanceCollection(db), event_id, pipeline_version);
    } else {
      deleted = await deleteSignal(signalCollection(db), event_id, pipeline_version);
    }
    return { deleted, event_id, step, pipeline_version };
  });

  app.post<{
    Params: { event_id: string; step: string };
    Querystring: { pipeline_version?: string };
  }>("/pipeline/:event_id/replay/:step", async (request, reply) => {
    const { event_id, step: raw } = request.params;
    const pipeline_version = request.query.pipeline_version ?? pvDefault;
    if (pipeline_version !== config.pipelineVersion) {
      return reply.status(400).send({
        error: "pipeline_version must match current PIPELINE_VERSION for replay in this build",
      });
    }
    const step = raw;
    const noAi = { config, db, log };
    const ev = await fetchEventById(config.datascoutBaseUrl, event_id).catch(() => null);
    if (!ev) {
      return reply.status(400).send({ error: "Data Scout has no event for this event_id" });
    }
    const source_event_id = ev.source_event_id;
    try {
      if (step === "synthesis") {
        await runSynthesisStep(base, event_id, source_event_id);
        return { ok: true, step };
      }
      if (step === "impact_evaluation") {
        if (!(await findSynthesisByEvent(synthesisCollection(db), event_id, pipeline_version)))
          return reply.status(400).send({ error: "Missing synthesis" });
        await runImpactEvaluationStep(base, event_id);
        return { ok: true, step };
      }
      if (step === "validation") {
        if (!(await findSynthesisByEvent(synthesisCollection(db), event_id, pipeline_version)))
          return reply.status(400).send({ error: "Missing synthesis" });
        if (!(await findImpactByEvent(impactCollection(db), event_id, pipeline_version)))
          return reply.status(400).send({ error: "Missing impact" });
        await runValidationStep(base, event_id);
        return { ok: true, step };
      }
      if (step === "relevance_matching") {
        const v = await findValidationByEvent(validationCollection(db), event_id, pipeline_version);
        if (!v?.output?.proceed) {
          return reply.status(400).send({ error: "Validation does not allow relevance" });
        }
        await runRelevanceMatchingStep(noAi, event_id);
        return { ok: true, step };
      }
      if (step === "notification_signal") {
        const rel = await findRelevanceByEvent(relevanceCollection(db), event_id, pipeline_version);
        if (!rel?.output?.notification_warranted) {
          return reply.status(400).send({ error: "Relevance does not warrant notification" });
        }
        await runEmitNotificationSignalStep({ config, db, redis, log }, event_id);
        return { ok: true, step };
      }
      return reply.status(400).send({ error: "Invalid step" });
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      return reply.status(500).send({ error: m });
    }
  });
};
