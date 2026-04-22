import type { DataScoutEventPayload } from "../types.js";

export async function fetchEventById(
  datascoutBaseUrl: string,
  event_id: string
): Promise<DataScoutEventPayload> {
  const url = `${datascoutBaseUrl.replace(/\/$/, "")}/events/${encodeURIComponent(event_id)}`;
  const res = await fetch(url);
  if (res.status === 404) {
    throw new Error(`Data Scout: event not found: ${event_id}`);
  }
  if (!res.ok) {
    throw new Error(
      `Data Scout GET /events/${event_id} failed: ${res.status} ${res.statusText}`
    );
  }
  return (await res.json()) as DataScoutEventPayload;
}
