import type { Collection, Db, ObjectId } from "mongodb";
import { C } from "../db/collections.js";
import type { PipelineRelevanceDoc } from "../types.js";

export function relevanceCollection(
  db: Db
): Collection<PipelineRelevanceDoc> {
  return db.collection<PipelineRelevanceDoc>(C.pipeline_relevance_matching);
}

export async function findRelevanceByEvent(
  col: Collection<PipelineRelevanceDoc>,
  event_id: string,
  pipeline_version: string
): Promise<PipelineRelevanceDoc | null> {
  return (
    (await col
      .find({ event_id, pipeline_version, status: "completed" })
      .sort({ processed_at: -1 })
      .limit(1)
      .next()) ?? null
  );
}

export async function insertRelevance(
  col: Collection<PipelineRelevanceDoc>,
  doc: PipelineRelevanceDoc
): Promise<ObjectId> {
  const r = await col.insertOne(doc);
  return r.insertedId;
}

export async function deleteRelevance(
  col: Collection<PipelineRelevanceDoc>,
  event_id: string,
  pipeline_version: string
): Promise<number> {
  const r = await col.deleteMany({ event_id, pipeline_version });
  return r.deletedCount;
}
