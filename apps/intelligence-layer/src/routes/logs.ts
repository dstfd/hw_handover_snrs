import type { FastifyPluginAsync } from "fastify";
import type { Db } from "mongodb";
import { aiLogsCollection, findAiLogs } from "../repositories/aiLogsRepo.js";
import type { AiLogDoc, IntelLogEntry } from "../types.js";

function aiDocToLogEntry(doc: AiLogDoc): IntelLogEntry {
  const level: IntelLogEntry["level"] =
    doc.status === "failed" ? "error" : "info";
  const msg =
    doc.status === "failed" && doc.error
      ? `${doc.step} failed: ${doc.error}`
      : `${doc.step} (${doc.model})`;
  return {
    timestamp: doc.called_at,
    service: "intelligence-layer",
    level,
    event_id: doc.event_id,
    source: "ai_logs",
    message: msg,
  };
}

export const logsPlugin: FastifyPluginAsync<{ db: Db }> = async (app, opts) => {
  const { db } = opts;
  const col = aiLogsCollection(db);

  app.get<{
    Querystring: {
      level?: string;
      event_id?: string;
      page?: string;
      limit?: string;
    };
  }>("/logs", async (request) => {
    const page = Math.max(1, Math.floor(Number(request.query.page ?? "1")) || 1);
    const limitRaw = Math.floor(Number(request.query.limit ?? "50")) || 50;
    const limit = Math.min(200, Math.max(1, limitRaw));
    const event_id = request.query.event_id;
    const level = request.query.level as "error" | "warn" | "info" | "debug" | undefined;

    const logOpts: {
      event_id?: string;
      level?: "error" | "warn" | "info" | "debug";
      page: number;
      limit: number;
    } = { page, limit };
    if (event_id !== undefined) logOpts.event_id = event_id;
    if (level !== undefined) logOpts.level = level;
    const { data: rawDocs, total } = await findAiLogs(col, logOpts);

    const data: IntelLogEntry[] = rawDocs.map(aiDocToLogEntry);

    return { data, page, limit, total };
  });
};
