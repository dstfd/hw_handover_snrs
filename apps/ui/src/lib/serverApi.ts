import { headers } from "next/headers";

/** Server-only fetch to this app's Route Handlers with incoming cookies. */
export async function serverFetch(path: string): Promise<Response> {
  const h = await headers();
  const host = h.get("host") ?? "127.0.0.1:4104";
  const url = `http://${host}${path}`;
  return fetch(url, {
    headers: { cookie: h.get("cookie") ?? "" },
    cache: "no-store",
  });
}
