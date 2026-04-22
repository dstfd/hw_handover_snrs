import cors from "@fastify/cors";
import type { Database } from "better-sqlite3";
import Fastify from "fastify";
import { adminPlugin } from "./routes/admin.js";
import { eventsPlugin } from "./routes/events.js";
import { healthPlugin } from "./routes/health.js";
import { logsPlugin } from "./routes/logs.js";

export async function buildApp(db: Database) {
  const app = Fastify({ logger: { level: "info" } });
  await app.register(cors, { origin: true });
  await app.register(eventsPlugin, { db });
  await app.register(adminPlugin, { db });
  await app.register(healthPlugin, { db });
  await app.register(logsPlugin, { db });
  return app;
}
