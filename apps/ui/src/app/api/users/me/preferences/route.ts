import { proxyNotifGw } from "@/lib/proxy";

export async function PATCH(request: Request) {
  const body = await request.text();
  return proxyNotifGw("/users/me/preferences", {
    method: "PATCH",
    body,
  });
}
