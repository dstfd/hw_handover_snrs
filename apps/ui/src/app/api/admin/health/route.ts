import { proxyNotifGw } from "@/lib/proxy";

export async function GET() {
  return proxyNotifGw("/admin/health", { method: "GET" });
}
