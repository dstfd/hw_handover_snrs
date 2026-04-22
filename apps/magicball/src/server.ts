import { getDb, closeDb } from "./db/client.js";
import { buildApp } from "./app.js";
import { startPublishRoutine } from "./services/publishRoutine.js";

const portRaw = process.env["MAGICBALL_PORT"] ?? "4100";
const port = Number(portRaw);
if (!Number.isFinite(port) || port < 1) {
  throw new Error("MAGICBALL_PORT must be a positive number");
}

const db = getDb();
const app = await buildApp(db);
const routine = startPublishRoutine(db, app.log);

const shutdown = async (signal: string) => {
  app.log.info({ msg: "shutdown", signal });
  routine.stop();
  await app.close();
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
  app.log.info({ msg: "magicball listening", port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
