import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { createUsersTable } from "../../db/schema.js";
import { listUsersForRelevance } from "../userQueries.js";

describe("listUsersForRelevance", () => {
  it("returns users matching severity ordering and category", () => {
    const db = new Database(":memory:");
    db.exec(createUsersTable);
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (
        user_id, name, email, slack_channel, severity_threshold, channels, role,
        password_hash, event_categories, created_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    ).run(
      "u1",
      "A",
      "a@test.com",
      null,
      "low",
      '["email"]',
      "user",
      "x",
      '["breaking_news"]',
      now
    );
    db.prepare(
      `INSERT INTO users (
        user_id, name, email, slack_channel, severity_threshold, channels, role,
        password_hash, event_categories, created_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    ).run(
      "u2",
      "B",
      "b@test.com",
      null,
      "critical",
      '["email"]',
      "user",
      "x",
      '["breaking_news"]',
      now
    );

    const high = listUsersForRelevance(db, "high", "breaking_news");
    expect(high.map((u) => u.user_id)).toEqual(["u1"]);

    const critical = listUsersForRelevance(db, "critical", "breaking_news");
    expect(critical.map((u) => u.user_id).sort()).toEqual(["u1", "u2"]);
  });
});
