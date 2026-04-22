import type { Database } from "better-sqlite3";
import type { FastifyPluginAsync } from "fastify";
import type { DataScoutLogEntry, PollLogRow } from "../types.js";

type OpsRow = {
  logged_at: string;
  level: string;
  event_id: string | null;
  source: string;
  message: string;
};

function levelOk(
  entryLevel: DataScoutLogEntry["level"],
  filter?: string
): boolean {
  if (filter === undefined || filter === "") return true;
  return entryLevel === filter;
}

function eventOk(event_id: string | null, filter?: string): boolean {
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
      page?: string;
      limit?: string;
      level?: string;
      event_id?: string;
    };
  }>("/logs", (request, _reply) => {
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

    const rows = db
      .prepare(`SELECT * FROM poll_log ORDER BY polled_at DESC`)
      .all() as PollLogRow[];

    const pollEntries: DataScoutLogEntry[] = rows.map((r) => ({
      timestamp: r.polled_at,
      service: "data-scout",
      level: r.status === "error" ? "error" : "info",
      event_id: null,
      source: "poll_log",
      message:
        r.status === "error"
          ? `poll error: ${r.error_message ?? "unknown"}`
          : `poll ${r.status}: fetched=${r.events_fetched} new=${r.events_new} dup=${r.events_duplicate} emitted=${r.events_emitted}`,
    }));

    const opsRows = db
      .prepare(`SELECT logged_at, level, event_id, source, message FROM event_ops_log ORDER BY logged_at DESC`)
      .all() as OpsRow[];

    const opsEntries: DataScoutLogEntry[] = opsRows.map((r) => {
      const lev = r.level as DataScoutLogEntry["level"];
      const level: DataScoutLogEntry["level"] =
        lev === "error" || lev === "warn" || lev === "info" || lev === "debug"
          ? lev
          : "info";
      return {
        timestamp: r.logged_at,
        service: "data-scout",
        level,
        event_id: r.event_id,
        source: "event_ops",
        message: r.message,
      };
    });

    const merged = [...pollEntries, ...opsEntries].filter((e) => {
      if (!levelOk(e.level, levelFilter)) return false;
      if (!eventOk(e.event_id, eventFilter)) return false;
      return true;
    });

    merged.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const total = merged.length;
    const data = merged.slice(offset, offset + limit);
    return { data, page, limit, total };
  });
};
