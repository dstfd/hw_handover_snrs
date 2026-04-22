import { getDb, closeDb } from "./db/client.js";
import { buildApp } from "./app.js";
import { loadConfig } from "./services/config.js";
import { closeRedis, getRedis } from "./services/redisClient.js";
import { startNotificationStreamWorker } from "./services/streamConsumer.js";
import { insertGatewayLog } from "./services/gatewayLog.js";

const config = loadConfig();
const db = getDb();
const redis = getRedis(config.redisUrl);
const app = await buildApp({ db, redis, config });

const worker = startNotificationStreamWorker({ db, redis, config, log: app.log });
insertGatewayLog(db, {
  level: "info",
  event_id: null,
  source: "server",
  message: "notification-gateway stream worker started",
});

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
  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info({
    msg: "notification-gateway listening",
    port: config.port,
    host: "0.0.0.0",
  });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
