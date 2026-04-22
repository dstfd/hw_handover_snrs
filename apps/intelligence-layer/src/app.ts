import cors from "@fastify/cors";
import type { Db } from "mongodb";
import type { Redis } from "ioredis";
import Fastify from "fastify";
import { healthPlugin } from "./routes/health.js";
import { logsPlugin } from "./routes/logs.js";
import { pipelinePlugin } from "./routes/pipeline.js";
import type { IntelConfig } from "./services/config.js";
import type { createGeminiConnector } from "./services/geminiConnector.js";

type Gemini = ReturnType<typeof createGeminiConnector>;

export async function buildApp(opts: {
  db: Db;
  config: IntelConfig;
  gemini: Gemini;
  redis: Redis;
  getLastStreamOutcome: () => { event_id: string; outcome: string } | undefined;
}) {
  const app = Fastify({ logger: { level: "info" } });
  await app.register(cors, { origin: true });
  await app.register(healthPlugin, {
    db: opts.db,
    service: "intelligence-layer",
    getLastStreamOutcome: opts.getLastStreamOutcome,
  });
  await app.register(logsPlugin, { db: opts.db });
  await app.register(pipelinePlugin, {
    db: opts.db,
    config: opts.config,
    gemini: opts.gemini,
    redis: opts.redis,
  });
  return app;
}
