import type { Collection, Db, ObjectId } from "mongodb";
import { C } from "../db/collections.js";
import type { PipelineImpactDoc } from "../types.js";

export function impactCollection(db: Db): Collection<PipelineImpactDoc> {
  return db.collection<PipelineImpactDoc>(C.pipeline_impact_evaluation);
}

export async function findImpactByEvent(
  col: Collection<PipelineImpactDoc>,
  event_id: string,
  pipeline_version: string
): Promise<PipelineImpactDoc | null> {
  return (
    (await col
      .find({ event_id, pipeline_version, status: "completed" })
      .sort({ processed_at: -1 })
      .limit(1)
      .next()) ?? null
  );
}

export async function insertImpact(
  col: Collection<PipelineImpactDoc>,
  doc: PipelineImpactDoc
): Promise<ObjectId> {
  const r = await col.insertOne(doc);
  return r.insertedId;
}

export async function deleteImpact(
  col: Collection<PipelineImpactDoc>,
  event_id: string,
  pipeline_version: string
): Promise<number> {
  const r = await col.deleteMany({ event_id, pipeline_version });
  return r.deletedCount;
}
