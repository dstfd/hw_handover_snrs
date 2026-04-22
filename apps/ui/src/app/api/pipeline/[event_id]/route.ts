import { proxyIntel } from "@/lib/proxy";

type Params = { event_id: string };

export async function GET(
  request: Request,
  context: { params: Promise<Params> }
) {
  const { event_id } = await context.params;
  const u = new URL(request.url);
  const qs = u.searchParams.toString();
  const base = `/pipeline/${encodeURIComponent(event_id)}`;
  const path = qs ? `${base}?${qs}` : base;
  return proxyIntel(path, { method: "GET" });
}
