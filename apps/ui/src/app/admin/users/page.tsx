import { UsersTable } from "@/components/UsersTable";
import type { UserPublic } from "@/lib/types";
import { serverFetch } from "@/lib/serverApi";

export default async function AdminUsersPage() {
  const res = await serverFetch("/api/users");
  if (!res.ok) {
    return (
      <div className="p-6">
        <p className="text-destructive">Failed to load users ({res.status}).</p>
      </div>
    );
  }
  const json = (await res.json()) as { users: UserPublic[] };
  const users = Array.isArray(json.users) ? json.users : [];

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold">Users</h1>
      <p className="text-muted-foreground mb-4 text-sm">Read-only directory.</p>
      <UsersTable users={users} />
    </div>
  );
}
