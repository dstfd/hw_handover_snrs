import { proxyNotifGw } from "@/lib/proxy";

export async function GET() {
  return proxyNotifGw("/users/me", { method: "GET" });
}
