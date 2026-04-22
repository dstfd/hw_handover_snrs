import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UserPublic } from "@/lib/types";

export function UsersTable({ users }: { users: UserPublic[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>name</TableHead>
          <TableHead>email</TableHead>
          <TableHead>role</TableHead>
          <TableHead>severity_threshold</TableHead>
          <TableHead>channels</TableHead>
          <TableHead>event_categories</TableHead>
          <TableHead>is_active</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((u) => (
          <TableRow key={u.user_id}>
            <TableCell>{u.name}</TableCell>
            <TableCell className="font-mono text-sm">{u.email ?? "—"}</TableCell>
            <TableCell>
              <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                {u.role}
              </Badge>
            </TableCell>
            <TableCell>{u.severity_threshold}</TableCell>
            <TableCell className="text-sm">{u.channels.join(", ")}</TableCell>
            <TableCell className="text-sm">
              {u.event_categories.join(", ")}
            </TableCell>
            <TableCell>{u.is_active ? "yes" : "no"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
