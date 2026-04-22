import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminLogsResponse, UnifiedLogEntry } from "@/lib/types";

function levelColor(level: string): "default" | "destructive" | "secondary" {
  if (level === "error") return "destructive";
  if (level === "warn") return "secondary";
  return "default";
}

export function LogsTable({
  data,
  page,
  limit,
  total,
  serviceFilter,
  levelFilter,
  eventIdFilter,
}: {
  data: UnifiedLogEntry[];
  page: number;
  limit: number;
  total: number;
  serviceFilter: string;
  levelFilter: string;
  eventIdFilter: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const buildQs = (newPage: string) => {
    const p = new URLSearchParams();
    p.set("page", newPage);
    p.set("limit", String(limit));
    p.set("service", serviceFilter || "all");
    p.set("level", levelFilter || "all");
    if (eventIdFilter) p.set("event_id", eventIdFilter);
    return `/admin/logs?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <form
        action="/admin/logs"
        method="get"
        className="grid gap-4 rounded-lg border p-4 md:grid-cols-2 lg:grid-cols-4"
      >
        <input type="hidden" name="page" value="1" />
        <div className="space-y-2">
          <Label htmlFor="service">Service</Label>
          <select
            id="service"
            name="service"
            defaultValue={serviceFilter === "" ? "all" : serviceFilter}
            className={cn(
              "border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
            )}
          >
            <option value="all">All</option>
            <option value="magicball">MagicBall</option>
            <option value="data-scout">Data Scout</option>
            <option value="intelligence-layer">Intelligence Layer</option>
            <option value="notification-gateway">Notification Gateway</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="level">Level</Label>
          <select
            id="level"
            name="level"
            defaultValue={levelFilter === "" ? "all" : levelFilter}
            className={cn(
              "border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
            )}
          >
            <option value="all">All</option>
            <option value="error">error</option>
            <option value="warn">warn</option>
            <option value="info">info</option>
            <option value="debug">debug</option>
          </select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="event_id">event_id</Label>
          <Input
            id="event_id"
            name="event_id"
            defaultValue={eventIdFilter}
            placeholder="Filter by lineage id"
            className="font-mono"
          />
        </div>
        <div className="flex items-end gap-2 md:col-span-2 lg:col-span-4">
          <Button type="submit">Apply filters</Button>
          <Button variant="outline" type="button" asChild>
            <Link href="/admin/logs">Reset</Link>
          </Button>
        </div>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>timestamp</TableHead>
            <TableHead>service</TableHead>
            <TableHead>level</TableHead>
            <TableHead>event_id</TableHead>
            <TableHead>message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground text-center">
                No log entries.
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, i) => (
              <TableRow key={`${row.timestamp}-${i}`}>
                <TableCell className="whitespace-nowrap text-xs">
                  {new Date(row.timestamp).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{row.service}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={levelColor(row.level)}>{row.level}</Badge>
                </TableCell>
                <TableCell className="max-w-[140px] truncate font-mono text-xs">
                  {row.event_id ?? "—"}
                </TableCell>
                <TableCell className="max-w-xl text-sm">{row.message}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm">
          Page {page} of {totalPages} ({total} total)
        </p>
        <div className="flex gap-2">
          {page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={buildQs(String(page - 1))}>Previous</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          )}
          {page < totalPages ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={buildQs(String(page + 1))}>Next</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
