import cors from "@fastify/cors";
import type { Database } from "better-sqlite3";
import type { Redis } from "ioredis";
import Fastify from "fastify";
import type { NotifGwConfig } from "./services/config.js";
import { adminPlugin } from "./routes/admin.js";
import { authPlugin } from "./routes/auth.js";
import { healthPlugin } from "./routes/health.js";
import { logsPlugin } from "./routes/logs.js";
import { usersPlugin } from "./routes/users.js";

export async function buildApp(opts: {
  db: Database;
  redis: Redis;
  config: NotifGwConfig;
}) {
  const app = Fastify({ logger: { level: "info" } });
  await app.register(cors, { origin: true });
  await app.register(authPlugin, { db: opts.db, config: opts.config });
  await app.register(usersPlugin, { db: opts.db, config: opts.config });
  await app.register(healthPlugin, { db: opts.db, redis: opts.redis });
  await app.register(adminPlugin, { db: opts.db, config: opts.config });
  await app.register(logsPlugin, { db: opts.db });
  return app;
}
