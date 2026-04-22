import type { Redis } from "ioredis";
import { STREAM_NOTIFICATION } from "./redisClient.js";

export async function emitNotificationSignal(
  redis: Redis,
  event_id: string,
  relevance_matching_ref: string,
  emitted_at: string
): Promise<string> {
  const id = await redis.xadd(
    STREAM_NOTIFICATION,
    "*",
    "event_id",
    event_id,
    "relevance_matching_ref",
    relevance_matching_ref,
    "emitted_at",
    emitted_at
  );
  if (!id) throw new Error("Redis XADD returned null for notification signal");
  return id;
}
