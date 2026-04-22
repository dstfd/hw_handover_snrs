import Database from "better-sqlite3";
import { resolve } from "node:path";

function parseArgs(): string {
  const argv = process.argv.slice(2);
  let dbPath: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--db" && argv[i + 1]) {
      dbPath = argv[++i];
    }
  }
  if (!dbPath) {
    console.error("Usage: tsx scripts/reset.ts --db <path-to-db-file>");
    process.exit(1);
  }
  return resolve(dbPath);
}

function main(): void {
  const path = parseArgs();
  const db = new Database(path);
  const run = db.transaction(() => {
    const e1 = db
      .prepare(
        `UPDATE events SET is_available = 0, made_available_at = NULL`
      )
      .run();
    const e2 = db.prepare(`DELETE FROM publish_log`).run();
    const e3 = db.prepare(`DELETE FROM api_access_log`).run();
    const e4 = db
      .prepare(
        `UPDATE publish_controls SET
         publish_enabled = 1,
         interval_min_seconds = 300,
         interval_max_seconds = 900,
         category_filter = NULL,
         min_severity_filter = NULL,
         manual_mode = 0
         WHERE id = 1`
      )
      .run();
    // eslint-disable-next-line no-console -- CLI output
    console.log(
      JSON.stringify(
        {
          ok: true,
          path,
          events_reset: e1.changes,
          publish_log_deleted: e2.changes,
          api_access_log_deleted: e3.changes,
          publish_controls_reset: e4.changes,
        },
        null,
        2
      )
    );
  });
  run();
  db.close();
}

main();
