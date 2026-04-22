import type { Database } from "better-sqlite3";
import type { FastifyPluginAsync } from "fastify";

export const healthPlugin: FastifyPluginAsync<{ db: Database }> = async (
  app,
  opts
) => {
  const { db } = opts;

  app.get("/health", () => {
    const stateRow = db
      .prepare(`SELECT last_poll_attempted_at FROM poll_state WHERE id = 1`)
      .get() as { last_poll_attempted_at: string | null } | undefined;

    let dbState: "ok" | "error" = "ok";
    try {
      db.prepare(`SELECT 1`).get();
    } catch {
      dbState = "error";
    }

    return {
      status: "ok",
      service: "data-scout",
      last_poll_at: stateRow?.last_poll_attempted_at ?? null,
      db: dbState,
    };
  });
};
