import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PipelineListResponse } from "@/lib/types";

function outcomeBadge(outcome: string) {
  switch (outcome) {
    case "notified":
      return <Badge variant="success">notified</Badge>;
    case "skipped":
      return <Badge variant="warning">skipped</Badge>;
    case "failed":
      return <Badge variant="destructive">failed</Badge>;
    default:
      return <Badge variant="muted">{outcome}</Badge>;
  }
}

export function PipelineRunsTable({
  data,
  page,
  limit,
  total,
}: {
  data: PipelineListResponse["data"];
  page: number;
  limit: number;
  total: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;
  const qs = (p: number) =>
    `/admin/pipeline?${new URLSearchParams({ page: String(p), limit: String(limit) }).toString()}`;

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>event_id</TableHead>
            <TableHead>processed_at</TableHead>
            <TableHead>outcome</TableHead>
            <TableHead className="text-right">matched_user_count</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground text-center">
                No pipeline runs yet.
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow key={`${row.event_id}:${row.processed_at}`}>
                <TableCell className="font-mono text-xs">
                  <Link
                    href={`/admin/pipeline/${encodeURIComponent(row.event_id)}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {row.event_id}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">
                  {new Date(row.processed_at).toLocaleString()}
                </TableCell>
                <TableCell>{outcomeBadge(row.outcome)}</TableCell>
                <TableCell className="text-right">{row.matched_user_count}</TableCell>
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
          {prevPage ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={qs(prevPage)}>Previous</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          )}
          {nextPage ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={qs(nextPage)}>Next</Link>
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
