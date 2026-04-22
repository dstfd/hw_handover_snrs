import { proxyNotifGw } from "@/lib/proxy";

export async function GET(request: Request) {
  const u = new URL(request.url);
  const qs = u.searchParams.toString();
  const path = qs ? `/admin/logs?${qs}` : "/admin/logs";
  return proxyNotifGw(path, { method: "GET" });
}
