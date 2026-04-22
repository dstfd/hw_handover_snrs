import type { Collection, Db, ObjectId } from "mongodb";
import { C } from "../db/collections.js";
import type { PipelineNotificationSignalDoc } from "../types.js";

export function signalCollection(
  db: Db
): Collection<PipelineNotificationSignalDoc> {
  return db.collection<PipelineNotificationSignalDoc>(
    C.pipeline_notification_signals
  );
}

export async function findSignalByEvent(
  col: Collection<PipelineNotificationSignalDoc>,
  event_id: string,
  pipeline_version: string
): Promise<PipelineNotificationSignalDoc | null> {
  return (
    (await col
      .find({ event_id, pipeline_version, status: "emitted" })
      .sort({ emitted_at: -1 })
      .limit(1)
      .next()) ?? null
  );
}

export async function insertSignal(
  col: Collection<PipelineNotificationSignalDoc>,
  doc: PipelineNotificationSignalDoc
): Promise<ObjectId> {
  const r = await col.insertOne(doc);
  return r.insertedId;
}

export async function deleteSignal(
  col: Collection<PipelineNotificationSignalDoc>,
  event_id: string,
  pipeline_version: string
): Promise<number> {
  const r = await col.deleteMany({ event_id, pipeline_version });
  return r.deletedCount;
}

export async function listRecentSignals(
  col: Collection<PipelineNotificationSignalDoc>,
  page: number,
  limit: number
): Promise<PipelineNotificationSignalDoc[]> {
  const skip = (page - 1) * limit;
  return col
    .find({})
    .sort({ emitted_at: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();
}
