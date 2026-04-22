import type { Redis } from "ioredis";
import { Redis as RedisClass } from "ioredis";

let redis: Redis | undefined;

export const STREAM_INGESTED = "events:ingested";
export const STREAM_NOTIFICATION = "events:notification_signal";
export const CONSUMER_GROUP = "intelligence-pipeline";

/**
 * fail-loud: no offline queue (matches data-scout intent for stream emits)
 */
export function getRedis(url: string): Redis {
  if (redis) return redis;
  redis = new RedisClass(url, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: null,
  });
  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = undefined;
  }
}
