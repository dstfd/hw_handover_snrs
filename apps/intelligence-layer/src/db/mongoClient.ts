import type { Db, MongoClient } from "mongodb";

let client: MongoClient | undefined;
let db: Db | undefined;

export async function connectMongo(uri: string, dbName: string): Promise<Db> {
  if (db) return db;
  const { MongoClient: MC } = await import("mongodb");
  client = new MC(uri);
  await client.connect();
  db = client.db(dbName);
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error("MongoDB not connected");
  return db;
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = undefined;
    db = undefined;
  }
}
