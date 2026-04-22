import type { Database } from "better-sqlite3";

export function insertGatewayLog(
  db: Database,
  entry: {
    level: "info" | "warn" | "error" | "debug";
    event_id: string | null;
    source: string;
    message: string;
  }
): void {
  const logged_at = new Date().toISOString();
  db.prepare(
    `INSERT INTO gateway_operational_log (logged_at, level, event_id, source, message)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    logged_at,
    entry.level,
    entry.event_id,
    entry.source,
    entry.message
  );
}
