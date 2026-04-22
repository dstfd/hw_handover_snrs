import type { MagicBallEventRow, MagicBallEventResponse } from "../types.js";

export function rowToEventResponse(row: MagicBallEventRow): MagicBallEventResponse {
  let tags: string[];
  try {
    const p = JSON.parse(row.tags) as unknown;
    tags = Array.isArray(p) && p.every((t) => typeof t === "string")
      ? (p as string[])
      : [];
  } catch {
    tags = [];
  }
  return {
    ...row,
    tags,
  };
}

export function isValidIso8601(s: string): boolean {
  return s.length > 0 && !Number.isNaN(Date.parse(s));
}
