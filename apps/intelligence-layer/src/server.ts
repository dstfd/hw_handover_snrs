import { loadConfig, resolveManifestPath } from "./services/config.js";
import { connectMongo, closeMongo } from "./db/mongoClient.js";
import { getRedis, closeRedis } from "./services/redisClient.js";
import { ensureIndexes } from "./db/collections.js";
import { loadManifest, createGeminiConnector } from "./services/geminiConnector.js";
import { aiLogsCollection } from "./repositories/aiLogsRepo.js";
import { buildApp } from "./app.js";
import { startIngestedStreamWorker } from "./services/streamConsumer.js";
import type { StreamWorkerHandle } from "./services/streamConsumer.js";

const config = loadConfig();
const manifest = await loadManifest(resolveManifestPath(config.geminiManifestPath));

const db = await connectMongo(config.intelMongoUri, config.intelMongoDb);
await ensureIndexes(db);
const gemini = createGeminiConnector({
  manifest,
  apiKey: config.geminiApiKey,
  aiLogs: aiLogsCollection(db),
});
const redis = getRedis(config.redisUrl);

let streamWorker: StreamWorkerHandle | undefined;

const app = await buildApp({
  db,
  config,
  gemini,
  redis,
  getLastStreamOutcome: () => streamWorker?.getLastOutcome(),
});

streamWorker = startIngestedStreamWorker({
  config,
  db,
  gemini,
  redis,
  log: {
    info: (o) => {
      app.log.info(o);
    },
    error: (o) => {
      app.log.error(o);
    },
  },
});

const port = Number(process.env["INTEL_PORT"] ?? "4102");
if (!Number.isFinite(port) || port < 1) {
  throw new Error("INTEL_PORT must be a positive number");
}

const shutdown = async (signal: string) => {
  app.log.info({ msg: "shutdown", signal });
  streamWorker?.stop();
  await app.close();
  await closeRedis();
  await closeMongo();
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
  app.log.info({ msg: "intelligence-layer listening", port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
