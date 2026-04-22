import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { resolve } from "node:path";
import {
  createAppMetaTable,
  createGatewayLogTable,
  createNotificationLogTable,
  createProcessedSignalsTable,
  createUsersTable,
} from "../src/db/schema.js";

function parseArgs(): { db: string } {
  const argv = process.argv.slice(2);
  let db =
    process.env["NOTIF_GW_DB_PATH"] && process.env["NOTIF_GW_DB_PATH"].length > 0
      ? process.env["NOTIF_GW_DB_PATH"]!
      : "./notifgw.db";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--db" && argv[i + 1]) {
      db = argv[++i] ?? db;
    }
  }
  return { db: resolve(db) };
}

const SEED_USERS: Array<{
  user_id: string;
  name: string;
  email: string | null;
  slack_channel: string | null;
  severity_threshold: string;
  channels: string;
  role: string;
  event_categories: string;
}> = [
  {
    user_id: "usr-001",
    name: "Alice",
    email: "alice@example.com",
    slack_channel: null,
    severity_threshold: "low",
    channels: JSON.stringify(["email"]),
    role: "admin",
    event_categories: JSON.stringify([
      "breaking_news",
      "market_movement",
      "natural_disaster",
    ]),
  },
  {
    user_id: "usr-002",
    name: "Bob",
    email: null,
    slack_channel: "#alerts-bob",
    severity_threshold: "medium",
    channels: JSON.stringify(["slack"]),
    role: "user",
    event_categories: JSON.stringify([
      "breaking_news",
      "market_movement",
      "natural_disaster",
    ]),
  },
  {
    user_id: "usr-003",
    name: "Carol",
    email: "carol@example.com",
    slack_channel: "#alerts-carol",
    severity_threshold: "high",
    channels: JSON.stringify(["email", "slack"]),
    role: "user",
    event_categories: JSON.stringify([
      "breaking_news",
      "market_movement",
      "natural_disaster",
    ]),
  },
  {
    user_id: "usr-004",
    name: "Dave",
    email: "dave@example.com",
    slack_channel: null,
    severity_threshold: "critical",
    channels: JSON.stringify(["email"]),
    role: "user",
    event_categories: JSON.stringify([
      "breaking_news",
      "market_movement",
      "natural_disaster",
    ]),
  },
  {
    user_id: "usr-005",
    name: "Eve",
    email: null,
    slack_channel: "#alerts-eve",
    severity_threshold: "medium",
    channels: JSON.stringify(["slack"]),
    role: "admin",
    event_categories: JSON.stringify([
      "breaking_news",
      "market_movement",
      "natural_disaster",
    ]),
  },
];

/** Dev-only: same plaintext for all seeded users (see .env.example). */
const DEV_PASSWORD = "devpassword";

function main(): void {
  const { db: dbPath } = parseArgs();
  const database = new Database(dbPath);
  database.pragma("journal_mode = WAL");
  database.exec(createUsersTable);
  database.exec(createNotificationLogTable);
  database.exec(createProcessedSignalsTable);
  database.exec(createGatewayLogTable);
  database.exec(createAppMetaTable);

  const hash = bcrypt.hashSync(DEV_PASSWORD, 10);
  const now = new Date().toISOString();
  const ins = database.prepare(
    `INSERT OR REPLACE INTO users (
      user_id, name, email, slack_channel, severity_threshold, channels, role,
      password_hash, event_categories, created_at, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );

  const run = database.transaction(() => {
    for (const u of SEED_USERS) {
      ins.run(
        u.user_id,
        u.name,
        u.email,
        u.slack_channel,
        u.severity_threshold,
        u.channels,
        u.role,
        hash,
        u.event_categories,
        now
      );
    }
  });
  run();

  // eslint-disable-next-line no-console -- CLI
  console.log(
    JSON.stringify({ ok: true, path: dbPath, users: SEED_USERS.length }, null, 2)
  );
  database.close();
}

main();
