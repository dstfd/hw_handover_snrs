import type { Database } from "better-sqlite3";
import type { FastifyPluginAsync } from "fastify";
import type { IngestedEventRow, IngestedEventResponse } from "../types.js";

function rowToResponse(row: IngestedEventRow): IngestedEventResponse {
  let tags: string[];
  try {
    const p = JSON.parse(row.tags) as unknown;
    tags =
      Array.isArray(p) && p.every((t) => typeof t === "string")
        ? (p as string[])
        : [];
  } catch {
    tags = [];
  }
  return { ...row, tags };
}

export const eventsPlugin: FastifyPluginAsync<{ db: Database }> = async (
  app,
  opts
) => {
  const { db } = opts;

  // Register more-specific route first
  app.get<{ Params: { source_event_id: string } }>(
    "/events/source/:source_event_id",
    (request, reply) => {
      const row = db
        .prepare(`SELECT * FROM ingested_events WHERE source_event_id = ?`)
        .get(request.params.source_event_id) as IngestedEventRow | undefined;
      if (!row) return reply.status(404).send({ error: "Event not found" });
      return rowToResponse(row);
    }
  );

  app.get<{ Params: { event_id: string } }>(
    "/events/:event_id",
    (request, reply) => {
      const row = db
        .prepare(`SELECT * FROM ingested_events WHERE event_id = ?`)
        .get(request.params.event_id) as IngestedEventRow | undefined;
      if (!row) return reply.status(404).send({ error: "Event not found" });
      return rowToResponse(row);
    }
  );
};
