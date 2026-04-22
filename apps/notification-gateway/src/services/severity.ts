/** Design order: low < medium < high < critical (increasing restrictiveness). */
const ORDER: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function severityRank(s: string): number {
  const r = ORDER[s];
  if (r === undefined) {
    throw new Error(`Unknown severity: ${s}`);
  }
  return r;
}

/**
 * User is matched for an event when their threshold is at or below event severity
 * (inclusive of the event level): more permissive thresholds (low) match more events.
 */
export function userMatchesEventSeverity(
  userThreshold: string,
  eventSeverity: string
): boolean {
  return severityRank(userThreshold) <= severityRank(eventSeverity);
}
