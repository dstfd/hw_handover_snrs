import Database from "better-sqlite3";
import {
  createAppMetaTable,
  createGatewayLogTable,
  createNotificationLogTable,
  createProcessedSignalsTable,
  createUsersTable,
} from "./schema.js";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const path = process.env["NOTIF_GW_DB_PATH"] ?? "./notifgw.db";
  _db = new Database(path);
  _db.pragma("journal_mode = WAL");
  _db.exec(createUsersTable);
  _db.exec(createNotificationLogTable);
  _db.exec(createProcessedSignalsTable);
  _db.exec(createGatewayLogTable);
  _db.exec(createAppMetaTable);
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
