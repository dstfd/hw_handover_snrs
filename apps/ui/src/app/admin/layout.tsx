import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/AppSidebar";
import { decodeJwtPayload, getJwtCookie } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await getJwtCookie();
  const p = token ? decodeJwtPayload(token) : null;
  if (!p || p.role !== "admin") {
    redirect("/alerts");
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
