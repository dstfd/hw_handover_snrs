import type { Collection, Db, ObjectId } from "mongodb";
import { C } from "../db/collections.js";
import type { PipelineValidationDoc } from "../types.js";

export function validationCollection(
  db: Db
): Collection<PipelineValidationDoc> {
  return db.collection<PipelineValidationDoc>(C.pipeline_validation);
}

export async function findValidationByEvent(
  col: Collection<PipelineValidationDoc>,
  event_id: string,
  pipeline_version: string
): Promise<PipelineValidationDoc | null> {
  return (
    (await col
      .find({ event_id, pipeline_version, status: "completed" })
      .sort({ processed_at: -1 })
      .limit(1)
      .next()) ?? null
  );
}

export async function insertValidation(
  col: Collection<PipelineValidationDoc>,
  doc: PipelineValidationDoc
): Promise<ObjectId> {
  const r = await col.insertOne(doc);
  return r.insertedId;
}

export async function deleteValidation(
  col: Collection<PipelineValidationDoc>,
  event_id: string,
  pipeline_version: string
): Promise<number> {
  const r = await col.deleteMany({ event_id, pipeline_version });
  return r.deletedCount;
}
