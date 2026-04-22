import { getDb, closeDb } from "./db/client.js";
import { getRedis, closeRedis } from "./services/redisClient.js";
import { buildApp } from "./app.js";
import { startPollWorker } from "./services/pollWorker.js";

const portRaw = process.env["DATASCOUT_PORT"] ?? "4101";
const port = Number(portRaw);
if (!Number.isFinite(port) || port < 1) {
  throw new Error("DATASCOUT_PORT must be a positive number");
}

const db = getDb();
const redis = getRedis();
const app = await buildApp(db);
const worker = startPollWorker(db, redis, app.log);

const shutdown = async (signal: string) => {
  app.log.info({ msg: "shutdown", signal });
  worker.stop();
  await app.close();
  await closeRedis();
  closeDb();
  process.exit(0);
};

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

try {
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info({ msg: "data-scout listening", port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
