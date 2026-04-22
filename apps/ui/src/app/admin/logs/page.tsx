import { LogsTable } from "@/components/LogsTable";
import type { AdminLogsResponse } from "@/lib/types";
import { serverFetch } from "@/lib/serverApi";

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    service?: string;
    level?: string;
    event_id?: string;
  }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Math.floor(Number(sp.page ?? "1")) || 1);
  const limit = Math.min(200, Math.max(1, Math.floor(Number(sp.limit ?? "50")) || 50));

  const serviceRaw = sp.service ?? "";
  const levelRaw = sp.level ?? "";
  const eventId = sp.event_id ?? "";

  const qs = new URLSearchParams();
  qs.set("page", String(page));
  qs.set("limit", String(limit));
  if (serviceRaw && serviceRaw !== "all") qs.set("service", serviceRaw);
  if (levelRaw && levelRaw !== "all") qs.set("level", levelRaw);
  if (eventId) qs.set("event_id", eventId);

  const res = await serverFetch(`/api/admin/logs?${qs.toString()}`);
  if (!res.ok) {
    return (
      <div className="p-6">
        <p className="text-destructive">Failed to load logs ({res.status}).</p>
      </div>
    );
  }
  const json = (await res.json()) as AdminLogsResponse;

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold">Aggregated logs</h1>
      <LogsTable
        data={json.data}
        page={json.page}
        limit={json.limit}
        total={json.total}
        serviceFilter={serviceRaw && serviceRaw !== "all" ? serviceRaw : ""}
        levelFilter={levelRaw && levelRaw !== "all" ? levelRaw : ""}
        eventIdFilter={eventId}
      />
    </div>
  );
}
