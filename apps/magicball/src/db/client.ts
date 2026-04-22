import Database from "better-sqlite3";
import {
  createApiAccessLog,
  createEventsTable,
  createPublishControls,
  createPublishLog,
  seedPublishControls,
} from "./schema.js";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const path = process.env["MAGICBALL_DB_PATH"] ?? "./magicball.db";
  _db = new Database(path);
  _db.pragma("journal_mode = WAL");
  _db.exec(createEventsTable);
  _db.exec(createPublishLog);
  _db.exec(createApiAccessLog);
  _db.exec(createPublishControls);
  _db.exec(seedPublishControls);
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
