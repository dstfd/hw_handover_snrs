import type { ObjectId } from "mongodb";
import { findSynthesisByEvent, synthesisCollection } from "../repositories/pipelineSynthesisRepo.js";
import { findImpactByEvent, impactCollection } from "../repositories/pipelineImpactEvaluationRepo.js";
import { findValidationByEvent, validationCollection } from "../repositories/pipelineValidationRepo.js";
import {
  relevanceCollection,
  insertRelevance,
} from "../repositories/pipelineRelevanceMatchingRepo.js";
import { fetchUsersForRelevance } from "../services/notificationGatewayClient.js";
import type { IntelConfig } from "../services/config.js";
import type { Db } from "mongodb";
import type { PipelineRelevanceDoc } from "../types.js";

export async function runRelevanceMatchingStep(
  deps: {
    config: IntelConfig;
    db: Db;
    log: { info: (o: object) => void; error: (o: object) => void };
  },
  event_id: string
): Promise<ObjectId> {
  const { config, db, log } = deps;
  const synC = synthesisCollection(db);
  const impC = impactCollection(db);
  const valC = validationCollection(db);
  const relC = relevanceCollection(db);
  const pv = config.pipelineVersion;
  const now = new Date().toISOString();

  try {
    const val = await findValidationByEvent(valC, event_id, pv);
    if (!val?._id || !val.output) {
      throw new Error("Relevance: missing completed validation");
    }
    if (!val.output.proceed) {
      throw new Error("Relevance: should not run when validation.proceed is false");
    }

    const syn = await findSynthesisByEvent(synC, event_id, pv);
    const imp = await findImpactByEvent(impC, event_id, pv);
    if (!syn?._id || !syn.output) {
      throw new Error("Relevance: missing synthesis");
    }
    if (!imp?._id || !imp.output) {
      throw new Error("Relevance: missing impact");
    }

    const category = syn.output.category;
    const severity = imp.output.severity;
    const users = await fetchUsersForRelevance(
      config.notificationGwBaseUrl,
      severity,
      category
    );
    const matched_users = users.map((u) => ({
      user_id: u.user_id,
      channels: u.channels,
      severity_threshold: u.severity_threshold,
      match_reason: "event severity >= user threshold (gateway rule)",
    }));
    const total_matched = matched_users.length;
    const notification_warranted = total_matched > 0;

    const doc: PipelineRelevanceDoc = {
      event_id,
      pipeline_version: pv,
      step: "relevance_matching",
      processed_at: now,
      status: "completed",
      error: null,
      impact_evaluation_ref: imp._id,
      validation_ref: val._id,
      output: {
        event_severity: severity,
        matched_users,
        total_matched,
        notification_warranted,
      },
    };
    const id = await insertRelevance(relC, doc);
    log.info({ msg: "relevance completed", event_id, matched: total_matched });
    return id;
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    const fail: PipelineRelevanceDoc = {
      event_id,
      pipeline_version: pv,
      step: "relevance_matching",
      processed_at: new Date().toISOString(),
      status: "failed",
      error: err,
      impact_evaluation_ref: null,
      validation_ref: null,
    };
    try {
      const imp = await findImpactByEvent(impC, event_id, pv);
      const val = await findValidationByEvent(valC, event_id, pv);
      if (imp?._id) fail.impact_evaluation_ref = imp._id;
      if (val?._id) fail.validation_ref = val._id;
      await insertRelevance(relC, fail);
    } catch (ie) {
      log.error({ msg: "relevance failed doc", error: String(ie) });
    }
    log.error({ msg: "relevance step failed", event_id, error: err });
    throw e;
  }
}
