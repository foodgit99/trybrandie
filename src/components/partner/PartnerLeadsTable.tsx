import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Search } from "lucide-react";

export interface PartnerLead {
  user_id: string;
  full_name: string | null;
  email: string | null;
  plan: string;
  credits: number;
  designs: number;
  last_active: string | null;
  joined: string;
  source: string;
  attributed_at: string;
  status: string;
}

export const STATUS_LABELS: Record<string, string> = {
  new: "New",
  activated: "Activated",
  active: "Active",
  low_credits: "Low credits",
  exhausted: "Exhausted",
  paid: "Paid",
  inactive: "Inactive",
  churned: "Churned",
};

const STATUS_STYLES: Record<string, string> = {
  new: "bg-muted text-muted-foreground",
  activated: "bg-primary/10 text-primary",
  active: "bg-primary/15 text-primary",
  low_credits: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  exhausted: "bg-destructive/10 text-destructive",
  paid: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  inactive: "bg-muted text-muted-foreground",
  churned: "bg-destructive/10 text-destructive",
};

export function LeadStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={`rounded-full border-0 text-[11px] ${STATUS_STYLES[status] || "bg-muted"}`}>
      {STATUS_LABELS[status] || status}
    </Badge>
  );
}

const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "—";

const relative = (v: string | null) => {
  if (!v) return "—";
  const days = Math.floor((Date.now() - new Date(v).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return fmtDate(v);
};

export default function PartnerLeadsTable({
  leads,
  onSelect,
}: {
  leads: PartnerLead[];
  onSelect: (lead: PartnerLead) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (status !== "all" && l.status !== status) return false;
      if (!q) return true;
      return (
        (l.full_name || "").toLowerCase().includes(q) ||
        (l.email || "").toLowerCase().includes(q)
      );
    });
  }, [leads, query, status]);

  const exportCsv = () => {
    const header = ["Name", "Email", "Status", "Credits", "Designs", "Plan", "Last active", "Joined", "Source"];
    const rows = filtered.map((l) => [
      l.full_name || "",
      l.email || "",
      STATUS_LABELS[l.status] || l.status,
      l.credits,
      l.designs,
      l.plan,
      l.last_active || "",
      l.joined,
      l.source,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `brandie-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search leads by name or email"
            className="pl-9 rounded-xl"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border bg-background px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <Button variant="outline" className="rounded-xl gap-2" onClick={exportCsv}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-3">Lead</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
                <th className="text-right font-medium px-4 py-3">Credits</th>
                <th className="text-right font-medium px-4 py-3">Designs</th>
                <th className="text-left font-medium px-4 py-3">Plan</th>
                <th className="text-left font-medium px-4 py-3">Last active</th>
                <th className="text-left font-medium px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No leads yet. Share your referral link to start acquiring users.
                  </td>
                </tr>
              )}
              {filtered.map((l) => (
                <tr
                  key={l.user_id}
                  onClick={() => onSelect(l)}
                  className="border-t border-border cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{l.full_name || "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground break-all">{l.email || "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <LeadStatusBadge status={l.status} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{l.credits}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{l.designs}</td>
                  <td className="px-4 py-3 capitalize">{l.plan}</td>
                  <td className="px-4 py-3">{relative(l.last_active)}</td>
                  <td className="px-4 py-3">{fmtDate(l.joined)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {leads.length} leads.
      </p>
    </div>
  );
}
