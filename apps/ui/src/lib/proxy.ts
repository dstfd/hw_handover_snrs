import { getBearerHeader } from "./auth";
import { getConfig } from "./config";

export async function proxyJson(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const auth = await getBearerHeader();
  if (!auth) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", auth);
    if (init?.body != null && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const res = await fetch(url, { ...init, headers });
    const body = await res.text();
    const ct = res.headers.get("Content-Type") ?? "application/json";
    return new Response(body, {
      status: res.status,
      headers: { "Content-Type": ct },
    });
  } catch {
    return Response.json({ error: "service unavailable" }, { status: 503 });
  }
}

export async function proxyNotifGw(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const { notifGwUrl } = getConfig();
  return proxyJson(`${notifGwUrl.replace(/\/$/, "")}${path}`, init);
}

export async function proxyIntel(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const { intelUrl } = getConfig();
  return proxyJson(`${intelUrl.replace(/\/$/, "")}${path}`, init);
}
