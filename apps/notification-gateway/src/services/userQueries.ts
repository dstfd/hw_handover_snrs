import type { Database } from "better-sqlite3";
import type { RelevanceUserResponse, UserPublic, UserRow } from "../types.js";
import { userMatchesEventSeverity } from "./severity.js";

export function rowToPublic(row: UserRow): UserPublic {
  let channels: string[];
  let categories: string[];
  try {
    channels = JSON.parse(row.channels) as string[];
  } catch {
    channels = [];
  }
  try {
    categories = JSON.parse(row.event_categories) as string[];
  } catch {
    categories = [];
  }
  return {
    user_id: row.user_id,
    name: row.name,
    email: row.email,
    slack_channel: row.slack_channel,
    severity_threshold: row.severity_threshold,
    channels,
    role: row.role === "admin" ? "admin" : "user",
    event_categories: categories,
    created_at: row.created_at,
    is_active: row.is_active === 1,
  };
}

export function findUserByEmail(
  db: Database,
  email: string
): UserRow | undefined {
  return db
    .prepare(`SELECT * FROM users WHERE lower(email) = lower(?) AND is_active = 1`)
    .get(email) as UserRow | undefined;
}

export function findUserById(
  db: Database,
  user_id: string
): UserRow | undefined {
  return db
    .prepare(`SELECT * FROM users WHERE user_id = ?`)
    .get(user_id) as UserRow | undefined;
}

export function listUsersForRelevance(
  db: Database,
  min_severity: string,
  category: string
): RelevanceUserResponse[] {
  const rows = db
    .prepare(`SELECT * FROM users WHERE is_active = 1`)
    .all() as UserRow[];

  const out: RelevanceUserResponse[] = [];
  for (const row of rows) {
    if (!userMatchesEventSeverity(row.severity_threshold, min_severity)) {
      continue;
    }
    let categories: string[];
    try {
      categories = JSON.parse(row.event_categories) as string[];
    } catch {
      continue;
    }
    if (!categories.includes(category)) {
      continue;
    }
    let channels: string[];
    try {
      channels = JSON.parse(row.channels) as string[];
    } catch {
      channels = [];
    }
    out.push({
      user_id: row.user_id,
      name: row.name,
      channels,
      severity_threshold: row.severity_threshold,
    });
  }
  return out;
}

export function listAllActiveUsers(db: Database): UserPublic[] {
  const rows = db
    .prepare(`SELECT * FROM users WHERE is_active = 1 ORDER BY user_id`)
    .all() as UserRow[];
  return rows.map(rowToPublic);
}
