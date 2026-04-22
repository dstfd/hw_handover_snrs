import { Redis } from "ioredis";

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (_redis) return _redis;
  const url = process.env["REDIS_URL"] ?? "redis://localhost:6379";
  // enableOfflineQueue: false → XADD throws immediately if disconnected.
  // Emit failures are caught per-event in pollWorker; emitted_at stays null.
  _redis = new Redis(url, { enableOfflineQueue: false });
  return _redis;
}

export async function closeRedis(): Promise<void> {
  if (_redis) {
    const r = _redis;
    _redis = null;
    await r.quit();
  }
}
