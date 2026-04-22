import type { Database } from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { Redis as RedisClient } from "ioredis";
import type { MagicBallEventResponse } from "../types.js";

const STREAM_NAME = "events:ingested";

export type PollWorkerHandle = { stop: () => void };

export function startPollWorker(
  db: Database,
  redis: RedisClient,
  log: {
    info: (o: object) => void;
    warn: (o: object) => void;
    error: (o: object) => void;
  }
): PollWorkerHandle {
  const raw = process.env["POLL_INTERVAL_SEC"] ?? "300";
  const n = Number(raw);
  const intervalMs = Number.isFinite(n) && n >= 1 ? n * 1000 : 300_000;
  const magicballBase =
    process.env["MAGICBALL_BASE_URL"] ?? "http://localhost:4100";

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const schedule = (delayMs: number) => {
    if (stopped) return;
    timeoutId = setTimeout(() => {
      void tick();
    }, delayMs);
  };

  const tick = async (): Promise<void> => {
    if (stopped) return;
    const now = new Date().toISOString();

    const stateRow = db
      .prepare(`SELECT last_successful_poll_at FROM poll_state WHERE id = 1`)
      .get() as { last_successful_poll_at: string | null } | undefined;
    const cursor = stateRow?.last_successful_poll_at ?? null;

    db.prepare(
      `UPDATE poll_state SET last_poll_attempted_at = ? WHERE id = 1`
    ).run(now);

    const url = cursor
      ? `${magicballBase}/events?since=${encodeURIComponent(cursor)}`
      : `${magicballBase}/events`;

    let events: MagicBallEventResponse[];
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`MagicBall responded ${resp.status}`);
      }
      events = (await resp.json()) as MagicBallEventResponse[];
    } catch (err) {
      log.error({ msg: "poll failed", error: String(err), cursor });
      db.prepare(
        `INSERT INTO poll_log
         (polled_at, since_cursor, status, events_fetched,
          events_new, events_duplicate, events_emitted, error_message)
         VALUES (?, ?, 'error', 0, 0, 0, 0, ?)`
      ).run(now, cursor, String(err));
      schedule(intervalMs);
      return;
    }

    let eventsNew = 0;
    let eventsDuplicate = 0;
    let eventsEmitted = 0;

    for (const ev of events) {
      const dup = db
        .prepare(
          `SELECT 1 FROM ingested_events WHERE source_event_id = ? LIMIT 1`
        )
        .get(ev.id);
      if (dup) {
        eventsDuplicate += 1;
        continue;
      }

      const event_id = randomUUID();
      const ingested_at = new Date().toISOString();

      db.prepare(
        `INSERT INTO ingested_events (
          event_id, source_event_id, category, headline, summary, severity,
          geographic_scope, location_country, location_region, source_reliability,
          status, affected_population_estimate, economic_impact_usd,
          casualties_confirmed, casualties_estimated, tags,
          original_published_at, ingested_at, emitted_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL
        )`
      ).run(
        event_id,
        ev.id,
        ev.category,
        ev.headline,
        ev.summary,
        ev.severity,
        ev.geographic_scope,
        ev.location_country,
        ev.location_region ?? null,
        ev.source_reliability,
        ev.status,
        ev.affected_population_estimate ?? null,
        ev.economic_impact_usd ?? null,
        ev.casualties_confirmed ?? null,
        ev.casualties_estimated ?? null,
        JSON.stringify(ev.tags),
        ev.original_published_at,
        ingested_at
      );
      eventsNew += 1;
      log.info({ msg: "ingested event", event_id, source_event_id: ev.id });

      try {
        await redis.xadd(
          STREAM_NAME,
          "*",
          "event_id",
          event_id,
          "source_event_id",
          ev.id,
          "ingested_at",
          ingested_at
        );
        const emitted_at = new Date().toISOString();
        db.prepare(
          `UPDATE ingested_events SET emitted_at = ? WHERE event_id = ?`
        ).run(emitted_at, event_id);
        eventsEmitted += 1;
        log.info({ msg: "emitted to stream", event_id, stream: STREAM_NAME });
        db.prepare(
          `INSERT INTO event_ops_log (logged_at, level, event_id, source, message)
           VALUES (?, 'info', ?, 'ingest', ?)`
        ).run(
          emitted_at,
          event_id,
          `emitted to ${STREAM_NAME}`
        );
      } catch (emitErr) {
        // emitted_at stays NULL; visible via GET /events/:event_id
        log.error({
          msg: "redis emit failed",
          event_id,
          error: String(emitErr),
        });
        db.prepare(
          `INSERT INTO event_ops_log (logged_at, level, event_id, source, message)
           VALUES (?, 'error', ?, 'ingest', ?)`
        ).run(
          new Date().toISOString(),
          event_id,
          `redis emit failed: ${String(emitErr)}`
        );
      }
    }

    // Cursor advances on any non-error response (including empty)
    db.prepare(
      `UPDATE poll_state SET last_successful_poll_at = ? WHERE id = 1`
    ).run(now);

    const status = events.length === 0 ? "empty" : "success";
    db.prepare(
      `INSERT INTO poll_log
       (polled_at, since_cursor, status,
        events_fetched, events_new, events_duplicate, events_emitted)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      now,
      cursor,
      status,
      events.length,
      eventsNew,
      eventsDuplicate,
      eventsEmitted
    );

    log.info({
      msg: "poll complete",
      status,
      events_fetched: events.length,
      events_new: eventsNew,
      events_duplicate: eventsDuplicate,
      events_emitted: eventsEmitted,
    });

    schedule(intervalMs);
  };

  schedule(0); // first tick fires immediately

  return {
    stop: () => {
      stopped = true;
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    },
  };
}
