import type { Database } from "better-sqlite3";
import type { FastifyPluginAsync } from "fastify";

export const healthPlugin: FastifyPluginAsync<{
  db: Database;
}> = async (app, opts) => {
  const { db } = opts;

  app.get("/health", () => {
    const controls = db
      .prepare(
        `SELECT publish_enabled, manual_mode FROM publish_controls WHERE id = 1`
      )
      .get() as
      | { publish_enabled: number; manual_mode: number }
      | undefined;

    const lastRow = db
      .prepare(`SELECT MAX(published_at) as last_published_at FROM publish_log`)
      .get() as { last_published_at: string | null } | undefined;

    const paused =
      !controls || controls.publish_enabled === 0 || controls.manual_mode === 1;

    let dbState: "ok" | "error" = "ok";
    try {
      db.prepare(`SELECT 1`).get();
    } catch {
      dbState = "error";
    }

    return {
      status: "ok",
      service: "magicball",
      publish_routine: paused ? ("paused" as const) : ("running" as const),
      last_publish_at: lastRow?.last_published_at ?? null,
      db: dbState,
    };
  });
};
