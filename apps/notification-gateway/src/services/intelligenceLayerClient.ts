export type PipelineAggregateJson = {
  event_id?: string;
  pipeline_version?: string;
  outcome?: string;
  matched_user_count?: number;
  steps?: {
    synthesis?: {
      output?: {
        headline?: string;
        facts?: string[];
        category?: string;
      } | null;
    } | null;
    impact_evaluation?: {
      output?: {
        severity?: string;
      } | null;
    } | null;
    relevance_matching?: {
      output?: {
        matched_users?: Array<{
          user_id: string;
          channels: string[];
          severity_threshold?: string;
          match_reason?: string;
        }>;
        notification_warranted?: boolean;
      } | null;
    } | null;
  };
};

export async function fetchPipelineAggregate(
  intelBaseUrl: string,
  event_id: string
): Promise<PipelineAggregateJson> {
  const base = intelBaseUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/pipeline/${encodeURIComponent(event_id)}`);
  if (!res.ok) {
    throw new Error(
      `Intelligence Layer GET /pipeline/${event_id} failed: ${res.status} ${res.statusText}`
    );
  }
  return (await res.json()) as PipelineAggregateJson;
}
