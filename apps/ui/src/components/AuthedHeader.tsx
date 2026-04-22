"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function AuthedHeader({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b bg-background/95 px-4 py-3">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
        <span className="font-medium">Sonrise</span>
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/pipeline">Admin</Link>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" type="button" onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
