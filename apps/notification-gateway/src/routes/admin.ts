import type { Database } from "better-sqlite3";
import type { FastifyPluginAsync } from "fastify";
import type { NotifGwConfig } from "../services/config.js";
import { verifyToken } from "../services/authJwt.js";

type UnifiedLogEntry = {
  timestamp: string;
  service: string;
  level: string;
  event_id: string | null;
  source: string;
  message: string;
};

function bearerToken(authorization: string | undefined): string | null {
  const h = authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  return h.slice("Bearer ".length).trim();
}

function requireAdmin(
  config: NotifGwConfig,
  authorization: string | undefined
): void {
  const t = bearerToken(authorization);
  if (!t) throw new Error("UNAUTHORIZED");
  const p = verifyToken(config, t);
  if (p.role !== "admin") throw new Error("FORBIDDEN");
}

async function fetchLogsPage(
  baseUrl: string,
  qs: URLSearchParams
): Promise<{ data: unknown[]; total: number }> {
  const url = `${baseUrl.replace(/\/$/, "")}/logs?${qs.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${url} -> ${res.status}`);
  }
  const body = (await res.json()) as {
    data?: unknown[];
    total?: number;
  };
  return {
    data: Array.isArray(body.data) ? body.data : [],
    total: typeof body.total === "number" ? body.total : 0,
  };
}

function normalizeEntry(raw: unknown, service: string): UnifiedLogEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const timestamp =
    (typeof o["timestamp"] === "string" && o["timestamp"]) ||
    (typeof o["called_at"] === "string" && o["called_at"]) ||
    null;
  if (!timestamp) return null;
  const level =
    typeof o["level"] === "string" ? o["level"] : "info";
  const event_id =
    typeof o["event_id"] === "string"
      ? o["event_id"]
      : o["event_id"] === null
        ? null
        : null;
  const source =
    typeof o["source"] === "string" ? o["source"] : "logs";
  const message =
    typeof o["message"] === "string"
      ? o["message"]
      : typeof o["step"] === "string"
        ? `ai_logs step=${o["step"]}`
        : JSON.stringify(raw).slice(0, 500);
  return {
    timestamp,
    service,
    level,
    event_id,
    source,
    message,
  };
}

export const adminPlugin: FastifyPluginAsync<{
  db: Database;
  config: NotifGwConfig;
}> = async (app, opts) => {
  void opts.db;
  const { config } = opts;

  app.get("/admin/health", async (request, reply) => {
    try {
      requireAdmin(config, request.headers.authorization);
    } catch (e) {
      const code = String(e) === "FORBIDDEN" ? 403 : 401;
      return reply.status(code).send({ error: "unauthorized" });
    }

    const bases = {
      magicball: config.magicballBaseUrl,
      "data-scout": config.datascoutBaseUrl,
      "intelligence-layer": config.intelBaseUrl,
      "notification-gateway": config.selfBaseUrl,
    } as const;

    const services: Array<{
      name: string;
      status: "up" | "down" | "degraded";
      detail: unknown;
    }> = [];

    for (const [name, base] of Object.entries(bases)) {
      try {
        const res = await fetch(`${base.replace(/\/$/, "")}/health`);
        const body = res.ok ? ((await res.json()) as unknown) : null;
        services.push({
          name,
          status: res.ok ? "up" : "down",
          detail: body,
        });
      } catch {
        services.push({ name, status: "down", detail: null });
      }
    }

    return { services, checked_at: new Date().toISOString() };
  });

  app.get<{
    Querystring: {
      service?: string;
      level?: string;
      event_id?: string;
      page?: string;
      limit?: string;
    };
  }>("/admin/logs", async (request, reply) => {
    try {
      requireAdmin(config, request.headers.authorization);
    } catch (e) {
      const code = String(e) === "FORBIDDEN" ? 403 : 401;
      return reply.status(code).send({ error: "unauthorized" });
    }

    const page = Math.max(1, Math.floor(Number(request.query.page ?? "1")) || 1);
    const limitRaw = Math.floor(Number(request.query.limit ?? "50")) || 50;
    const limit = Math.min(200, Math.max(1, limitRaw));
    const serviceFilter = request.query.service;
    const level = request.query.level ?? "";
    const event_id = request.query.event_id ?? "";

    const targets: Array<{ name: string; base: string }> = [];
    if (!serviceFilter || serviceFilter === "magicball") {
      targets.push({ name: "magicball", base: config.magicballBaseUrl });
    }
    if (!serviceFilter || serviceFilter === "data-scout") {
      targets.push({ name: "data-scout", base: config.datascoutBaseUrl });
    }
    if (!serviceFilter || serviceFilter === "intelligence-layer") {
      targets.push({ name: "intelligence-layer", base: config.intelBaseUrl });
    }
    if (!serviceFilter || serviceFilter === "notification-gateway") {
      targets.push({
        name: "notification-gateway",
        base: config.selfBaseUrl,
      });
    }

    const qs = new URLSearchParams();
    if (level) qs.set("level", level);
    if (event_id) qs.set("event_id", event_id);
    qs.set("page", "1");
    qs.set("limit", "500");

    const unified: UnifiedLogEntry[] = [];
    for (const t of targets) {
      try {
        const { data } = await fetchLogsPage(t.base, qs);
        for (const row of data) {
          const n = normalizeEntry(row, t.name);
          if (n) unified.push(n);
        }
      } catch {
        // omit failed upstream from merge; admin sees partial merge
      }
    }

    unified.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const total = unified.length;
    const offset = (page - 1) * limit;
    const data = unified.slice(offset, offset + limit);
    return { data, page, limit, total };
  });
};
