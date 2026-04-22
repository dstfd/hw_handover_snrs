import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "sonrise_jwt";

function decodePayload(token: string): { role: string; exp: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const raw = atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"));
    const p = JSON.parse(raw) as { role?: string; exp?: number };
    if (typeof p.exp !== "number") return null;
    return { role: p.role ?? "user", exp: p.exp };
  } catch {
    return null;
  }
}

function isApi(pathname: string): boolean {
  return pathname.startsWith("/api");
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    if (isApi(pathname)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
  const payload = decodePayload(token);
  if (!payload || payload.exp < Math.floor(Date.now() / 1000)) {
    if (isApi(pathname)) {
      const res = NextResponse.json({ error: "unauthorized" }, { status: 401 });
      res.cookies.delete(COOKIE_NAME);
      return res;
    }
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete(COOKIE_NAME);
    return res;
  }

  const isPipelineApi =
    pathname === "/api/pipeline" || pathname.startsWith("/api/pipeline/");
  const needsAdmin =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin") ||
    pathname === "/api/users" ||
    isPipelineApi;
  if (needsAdmin && payload.role !== "admin") {
    if (isApi(pathname)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/alerts", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
