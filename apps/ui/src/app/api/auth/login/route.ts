import { cookies } from "next/headers";
import { getConfig } from "@/lib/config";
import { COOKIE_NAME } from "@/lib/auth";

const MAX_AGE_SEC = 24 * 60 * 60;

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string };
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const { notifGwUrl } = getConfig();
  const url = `${notifGwUrl.replace(/\/$/, "")}/auth/login`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: body.email,
        password: body.password,
      }),
    });
    const data = (await res.json()) as {
      token?: string;
      user?: unknown;
      error?: string;
    };
    if (!res.ok) {
      return Response.json(
        { error: data.error ?? "login failed" },
        { status: res.status }
      );
    }
    if (typeof data.token !== "string" || !data.user) {
      return Response.json({ error: "invalid response from auth" }, { status: 502 });
    }
    const store = await cookies();
    store.set(COOKIE_NAME, data.token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: MAX_AGE_SEC,
    });
    return Response.json({ ok: true, user: data.user });
  } catch {
    return Response.json({ error: "service unavailable" }, { status: 503 });
  }
}
