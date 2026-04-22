import { AuthedHeader } from "@/components/AuthedHeader";
import { AlertPreferencesForm } from "@/components/AlertPreferencesForm";
import { decodeJwtPayload, getJwtCookie } from "@/lib/auth";
import type { UserPublic } from "@/lib/types";
import { serverFetch } from "@/lib/serverApi";

export default async function AlertsPage() {
  const token = await getJwtCookie();
  const p = token ? decodeJwtPayload(token) : null;
  const isAdmin = p?.role === "admin";

  const res = await serverFetch("/api/users/me");
  if (!res.ok) {
    return (
      <div className="p-6">
        <p className="text-destructive">Failed to load profile ({res.status}).</p>
      </div>
    );
  }
  const user = (await res.json()) as UserPublic;

  return (
    <div className="min-h-screen">
      <AuthedHeader isAdmin={isAdmin ?? false} />
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="mb-6 text-2xl font-semibold">Alert preferences</h1>
        <AlertPreferencesForm user={user} />
      </main>
    </div>
  );
}
