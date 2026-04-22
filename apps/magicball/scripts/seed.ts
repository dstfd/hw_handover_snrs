import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DatasetEvent } from "../src/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(): { db: string; data: string } {
  const argv = process.argv.slice(2);
  const defaultData = join(
    __dirname,
    "../../../Temp/dataset_magicball/world_events_test_dataset.json"
  );
  let db =
    process.env["MAGICBALL_DB_PATH"] && process.env["MAGICBALL_DB_PATH"].length > 0
      ? process.env["MAGICBALL_DB_PATH"]!
      : "./magicball.db";
  let data = defaultData;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--db" && argv[i + 1]) {
      db = argv[++i] ?? db;
    } else if (argv[i] === "--data" && argv[i + 1]) {
      data = resolve(argv[++i] ?? data);
    }
  }
  return { db: resolve(db), data: resolve(data) };
}

async function main(): Promise<void> {
  const { db, data } = parseArgs();
  process.env["MAGICBALL_DB_PATH"] = db;
  const { getDb } = await import("../src/db/client.js");
  const database = getDb();
  const raw = readFileSync(data, "utf-8");
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Dataset must be a JSON array");
  }
  const events = parsed as DatasetEvent[];
  const sorted = [...events].sort(
    (a, b) => Date.parse(a.published_at) - Date.parse(b.published_at)
  );

  const insert = database.prepare(
    `INSERT OR IGNORE INTO events (
      id, category, headline, summary, severity, geographic_scope,
      location_country, location_region, source_reliability, status,
      affected_population_estimate, economic_impact_usd,
      casualties_confirmed, casualties_estimated, tags, original_published_at,
      queue_position, is_available, made_available_at
    ) VALUES (
      @id, @category, @headline, @summary, @severity, @geographic_scope,
      @location_country, @location_region, @source_reliability, @status,
      @affected_population_estimate, @economic_impact_usd,
      @casualties_confirmed, @casualties_estimated, @tags, @original_published_at,
      @queue_position, @is_available, @made_available_at
    )`
  );

  let inserted = 0;
  let skipped = 0;
  for (let i = 0; i < sorted.length; i++) {
    const event = sorted[i]!;
    const result = insert.run({
      id: event.id,
      category: event.category,
      headline: event.headline,
      summary: event.summary,
      severity: event.severity,
      geographic_scope: event.geographic_scope,
      location_country: event.location.country,
      location_region: event.location.region ?? null,
      source_reliability: event.source_reliability,
      status: event.status,
      affected_population_estimate: event.affected_population_estimate ?? null,
      economic_impact_usd: event.economic_impact_usd ?? null,
      casualties_confirmed: event.casualties.confirmed ?? null,
      casualties_estimated: event.casualties.estimated ?? null,
      tags: JSON.stringify(event.tags),
      original_published_at: event.published_at,
      queue_position: i + 1,
      is_available: 0,
      made_available_at: null,
    });
    if (result.changes > 0) inserted += 1;
    else skipped += 1;
  }
  // eslint-disable-next-line no-console -- CLI output
  console.log(
    JSON.stringify(
      {
        ok: true,
        db,
        data,
        total: sorted.length,
        inserted,
        ignored_duplicate: skipped,
      },
      null,
      2
    )
  );
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
