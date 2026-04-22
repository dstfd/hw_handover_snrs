import { proxyIntel } from "@/lib/proxy";

type Params = { event_id: string; step: string };

export async function POST(
  request: Request,
  context: { params: Promise<Params> }
) {
  const { event_id, step } = await context.params;
  const u = new URL(request.url);
  const qs = u.searchParams.toString();
  const base = `/pipeline/${encodeURIComponent(event_id)}/replay/${encodeURIComponent(step)}`;
  const path = qs ? `${base}?${qs}` : base;
  return proxyIntel(path, { method: "POST" });
}
