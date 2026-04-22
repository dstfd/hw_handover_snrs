import type { Database } from "better-sqlite3";
import type { FastifyPluginAsync } from "fastify";
import type { MagicBallEventRow } from "../types.js";
import { isValidIso8601, rowToEventResponse } from "./serialize.js";

export const eventsPlugin: FastifyPluginAsync<{
  db: Database;
}> = async (app, opts) => {
  const { db } = opts;

  app.get<{
    Querystring: { since?: string };
  }>("/events", (request, reply) => {
    const since = request.query.since;
    if (since !== undefined && since !== "" && !isValidIso8601(since)) {
      return reply.status(400).send({
        error: "Invalid query: since must be a valid ISO8601 timestamp if provided",
      });
    }

    const sinceValue = since === "" || since === undefined ? null : since;
    const rows = sinceValue
      ? (db
          .prepare(
            `SELECT * FROM events
              WHERE is_available = 1
                AND made_available_at > ?
              ORDER BY made_available_at ASC`
          )
          .all(sinceValue) as MagicBallEventRow[])
      : (db
          .prepare(
            `SELECT * FROM events
              WHERE is_available = 1
              ORDER BY made_available_at ASC`
          )
          .all() as MagicBallEventRow[]);

    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO api_access_log (requested_at, since_cursor, events_returned)
       VALUES (?, ?, ?)`
    ).run(
      now,
      sinceValue,
      rows.length
    );

    return rows.map((r) => rowToEventResponse(r));
  });

  app.get<{
    Params: { id: string };
  }>("/events/:id", (request, reply) => {
    const row = db
      .prepare(`SELECT * FROM events WHERE id = ?`)
      .get(request.params.id) as MagicBallEventRow | undefined;
    if (!row) {
      return reply.status(404).send({ error: "Event not found" });
    }
    return rowToEventResponse(row);
  });
};
