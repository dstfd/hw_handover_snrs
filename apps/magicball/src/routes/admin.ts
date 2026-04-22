import type { Database } from "better-sqlite3";
import type { FastifyPluginAsync } from "fastify";
import type { PublishControls } from "../types.js";

const ALLOWED_CATEGORIES = new Set([
  "breaking_news",
  "market_movement",
  "natural_disaster",
]);
const ALLOWED_SEVERITY = new Set([
  "low",
  "medium",
  "high",
  "critical",
]);

function parseJsonArrayOrNull(s: string | null | undefined): string[] | null {
  if (s === null || s === undefined) return null;
  try {
    const v: unknown = JSON.parse(s);
    if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) {
      return null;
    }
    return v;
  } catch {
    return null;
  }
}

export const adminPlugin: FastifyPluginAsync<{
  db: Database;
}> = async (app, opts) => {
  const { db } = opts;

  app.get("/admin/controls", () => {
    const row = db
      .prepare(
        `SELECT id, publish_enabled, interval_min_seconds, interval_max_seconds,
                category_filter, min_severity_filter, manual_mode
           FROM publish_controls WHERE id = 1`
      )
      .get() as PublishControls | undefined;
    if (!row) {
      throw new Error("publish_controls missing");
    }
    return {
      ...row,
      category_filter: parseJsonArrayOrNull(row.category_filter),
    };
  });

  app.patch<{
    Body: Record<string, unknown>;
  }>("/admin/controls", (request, reply) => {
    const body = request.body ?? {};
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (body["publish_enabled"] !== undefined) {
      const v = body["publish_enabled"];
      if (v !== 0 && v !== 1 && v !== "0" && v !== "1") {
        return reply.status(400).send({ error: "publish_enabled must be 0 or 1" });
      }
      updates.push("publish_enabled = ?");
      values.push(Number(v) === 1 || v === 1 ? 1 : 0);
    }
    if (body["interval_min_seconds"] !== undefined) {
      const n = Number(body["interval_min_seconds"]);
      if (!Number.isFinite(n) || n < 1) {
        return reply.status(400).send({ error: "interval_min_seconds must be >= 1" });
      }
      updates.push("interval_min_seconds = ?");
      values.push(Math.floor(n));
    }
    if (body["interval_max_seconds"] !== undefined) {
      const n = Number(body["interval_max_seconds"]);
      if (!Number.isFinite(n) || n < 1) {
        return reply.status(400).send({ error: "interval_max_seconds must be >= 1" });
      }
      updates.push("interval_max_seconds = ?");
      values.push(Math.floor(n));
    }
    if (body["category_filter"] !== undefined) {
      const v = body["category_filter"];
      if (v === null) {
        updates.push("category_filter = ?");
        values.push(null);
      } else if (Array.isArray(v)) {
        for (const c of v) {
          if (typeof c !== "string" || !ALLOWED_CATEGORIES.has(c)) {
            return reply.status(400).send({ error: "invalid category_filter entry" });
          }
        }
        updates.push("category_filter = ?");
        values.push(JSON.stringify(v));
      } else {
        return reply
          .status(400)
          .send({ error: "category_filter must be null or string[]" });
      }
    }
    if (body["min_severity_filter"] !== undefined) {
      const v = body["min_severity_filter"];
      if (v === null) {
        updates.push("min_severity_filter = ?");
        values.push(null);
      } else if (typeof v === "string" && ALLOWED_SEVERITY.has(v)) {
        updates.push("min_severity_filter = ?");
        values.push(v);
      } else {
        return reply
          .status(400)
          .send({ error: "min_severity_filter must be null or allowed severity" });
      }
    }
    if (body["manual_mode"] !== undefined) {
      const v = body["manual_mode"];
      if (v !== 0 && v !== 1 && v !== "0" && v !== "1") {
        return reply.status(400).send({ error: "manual_mode must be 0 or 1" });
      }
      updates.push("manual_mode = ?");
      values.push(Number(v) === 1 || v === 1 ? 1 : 0);
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: "No valid fields to patch" });
    }

    const before = db
      .prepare(
        `SELECT interval_min_seconds, interval_max_seconds FROM publish_controls WHERE id = 1`
      )
      .get() as {
      interval_min_seconds: number;
      interval_max_seconds: number;
    };
    let nextMin = before.interval_min_seconds;
    let nextMax = before.interval_max_seconds;
    if (body["interval_min_seconds"] !== undefined) {
      nextMin = Math.floor(Number(body["interval_min_seconds"]));
    }
    if (body["interval_max_seconds"] !== undefined) {
      nextMax = Math.floor(Number(body["interval_max_seconds"]));
    }
    if (nextMin > nextMax) {
      return reply
        .status(400)
        .send({ error: "interval_min_seconds must be <= interval_max_seconds" });
    }

    const sql = `UPDATE publish_controls SET ${updates.join(", ")} WHERE id = 1`;
    db.prepare(sql).run(...values);
    const row = db
      .prepare(
        `SELECT * FROM publish_controls WHERE id = 1`
      )
      .get() as PublishControls;
    return {
      ...row,
      category_filter: parseJsonArrayOrNull(row.category_filter),
    };
  });

  app.post<{
    Params: { id: string };
  }>("/admin/publish/:id", (request, reply) => {
    const id = request.params.id;
    const now = new Date().toISOString();
    const row = db.prepare(`SELECT id FROM events WHERE id = ?`).get(id) as
      | { id: string }
      | undefined;
    if (!row) {
      return reply.status(404).send({ error: "Event not found" });
    }
    const run = db.transaction(() => {
      db.prepare(
        `UPDATE events SET is_available = 1, made_available_at = ? WHERE id = ?`
      ).run(now, id);
      db.prepare(
        `INSERT INTO publish_log (event_id, published_at, interval_seconds_used)
         VALUES (?, ?, 0)`
      ).run(id, now);
    });
    run();
    return { ok: true, id, made_available_at: now };
  });

  app.get("/admin/queue", () => {
    const rows = db
      .prepare(
        `SELECT id, headline, queue_position, is_available, made_available_at, severity, category
           FROM events
          ORDER BY queue_position ASC`
      )
      .all();
    return rows;
  });
};
