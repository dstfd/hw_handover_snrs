import { proxyIntel } from "@/lib/proxy";

export async function GET(request: Request) {
  const u = new URL(request.url);
  const qs = u.searchParams.toString();
  const path = qs ? `/pipeline?${qs}` : "/pipeline";
  return proxyIntel(path, { method: "GET" });
}
