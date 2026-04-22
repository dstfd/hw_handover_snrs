import Database from "better-sqlite3";
import { resolve } from "node:path";

function parseArgs(): { db: string; full: boolean } {
  const argv = process.argv.slice(2);
  let dbPath: string | undefined;
  let full = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--db" && argv[i + 1]) {
      dbPath = argv[++i];
    } else if (argv[i] === "--full") {
      full = true;
    }
  }
  if (!dbPath) {
    console.error("Usage: tsx scripts/reset.ts --db <path> [--full]");
    console.error("  Default wipe: notification_log, processed_signals, gateway_operational_log");
    console.error("  --full: also DELETE users (re-run seed after)");
    process.exit(1);
  }
  return { db: resolve(dbPath), full };
}

function main(): void {
  const { db, full } = parseArgs();
  const database = new Database(db);
  const run = database.transaction(() => {
    const n1 = database.prepare(`DELETE FROM notification_log`).run();
    const n2 = database.prepare(`DELETE FROM processed_signals`).run();
    const n3 = database.prepare(`DELETE FROM gateway_operational_log`).run();
    let usersDeleted = 0;
    if (full) {
      usersDeleted = database.prepare(`DELETE FROM users`).run().changes;
    }
    // eslint-disable-next-line no-console -- CLI
    console.log(
      JSON.stringify(
        {
          ok: true,
          path: db,
          notification_log_deleted: n1.changes,
          processed_signals_deleted: n2.changes,
          gateway_log_deleted: n3.changes,
          users_deleted: full ? usersDeleted : 0,
        },
        null,
        2
      )
    );
  });
  run();
  database.close();
}

main();
