import type { Database } from "better-sqlite3";
import type { FastifyPluginAsync } from "fastify";
import type { NotifGwConfig } from "../services/config.js";
import { verifyToken } from "../services/authJwt.js";
import {
  findUserById,
  listAllActiveUsers,
  listUsersForRelevance,
  rowToPublic,
} from "../services/userQueries.js";

const ALLOWED_CATEGORIES = new Set([
  "breaking_news",
  "market_movement",
  "natural_disaster",
]);

function bearerToken(authorization: string | undefined): string | null {
  const h = authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  return h.slice("Bearer ".length).trim();
}

function requireUser(
  config: NotifGwConfig,
  authorization: string | undefined
): {
  user_id: string;
  role: "user" | "admin";
} {
  const t = bearerToken(authorization);
  if (!t) throw new Error("UNAUTHORIZED");
  const p = verifyToken(config, t);
  return { user_id: p.user_id, role: p.role };
}

export const usersPlugin: FastifyPluginAsync<{
  db: Database;
  config: NotifGwConfig;
}> = async (app, opts) => {
  const { db, config } = opts;

  app.get("/users/me", async (request, reply) => {
    let auth: { user_id: string; role: "user" | "admin" };
    try {
      auth = requireUser(config, request.headers.authorization);
    } catch {
      return reply.status(401).send({ error: "unauthorized" });
    }
    const row = findUserById(db, auth.user_id);
    if (!row || row.is_active !== 1) {
      return reply.status(404).send({ error: "user not found" });
    }
    return rowToPublic(row);
  });

  app.patch<{
    Body: Partial<{
      event_categories: string[];
      severity_threshold: string;
      channels: string[];
    }>;
  }>("/users/me/preferences", async (request, reply) => {
    let auth: { user_id: string };
    try {
      auth = requireUser(config, request.headers.authorization);
    } catch {
      return reply.status(401).send({ error: "unauthorized" });
    }
    const row = findUserById(db, auth.user_id);
    if (!row || row.is_active !== 1) {
      return reply.status(404).send({ error: "user not found" });
    }
    const body = request.body;
    const updates: string[] = [];
    const vals: unknown[] = [];

    if (body.event_categories !== undefined) {
      if (!Array.isArray(body.event_categories)) {
        return reply.status(400).send({ error: "event_categories must be an array" });
      }
      for (const c of body.event_categories) {
        if (typeof c !== "string" || !ALLOWED_CATEGORIES.has(c)) {
          return reply.status(400).send({ error: `invalid category: ${String(c)}` });
        }
      }
      updates.push(`event_categories = ?`);
      vals.push(JSON.stringify(body.event_categories));
    }
    if (body.severity_threshold !== undefined) {
      if (
        typeof body.severity_threshold !== "string" ||
        !["low", "medium", "high", "critical"].includes(body.severity_threshold)
      ) {
        return reply.status(400).send({ error: "invalid severity_threshold" });
      }
      updates.push(`severity_threshold = ?`);
      vals.push(body.severity_threshold);
    }
    if (body.channels !== undefined) {
      if (!Array.isArray(body.channels)) {
        return reply.status(400).send({ error: "channels must be an array" });
      }
      for (const ch of body.channels) {
        if (ch !== "email" && ch !== "slack") {
          return reply.status(400).send({ error: `invalid channel: ${String(ch)}` });
        }
      }
      updates.push(`channels = ?`);
      vals.push(JSON.stringify(body.channels));
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: "no valid fields to update" });
    }

    vals.push(auth.user_id);
    db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE user_id = ?`).run(
      ...vals
    );
    const updated = findUserById(db, auth.user_id);
    if (!updated) {
      return reply.status(500).send({ error: "update failed" });
    }
    return rowToPublic(updated);
  });

  app.get<{ Querystring: { min_severity?: string; category?: string } }>(
    "/users",
    async (request, reply) => {
      const { min_severity, category } = request.query;

      if (min_severity !== undefined || category !== undefined) {
        if (
          typeof min_severity !== "string" ||
          typeof category !== "string" ||
          min_severity === "" ||
          category === ""
        ) {
          return reply
            .status(400)
            .send({ error: "min_severity and category are both required for internal lookup" });
        }
        if (!ALLOWED_CATEGORIES.has(category)) {
          return reply.status(400).send({ error: "invalid category" });
        }
        try {
          const users = listUsersForRelevance(db, min_severity, category);
          return users;
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          return reply.status(400).send({ error: m });
        }
      }

      try {
        const auth = requireUser(config, request.headers.authorization);
        if (auth.role !== "admin") {
          return reply.status(403).send({ error: "admin role required" });
        }
      } catch {
        return reply.status(401).send({ error: "unauthorized" });
      }

      return { users: listAllActiveUsers(db) };
    }
  );

  app.get<{ Params: { user_id: string } }>(
    "/users/:user_id",
    async (request, reply) => {
      try {
        const auth = requireUser(config, request.headers.authorization);
        if (auth.role !== "admin") {
          return reply.status(403).send({ error: "admin role required" });
        }
      } catch {
        return reply.status(401).send({ error: "unauthorized" });
      }
      const row = findUserById(db, request.params.user_id);
      if (!row) {
        return reply.status(404).send({ error: "user not found" });
      }
      return rowToPublic(row);
    }
  );
};
