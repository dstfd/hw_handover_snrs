import type { Collection, Db, ObjectId } from "mongodb";
import { C } from "../db/collections.js";
import type { PipelineSynthesisDoc } from "../types.js";

export function synthesisCollection(
  db: Db
): Collection<PipelineSynthesisDoc> {
  return db.collection<PipelineSynthesisDoc>(C.pipeline_synthesis);
}

export async function findSynthesisByEvent(
  col: Collection<PipelineSynthesisDoc>,
  event_id: string,
  pipeline_version: string
): Promise<PipelineSynthesisDoc | null> {
  return (
    (await col
      .find({ event_id, pipeline_version, status: "completed" })
      .sort({ processed_at: -1 })
      .limit(1)
      .next()) ?? null
  );
}

export async function insertSynthesis(
  col: Collection<PipelineSynthesisDoc>,
  doc: PipelineSynthesisDoc
): Promise<ObjectId> {
  const r = await col.insertOne(doc);
  return r.insertedId;
}

export async function deleteSynthesis(
  col: Collection<PipelineSynthesisDoc>,
  event_id: string,
  pipeline_version: string
): Promise<number> {
  const r = await col.deleteMany({ event_id, pipeline_version });
  return r.deletedCount;
}

export async function listSynthesisForRuns(
  col: Collection<PipelineSynthesisDoc>,
  pipeline_version: string,
  page: number,
  limit: number
): Promise<PipelineSynthesisDoc[]> {
  const skip = (page - 1) * limit;
  const cur = col.aggregate<PipelineSynthesisDoc>([
    { $match: { pipeline_version } },
    { $sort: { processed_at: -1 } },
    { $group: { _id: "$event_id", doc: { $first: "$$ROOT" } } },
    { $replaceRoot: { newRoot: "$doc" } },
    { $sort: { processed_at: -1 } },
    { $skip: skip },
    { $limit: limit },
  ]);
  return cur.toArray();
}

/** Distinct `event_id` values that have at least one synthesis row for this version. */
export async function countSynthesis(
  col: Collection<PipelineSynthesisDoc>,
  pipeline_version: string
): Promise<number> {
  const cur = col.aggregate<{ total: number }>([
    { $match: { pipeline_version } },
    { $group: { _id: "$event_id" } },
    { $count: "total" },
  ]);
  const row = await cur.next();
  return row?.total ?? 0;
}
