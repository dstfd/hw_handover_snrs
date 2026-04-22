"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const items: { href: string; label: string }[] = [
  { href: "/alerts", label: "My Alerts" },
  { href: "/admin/pipeline", label: "Pipeline Runs" },
  { href: "/admin/logs", label: "Logs" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/system", label: "System Health" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-56 flex-col border-r bg-muted/30">
      <div className="p-4 font-semibold">Admin</div>
      <Separator />
      <nav className="flex flex-col gap-1 p-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
              pathname === item.href || pathname.startsWith(`${item.href}/`)
                ? "bg-accent font-medium"
                : ""
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto p-2">
        <Button variant="outline" className="w-full" type="button" onClick={() => void logout()}>
          Sign out
        </Button>
      </div>
    </aside>
  );
}
