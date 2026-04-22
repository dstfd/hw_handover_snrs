import { proxyIntel } from "@/lib/proxy";

type Params = { event_id: string; ai_log_id: string };

export async function GET(
  request: Request,
  context: { params: Promise<Params> }
) {
  const { event_id, ai_log_id } = await context.params;
  const u = new URL(request.url);
  const qs = u.searchParams.toString();
  const base = `/pipeline/${encodeURIComponent(event_id)}/ai-log/${encodeURIComponent(ai_log_id)}`;
  const path = qs ? `${base}?${qs}` : base;
  return proxyIntel(path, { method: "GET" });
}
