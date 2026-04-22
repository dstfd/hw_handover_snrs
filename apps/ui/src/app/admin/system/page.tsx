"use client";

import { SystemHealth } from "@/components/SystemHealth";

export default function AdminSystemPage() {
  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold">System health</h1>
      <SystemHealth />
    </div>
  );
}
