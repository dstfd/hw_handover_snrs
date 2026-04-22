import type { Database } from "better-sqlite3";
import type { FastifyPluginAsync } from "fastify";
import type { GatewayLogEntry } from "../types.js";

function levelMatches(
  entryLevel: string,
  filter?: string
): boolean {
  if (filter === undefined || filter === "") return true;
  return entryLevel === filter;
}

function eventMatches(event_id: string | null, filter?: string): boolean {
  if (filter === undefined || filter === "") return true;
  return event_id === filter;
}

export const logsPlugin: FastifyPluginAsync<{ db: Database }> = async (
  app,
  opts
) => {
  const { db } = opts;

  app.get<{
    Querystring: {
      level?: string;
      event_id?: string;
      page?: string;
      limit?: string;
    };
  }>("/logs", (request) => {
    const page = Math.max(1, Math.floor(Number(request.query.page ?? "1")) || 1);
    const limitRaw = Math.floor(Number(request.query.limit ?? "50")) || 50;
    const limit = Math.min(200, Math.max(1, limitRaw));
    const levelFilter = request.query.level;
    const eventFilter = request.query.event_id;

    const rows = db
      .prepare(
        `SELECT logged_at, level, event_id, source, message
         FROM gateway_operational_log
         ORDER BY logged_at DESC`
      )
      .all() as Array<{
      logged_at: string;
      level: string;
      event_id: string | null;
      source: string;
      message: string;
    }>;

    const notifRows = db
      .prepare(
        `SELECT attempted_at, status, event_id, user_id, channel, payload, error
         FROM notification_log
         ORDER BY attempted_at DESC`
      )
      .all() as Array<{
      attempted_at: string;
      status: string;
      event_id: string;
      user_id: string;
      channel: string;
      payload: string;
      error: string | null;
    }>;

    const merged: GatewayLogEntry[] = [];

    for (const r of rows) {
      const lev = r.level as GatewayLogEntry["level"];
      if (
        lev !== "info" &&
        lev !== "warn" &&
        lev !== "error" &&
        lev !== "debug"
      ) {
        continue;
      }
      const e: GatewayLogEntry = {
        timestamp: r.logged_at,
        service: "notification-gateway",
        level: lev,
        event_id: r.event_id,
        source: r.source,
        message: r.message,
      };
      if (!levelMatches(e.level, levelFilter)) continue;
      if (!eventMatches(e.event_id, eventFilter)) continue;
      merged.push(e);
    }

    for (const n of notifRows) {
      const lev: GatewayLogEntry["level"] =
        n.status === "failed" ? "error" : "info";
      const e: GatewayLogEntry = {
        timestamp: n.attempted_at,
        service: "notification-gateway",
        level: lev,
        event_id: n.event_id,
        source: "notification_log",
        message:
          n.status === "failed"
            ? `delivery failed ${n.channel} user=${n.user_id}: ${n.error ?? ""}`
            : `delivery mocked ${n.channel} user=${n.user_id}`,
      };
      if (!levelMatches(e.level, levelFilter)) continue;
      if (!eventMatches(e.event_id, eventFilter)) continue;
      merged.push(e);
    }

    merged.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const total = merged.length;
    const offset = (page - 1) * limit;
    const data = merged.slice(offset, offset + limit);
    return { data, page, limit, total };
  });
};
