import { PipelineRunsTable } from "@/components/PipelineRunsTable";
import type { PipelineListResponse } from "@/lib/types";
import { serverFetch } from "@/lib/serverApi";

export default async function PipelineListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Math.floor(Number(sp.page ?? "1")) || 1);
  const limit = Math.min(200, Math.max(1, Math.floor(Number(sp.limit ?? "20")) || 20));

  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  const res = await serverFetch(`/api/pipeline?${qs.toString()}`);
  if (!res.ok) {
    return (
      <div className="p-6">
        <p className="text-destructive">Failed to load pipeline runs ({res.status}).</p>
      </div>
    );
  }
  const json = (await res.json()) as PipelineListResponse;

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold">Pipeline runs</h1>
      <PipelineRunsTable
        data={json.data}
        page={json.page}
        limit={json.limit}
        total={json.total}
      />
    </div>
  );
}
