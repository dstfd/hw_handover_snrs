import type { NotificationGatewayUser } from "../types.js";

/**
 * Design: GET /users?min_severity=&category= (no auth, internal)
 */
export async function fetchUsersForRelevance(
  baseUrl: string,
  min_severity: string,
  category: string
): Promise<NotificationGatewayUser[]> {
  const u = new URL("/users", baseUrl.replace(/\/$/, "") + "/");
  u.searchParams.set("min_severity", min_severity);
  u.searchParams.set("category", category);
  const res = await fetch(u);
  if (!res.ok) {
    throw new Error(
      `Notification Gateway GET /users failed: ${res.status} ${res.statusText}`
    );
  }
  const body = (await res.json()) as unknown;
  if (Array.isArray(body)) {
    return body as NotificationGatewayUser[];
  }
  if (body && typeof body === "object" && "users" in body) {
    const us = (body as { users: unknown }).users;
    if (Array.isArray(us)) return us as NotificationGatewayUser[];
  }
  throw new Error("Notification Gateway: unexpected /users response shape");
}
