import { PipelineDetail } from "@/components/PipelineDetail";
import type { PipelineDetailResponse } from "@/lib/types";
import { serverFetch } from "@/lib/serverApi";

export default async function PipelineDetailPage({
  params,
}: {
  params: Promise<{ event_id: string }>;
}) {
  const { event_id } = await params;
  const res = await serverFetch(
    `/api/pipeline/${encodeURIComponent(event_id)}`
  );
  if (!res.ok) {
    return (
      <div className="p-6">
        <p className="text-destructive">Failed to load run ({res.status}).</p>
      </div>
    );
  }
  const run = (await res.json()) as PipelineDetailResponse;

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold">Pipeline run</h1>
      <PipelineDetail run={run} eventId={event_id} />
    </div>
  );
}
