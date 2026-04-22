import type { ObjectId } from "mongodb";
import { findRelevanceByEvent, relevanceCollection } from "../repositories/pipelineRelevanceMatchingRepo.js";
import {
  signalCollection,
  insertSignal,
} from "../repositories/pipelineNotificationSignalsRepo.js";
import { emitNotificationSignal } from "../services/streamEmitter.js";
import type { IntelConfig } from "../services/config.js";
import type { Db } from "mongodb";
import type { Redis } from "ioredis";
import type { PipelineNotificationSignalDoc } from "../types.js";

export async function runEmitNotificationSignalStep(
  deps: {
    config: IntelConfig;
    db: Db;
    redis: Redis;
    log: { info: (o: object) => void; error: (o: object) => void };
  },
  event_id: string
): Promise<ObjectId> {
  const { config, db, redis, log } = deps;
  const relC = relevanceCollection(db);
  const sigC = signalCollection(db);
  const pv = config.pipelineVersion;
  const now = new Date().toISOString();

  try {
    const rel = await findRelevanceByEvent(relC, event_id, pv);
    if (!rel?._id || !rel.output) {
      throw new Error("Signal: missing relevance matching");
    }
    if (!rel.output.notification_warranted) {
      throw new Error("Signal: notification not warranted");
    }
    const ref = rel._id.toHexString();
    const stream_message_id = await emitNotificationSignal(
      redis,
      event_id,
      ref,
      now
    );
    const doc: PipelineNotificationSignalDoc = {
      event_id,
      pipeline_version: pv,
      step: "notification_signal",
      emitted_at: now,
      status: "emitted",
      error: null,
      relevance_matching_ref: rel._id,
      matched_user_count: rel.output.total_matched,
      stream_message_id,
    };
    const id = await insertSignal(sigC, doc);
    log.info({ msg: "notification signal emitted", event_id, stream_message_id });
    return id;
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    const fail: PipelineNotificationSignalDoc = {
      event_id,
      pipeline_version: pv,
      step: "notification_signal",
      emitted_at: now,
      status: "failed",
      error: err,
      relevance_matching_ref: null,
      matched_user_count: 0,
      stream_message_id: null,
    };
    try {
      const rel = await findRelevanceByEvent(relC, event_id, pv);
      if (rel?._id) fail.relevance_matching_ref = rel._id;
      if (rel?.output) fail.matched_user_count = rel.output.total_matched;
      await insertSignal(sigC, fail);
    } catch (ie) {
      log.error({ msg: "signal failed doc", error: String(ie) });
    }
    log.error({ msg: "emit signal failed", event_id, error: err });
    throw e;
  }
}
