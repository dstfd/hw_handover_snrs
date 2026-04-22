import type { Database } from "better-sqlite3";
import type { FastifyPluginAsync } from "fastify";
import type { MergedLogEntry } from "../types.js";

function levelOk(
  entryLevel: MergedLogEntry["level"],
  filter?: string
): boolean {
  if (filter === undefined || filter === "") return true;
  return entryLevel === filter;
}

function eventOk(event_id: string | null, filter?: string): boolean {
  if (filter === undefined || filter === "") return true;
  return event_id === filter;
}

export const logsPlugin: FastifyPluginAsync<{
  db: Database;
}> = async (app, opts) => {
  const { db } = opts;

  app.get<{
    Querystring: {
      page?: string;
      limit?: string;
      level?: string;
      event_id?: string;
    };
  }>("/logs", (request) => {
    const page = Math.max(1, Math.floor(Number(request.query.page ?? "1")) || 1);
    const limitRaw = Math.floor(Number(request.query.limit ?? "50")) || 50;
    const limit = Math.min(200, Math.max(1, limitRaw));
    const offset = (page - 1) * limit;
    const levelFilter = request.query.level as
      | "error"
      | "warn"
      | "info"
      | "debug"
      | undefined;
    const eventFilter = request.query.event_id;

    const publishRows = db
      .prepare(
        `SELECT event_id, published_at, interval_seconds_used FROM publish_log
         ORDER BY published_at ASC`
      )
      .all() as {
      event_id: string;
      published_at: string;
      interval_seconds_used: number;
    }[];

    const accessRows = db
      .prepare(
        `SELECT requested_at, since_cursor, events_returned, id FROM api_access_log
         ORDER BY requested_at ASC`
      )
      .all() as {
      requested_at: string;
      since_cursor: string | null;
      events_returned: number;
      id: number;
    }[];

    const merged: MergedLogEntry[] = [];
    for (const p of publishRows) {
      merged.push({
        timestamp: p.published_at,
        service: "magicball",
        level: "info",
        event_id: p.event_id,
        source: "publish_log",
        message: `Published event ${p.event_id} (interval_seconds_used=${p.interval_seconds_used})`,
      });
    }
    for (const a of accessRows) {
      const since = a.since_cursor === null ? "none" : a.since_cursor;
      merged.push({
        timestamp: a.requested_at,
        service: "magicball",
        level: "info",
        event_id: null,
        source: "api_access_log",
        message: `GET /events?since=${since} returned ${a.events_returned} events (log_id=${a.id})`,
      });
    }
    merged.sort(
      (x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime()
    );

    const filtered = merged.filter(
      (e) => levelOk(e.level, levelFilter) && eventOk(e.event_id, eventFilter)
    );

    const total = filtered.length;
    const data = filtered.slice(offset, offset + limit);
    return { data, page, limit, total };
  });
};
