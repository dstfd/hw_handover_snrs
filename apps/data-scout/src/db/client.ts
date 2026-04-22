import Database from "better-sqlite3";
import {
  createEventOpsLogTable,
  createIngestedEventsTable,
  createPollLogTable,
  createPollStateTable,
  seedPollState,
} from "./schema.js";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const path = process.env["DATASCOUT_DB_PATH"] ?? "./datascout.db";
  _db = new Database(path);
  _db.pragma("journal_mode = WAL");
  _db.exec(createIngestedEventsTable);
  _db.exec(createPollStateTable);
  _db.exec(createPollLogTable);
  _db.exec(createEventOpsLogTable);
  _db.exec(seedPollState);
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
