import type { Database } from "better-sqlite3";
import type { Redis } from "ioredis";
import { CONSUMER_GROUP, STREAM_NOTIFICATION } from "./redisClient.js";
import type { NotifGwConfig } from "./config.js";
import {
  persistDeliveryAndSignal,
  planDeliveryLogRows,
} from "./deliveryOrchestrator.js";
import { insertGatewayLog } from "./gatewayLog.js";

const CONSUMER = "ngw-worker-1";

function fieldMap(fields: string[]): Record<string, string> {
  const o: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    o[fields[i] ?? ""] = fields[i + 1] ?? "";
  }
  return o;
}

export type NotificationWorkerHandle = {
  stop: () => void;
  getLastOutcome: () => { event_id: string; stream_id: string } | undefined;
};

export function startNotificationStreamWorker(deps: {
  db: Database;
  redis: Redis;
  config: NotifGwConfig;
  log: { info: (o: object) => void; error: (o: object) => void };
}): NotificationWorkerHandle {
  const { db, redis, config, log } = deps;
  let stop = false;
  let lastOutcome: { event_id: string; stream_id: string } | undefined;

  const loop = async (): Promise<void> => {
    while (!stop) {
      try {
        await redis
          .xgroup("CREATE", STREAM_NOTIFICATION, CONSUMER_GROUP, "0", "MKSTREAM")
          .catch((e: unknown) => {
            if (String(e).includes("BUSYGROUP")) return;
            throw e;
          });
        const resUnknown: unknown = await redis.xreadgroup(
          "GROUP",
          CONSUMER_GROUP,
          CONSUMER,
          "COUNT",
          1,
          "BLOCK",
          10_000,
          "STREAMS",
          STREAM_NOTIFICATION,
          ">"
        );
        if (!Array.isArray(resUnknown) || resUnknown.length === 0) {
          continue;
        }
        const entry = resUnknown[0] as unknown;
        if (!Array.isArray(entry) || entry.length < 2) continue;
        const stream = entry[0] as string;
        const messages = entry[1] as unknown;
        if (stream !== STREAM_NOTIFICATION) continue;
        if (!Array.isArray(messages) || messages.length === 0) continue;
        for (const msg of messages as [string, string[]][]) {
          const streamId = msg[0];
          const fieldList = msg[1];
          if (typeof streamId !== "string" || !Array.isArray(fieldList)) continue;
          const fields = fieldMap(fieldList);
          const event_id = fields["event_id"];
          if (!event_id) {
            log.error({ msg: "notification stream missing event_id", streamId });
            await redis.xack(STREAM_NOTIFICATION, CONSUMER_GROUP, streamId);
            continue;
          }

          const dup = db
            .prepare(
              `SELECT 1 FROM processed_signals WHERE stream_message_id = ?`
            )
            .get(streamId);
          if (dup) {
            await redis.xack(STREAM_NOTIFICATION, CONSUMER_GROUP, streamId);
            continue;
          }

          try {
            const rows = await planDeliveryLogRows(
              db,
              config.intelBaseUrl,
              event_id
            );
            const run = db.transaction(() => {
              persistDeliveryAndSignal(db, streamId, event_id, rows);
            });
            run();
            lastOutcome = { event_id, stream_id: streamId };
            log.info({
              msg: "notification signal processed",
              event_id,
              streamId,
              deliveries: rows.length,
            });
            await redis.xack(STREAM_NOTIFICATION, CONSUMER_GROUP, streamId);
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            log.error({ msg: "notification delivery failed", event_id, error: m });
            insertGatewayLog(db, {
              level: "error",
              event_id,
              source: "stream_consumer",
              message: m,
            });
            // Do not ACK — allow Redis to retry after operator fix.
          }
        }
      } catch (outer) {
        log.error({
          msg: "notification worker loop error",
          error: String(outer),
        });
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  };

  void loop();

  return {
    stop: () => {
      stop = true;
    },
    getLastOutcome: () => lastOutcome,
  };
}
