import type { FastifyPluginAsync } from "fastify";
import type { Db } from "mongodb";
import { synthesisCollection } from "../repositories/pipelineSynthesisRepo.js";
import { C } from "../db/collections.js";

export const healthPlugin: FastifyPluginAsync<{
  db: Db;
  service: string;
  getLastStreamOutcome: () => { event_id: string; outcome: string } | undefined;
}> = async (app, opts) => {
  const { db, service, getLastStreamOutcome } = opts;
  const synC = synthesisCollection(db);

  app.get("/health", async (_req, _reply) => {
    let mongo: "ok" | "degraded" = "ok";
    let last_pipeline_at: string | null = null;
    try {
      await db.command({ ping: 1 });
      const agg = await synC
        .aggregate([{ $group: { _id: null, t: { $max: "$processed_at" } } }])
        .toArray();
      const t0 = agg[0]?.t;
      last_pipeline_at = typeof t0 === "string" ? t0 : null;
    } catch {
      mongo = "degraded";
    }
    const out = getLastStreamOutcome();
    return {
      service,
      status: mongo,
      last_pipeline_at,
      last_stream_outcome: out,
    };
  });
};
