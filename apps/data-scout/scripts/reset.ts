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
    const e1 = db.prepare(`DELETE FROM ingested_events`).run();
    const e2 = db.prepare(`DELETE FROM poll_log`).run();
    const e1b = db.prepare(`DELETE FROM event_ops_log`).run();
    const e3 = db
      .prepare(
        `UPDATE poll_state SET
         last_successful_poll_at = NULL,
         last_poll_attempted_at  = NULL
         WHERE id = 1`
      )
      .run();
    // eslint-disable-next-line no-console -- CLI output
    console.log(
      JSON.stringify(
        {
          ok: true,
          path,
          ingested_events_deleted: e1.changes,
          poll_log_deleted: e2.changes,
          event_ops_log_deleted: e1b.changes,
          poll_state_reset: e3.changes,
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
