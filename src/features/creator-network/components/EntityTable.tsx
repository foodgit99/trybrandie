import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Inbox } from "lucide-react";
import type { Row } from "../types";

export type Column = { key: string; label: string; render?: (r: Row) => ReactNode; className?: string };

export default function EntityTable({ rows, columns, loading, error, empty, onRowClick }: {
  rows?: Row[]; columns: Column[]; loading?: boolean; error?: unknown; empty: { title: string; description?: string; ctaLabel?: string; onCta?: () => void };
  onRowClick?: (r: Row) => void;
}) {
  if (loading) return <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>;
  if (error) return <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Couldn't load: {String((error as any)?.message ?? error)}</p>;
  if (!rows?.length) return <EmptyState icon={Inbox} {...empty} />;
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>{columns.map((c) => <TableHead key={c.key} className={c.className}>{c.label}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow
              key={r.id}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              onKeyDown={onRowClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRowClick(r); } } : undefined}
              className={onRowClick ? "cursor-pointer focus-visible:outline-none focus-visible:bg-muted" : undefined}
            >
              {columns.map((c) => <TableCell key={c.key} className={c.className}>{c.render ? c.render(r) : (r[c.key] ?? "—")}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
