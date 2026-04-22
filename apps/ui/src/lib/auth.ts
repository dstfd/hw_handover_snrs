import { cookies } from "next/headers";

export const COOKIE_NAME = "sonrise_jwt";

/** Read raw JWT string from cookie (server-side). Returns null if absent. */
export async function getJwtCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

/**
 * Decode JWT payload without verifying signature.
 * Used only for routing/UX in server components. Services enforce real auth.
 */
export function decodeJwtPayload(token: string): {
  user_id: string;
  role: "user" | "admin";
  exp: number;
} | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1]!, "base64url").toString("utf-8")
    ) as { user_id?: string; role?: string; exp?: number };
    if (
      typeof payload.user_id !== "string" ||
      (payload.role !== "user" && payload.role !== "admin") ||
      typeof payload.exp !== "number"
    )
      return null;
    return {
      user_id: payload.user_id,
      role: payload.role,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

/** Build Authorization header value from cookie JWT. */
export async function getBearerHeader(): Promise<string | null> {
  const jwt = await getJwtCookie();
  if (!jwt) return null;
  return `Bearer ${jwt}`;
}
