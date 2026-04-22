import type { Database } from "better-sqlite3";
import type { FastifyPluginAsync } from "fastify";
import type { Redis } from "ioredis";

export const healthPlugin: FastifyPluginAsync<{
  db: Database;
  redis: Redis;
}> = async (app, opts) => {
  const { db, redis } = opts;

  app.get("/health", async () => {
    const now = new Date().toISOString();
    let dbOk = false;
    try {
      db.prepare(`SELECT 1`).get();
      dbOk = true;
    } catch {
      dbOk = false;
    }
    let redisOk = false;
    try {
      const pong = await redis.ping();
      redisOk = pong === "PONG";
    } catch {
      redisOk = false;
    }
    const lastRow = db
      .prepare(
        `SELECT MAX(processed_at) AS last_processed FROM processed_signals`
      )
      .get() as { last_processed: string | null } | undefined;

    return {
      status: dbOk && redisOk ? "ok" : "degraded",
      service: "notification-gateway",
      timestamp: now,
      db: dbOk ? "up" : "down",
      redis: redisOk ? "up" : "down",
      last_signal_processed_at: lastRow?.last_processed ?? null,
    };
  });
};
