import type { Db } from "mongodb";
import type { Redis } from "ioredis";
import { CONSUMER_GROUP, STREAM_INGESTED } from "./redisClient.js";
import { runIntelligencePipeline } from "../workflows/intelligencePipeline.js";
import type { IntelConfig } from "./config.js";
import type { createGeminiConnector } from "./geminiConnector.js";
import { findValidationByEvent, validationCollection as valCol } from "../repositories/pipelineValidationRepo.js";
import { findRelevanceByEvent, relevanceCollection } from "../repositories/pipelineRelevanceMatchingRepo.js";
import { findSignalByEvent, signalCollection } from "../repositories/pipelineNotificationSignalsRepo.js";
import { C } from "../db/collections.js";

type Gemini = ReturnType<typeof createGeminiConnector>;

const CONSUMER = "il-worker-1";

function fieldMap(fields: string[]): Record<string, string> {
  const o: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    o[fields[i] ?? ""] = fields[i + 1] ?? "";
  }
  return o;
}

/**
 * A pipeline is considered finished for this event+version if:
 * - a notification signal was emitted, or
 * - validation said do not proceed, or
 * - relevance matching completed (with or without notification_warranted), or
 * - a failed document exists in any step collection (fail-fast terminal state).
 */
async function isTerminal(
  db: Db,
  event_id: string,
  pipelineVersion: string
): Promise<boolean> {
  const sigC = signalCollection(db);
  if (await findSignalByEvent(sigC, event_id, pipelineVersion)) {
    return true;
  }
  const vCol = valCol(db);
  const v = await findValidationByEvent(vCol, event_id, pipelineVersion);
  if (v?.output && !v.output.proceed) {
    return true;
  }
  const rC = relevanceCollection(db);
  if (await findRelevanceByEvent(rC, event_id, pipelineVersion)) {
    return true;
  }
  for (const name of [
    C.pipeline_synthesis,
    C.pipeline_impact_evaluation,
    C.pipeline_validation,
    C.pipeline_relevance_matching,
  ] as const) {
    const c = db.collection(name);
    const f = await c.findOne({ event_id, pipeline_version: pipelineVersion, status: "failed" });
    if (f) return true;
  }
  return false;
}

export type StreamWorkerHandle = {
  stop: () => void;
  getLastOutcome: () => { event_id: string; outcome: string } | undefined;
};

export function startIngestedStreamWorker(
  deps: {
    config: IntelConfig;
    db: Db;
    gemini: Gemini;
    redis: Redis;
    log: { info: (o: object) => void; error: (o: object) => void };
  }
): StreamWorkerHandle {
  const { redis, log, config } = deps;
  let stop = false;
  let lastOutcome: { event_id: string; outcome: string } | undefined;

  const loop = async (): Promise<void> => {
    while (!stop) {
      try {
        await redis.xgroup("CREATE", STREAM_INGESTED, CONSUMER_GROUP, "0", "MKSTREAM").catch((e: unknown) => {
          if (String(e).includes("BUSYGROUP")) return;
          throw e;
        });
        const resUnknown: unknown = await redis.xreadgroup(
          "GROUP",
          CONSUMER_GROUP,
          CONSUMER,
          "COUNT",
          1,
          "BLOCK",
          10_000,
          "STREAMS",
          STREAM_INGESTED,
          ">"
        );
        if (!Array.isArray(resUnknown) || resUnknown.length === 0) {
          continue;
        }
        const entry = resUnknown[0] as unknown;
        if (!Array.isArray(entry) || entry.length < 2) continue;
        const stream = entry[0] as string;
        const messages = entry[1] as unknown;
        if (stream !== STREAM_INGESTED) continue;
        if (!Array.isArray(messages) || messages.length === 0) continue;
        for (const msg of messages as [string, string[]][]) {
          const id = msg[0];
          const fieldList = msg[1];
          if (typeof id !== "string" || !Array.isArray(fieldList)) continue;
          const fields = fieldMap(fieldList);
          const event_id = fields["event_id"];
          const source_event_id = fields["source_event_id"] ?? "";
          if (!event_id) {
            log.error({ msg: "stream message missing event_id", id });
            await redis.xack(STREAM_INGESTED, CONSUMER_GROUP, id);
            continue;
          }
          if (await isTerminal(deps.db, event_id, config.pipelineVersion)) {
            log.info({ msg: "skip duplicate terminal event", event_id, message_id: id });
            await redis.xack(STREAM_INGESTED, CONSUMER_GROUP, id);
            continue;
          }
          try {
            const outcome = await runIntelligencePipeline(
              { ...deps, redis: deps.redis },
              { event_id, source_event_id }
            );
            lastOutcome = { event_id, outcome };
            log.info({ msg: "pipeline run finished", event_id, outcome, message_id: id });
          } catch (e) {
            log.error({
              msg: "pipeline run failed",
              event_id,
              error: e instanceof Error ? e.message : String(e),
              message_id: id,
            });
            lastOutcome = { event_id, outcome: "failed" };
          }
          await redis.xack(STREAM_INGESTED, CONSUMER_GROUP, id);
        }
      } catch (e) {
        if (stop) return;
        log.error({ msg: "stream read loop", error: e instanceof Error ? e.message : String(e) });
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  };

  void loop();

  return {
    stop: () => {
      stop = true;
    },
    getLastOutcome: () => lastOutcome,
  };
}
