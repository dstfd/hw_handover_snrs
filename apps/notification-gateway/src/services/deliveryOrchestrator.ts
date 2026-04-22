import type { Database } from "better-sqlite3";
import { sendEmailMock } from "./channelEmail.js";
import { sendSlackMock } from "./channelSlack.js";
import { fetchPipelineAggregate } from "./intelligenceLayerClient.js";
import type { NotificationPayload } from "../types.js";
import { findUserById, rowToPublic } from "./userQueries.js";
import type { PipelineAggregateJson } from "./intelligenceLayerClient.js";

export type NotificationLogInsert = {
  event_id: string;
  user_id: string;
  channel: string;
  status: "mocked" | "failed";
  attempted_at: string;
  payload: string;
  error: string | null;
};

function extractPayload(
  pipeline: PipelineAggregateJson,
  event_id: string
): NotificationPayload {
  const syn = pipeline.steps?.synthesis?.output;
  const imp = pipeline.steps?.impact_evaluation?.output;
  const rel = pipeline.steps?.relevance_matching?.output;
  if (!syn?.headline) {
    throw new Error("Pipeline missing synthesis.headline");
  }
  if (!imp?.severity) {
    throw new Error("Pipeline missing impact_evaluation.severity");
  }
  if (!rel?.matched_users || rel.matched_users.length === 0) {
    throw new Error("Pipeline missing relevance matched_users");
  }
  return {
    event_id,
    headline: syn.headline,
    facts: Array.isArray(syn.facts) ? syn.facts : [],
    severity: imp.severity,
    sent_at: new Date().toISOString(),
  };
}

/**
 * Fetches pipeline, runs mocked channel validation, returns rows to persist in one DB transaction.
 */
export async function planDeliveryLogRows(
  db: Database,
  intelBaseUrl: string,
  event_id: string
): Promise<NotificationLogInsert[]> {
  const pipeline = await fetchPipelineAggregate(intelBaseUrl, event_id);
  const payload = extractPayload(pipeline, event_id);
  const rel = pipeline.steps?.relevance_matching?.output;
  const matched = rel?.matched_users;
  if (!matched?.length) {
    throw new Error("No matched users in pipeline");
  }

  const payloadJson = JSON.stringify(payload);
  const rows: NotificationLogInsert[] = [];

  for (const m of matched) {
    const row = findUserById(db, m.user_id);
    if (!row) {
      throw new Error(`Unknown user_id in relevance match: ${m.user_id}`);
    }
    const user = rowToPublic(row);
    const channels = m.channels?.length ? m.channels : user.channels;

    for (const ch of channels) {
      const attempted_at = new Date().toISOString();
      try {
        if (ch === "email") {
          sendEmailMock(user, payload);
        } else if (ch === "slack") {
          sendSlackMock(user, payload);
        } else {
          throw new Error(`Unknown channel: ${ch}`);
        }
        rows.push({
          event_id,
          user_id: user.user_id,
          channel: ch,
          status: "mocked",
          attempted_at,
          payload: payloadJson,
          error: null,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        rows.push({
          event_id,
          user_id: user.user_id,
          channel: ch,
          status: "failed",
          attempted_at,
          payload: payloadJson,
          error: msg,
        });
        throw e;
      }
    }
  }

  return rows;
}

export function persistDeliveryAndSignal(
  db: Database,
  stream_message_id: string,
  event_id: string,
  rows: NotificationLogInsert[]
): void {
  const processed_at = new Date().toISOString();
  const ins = db.prepare(
    `INSERT INTO notification_log (event_id, user_id, channel, status, attempted_at, payload, error)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insProc = db.prepare(
    `INSERT INTO processed_signals (stream_message_id, event_id, processed_at) VALUES (?, ?, ?)`
  );
  for (const r of rows) {
    ins.run(
      r.event_id,
      r.user_id,
      r.channel,
      r.status,
      r.attempted_at,
      r.payload,
      r.error
    );
  }
  insProc.run(stream_message_id, event_id, processed_at);
}
