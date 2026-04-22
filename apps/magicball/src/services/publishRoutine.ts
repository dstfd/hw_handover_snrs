import type { Database } from "better-sqlite3";
import {
  nextPublishableEvent,
  randomIntervalMs,
  readPublishControls,
} from "./publishHelpers.js";

const CHECK_AGAIN_MS = 10_000;

export type PublishRoutineHandle = {
  stop: () => void;
};

/**
 * `interval_seconds_used` in `publish_log` = the timer duration that *just* fired before this
 * publish (the random 300–900s wait, or 10s “check again” when paused/filtered).
 */
export function startPublishRoutine(
  db: Database,
  log: { info: (o: object) => void; warn: (o: object) => void }
): PublishRoutineHandle {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const schedule = (delayMs: number) => {
    if (stopped) return;
    timeoutId = setTimeout(() => {
      void tick(delayMs);
    }, delayMs);
  };

  const tick = (precedingDelayMs: number) => {
    if (stopped) return;

    let controls: ReturnType<typeof readPublishControls>;
    try {
      controls = readPublishControls(db);
    } catch (e) {
      log.warn({ err: e, msg: "publish tick: read controls failed" });
      schedule(CHECK_AGAIN_MS);
      return;
    }

    if (controls.publish_enabled === 0 || controls.manual_mode === 1) {
      schedule(CHECK_AGAIN_MS);
      return;
    }

    const next = nextPublishableEvent(db, controls);
    if (!next) {
      const pending = (
        db
          .prepare(`SELECT COUNT(*) as c FROM events WHERE is_available = 0`)
          .get() as { c: number }
      ).c;
      if (pending === 0) {
        log.info({ msg: "publish routine: queue exhausted, stopping scheduler" });
        return;
      }
      log.info({
        msg: "publish routine: no event matches current filters; retrying",
        pending_unpublished: pending,
      });
      schedule(CHECK_AGAIN_MS);
      return;
    }

    const now = new Date().toISOString();
    const minSec = controls.interval_min_seconds;
    const maxSec = controls.interval_max_seconds;
    const intervalSecondsUsed = Math.max(
      1,
      Math.round(precedingDelayMs / 1000)
    );

    const run = db.transaction(() => {
      db.prepare(
        `UPDATE events SET is_available = 1, made_available_at = ? WHERE id = ?`
      ).run(now, next.id);
      db.prepare(
        `INSERT INTO publish_log (event_id, published_at, interval_seconds_used)
         VALUES (?, ?, ?)`
      ).run(next.id, now, intervalSecondsUsed);
    });
    run();

    log.info({
      msg: "published event",
      event_id: next.id,
      interval_seconds_used: intervalSecondsUsed,
    });

    const nextWait = randomIntervalMs(minSec, maxSec);
    schedule(nextWait);
  };

  const initialWait = (() => {
    try {
      const c = readPublishControls(db);
      return randomIntervalMs(c.interval_min_seconds, c.interval_max_seconds);
    } catch {
      return CHECK_AGAIN_MS;
    }
  })();
  schedule(initialWait);

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
