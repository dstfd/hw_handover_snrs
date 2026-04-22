import type { Collection, Db, ObjectId } from "mongodb";
import { C } from "../db/collections.js";
import type { AiLogDoc } from "../types.js";

export function aiLogsCollection(db: Db): Collection<AiLogDoc> {
  return db.collection<AiLogDoc>(C.ai_logs);
}

export async function insertAiLog(
  col: Collection<AiLogDoc>,
  doc: Omit<AiLogDoc, "_id">
): Promise<ObjectId> {
  const r = await col.insertOne(doc as AiLogDoc);
  return r.insertedId;
}

export async function findAiLogs(
  col: Collection<AiLogDoc>,
  opts: {
    event_id?: string;
    /** error → status failed; other levels are not stored on documents — not filtered */
    level?: "error" | "warn" | "info" | "debug";
    page: number;
    limit: number;
  }
): Promise<{ data: AiLogDoc[]; total: number }> {
  const filter: Record<string, unknown> = {};
  if (opts.event_id) filter["event_id"] = opts.event_id;
  if (opts.level === "error") {
    filter["status"] = "failed";
  } else if (opts.level === "info") {
    filter["status"] = "success";
  } else if (opts.level === "warn" || opts.level === "debug") {
    filter["_id"] = { $exists: false };
  }
  const total = await col.countDocuments(filter);
  const skip = (opts.page - 1) * opts.limit;
  const data = await col
    .find(filter, { sort: { called_at: -1 } })
    .skip(skip)
    .limit(opts.limit)
    .toArray();
  return { data, total };
}

export async function findAiLogById(
  col: Collection<AiLogDoc>,
  id: ObjectId
): Promise<AiLogDoc | null> {
  return col.findOne({ _id: id });
}
