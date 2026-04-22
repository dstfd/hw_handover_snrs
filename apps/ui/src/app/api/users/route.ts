import { proxyNotifGw } from "@/lib/proxy";

export async function GET() {
  return proxyNotifGw("/users", { method: "GET" });
}
