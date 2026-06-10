import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { LifeBuoy, Mail, ExternalLink, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type Ticket = {
  id: string;
  ticket_number: string;
  user_id: string | null;
  email: string;
  category: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: string;
  context: Record<string, unknown> | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const CATEGORY_LABELS: Record<string, string> = {
  bug: "Bug",
  billing: "Billing",
  feature_request: "Feature",
  account: "Account",
  other: "Other",
};

function statusBadgeClass(status: string) {
  switch (status) {
    case "open": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    case "in_progress": return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
    case "resolved": return "bg-green-500/10 text-green-700 border-green-500/20";
    case "closed": return "bg-muted text-muted-foreground border-border";
    default: return "bg-muted text-muted-foreground";
  }
}

export default function SupportTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-support-tickets", statusFilter, categoryFilter, search],
    queryFn: async () => {
      let q = supabase
        .from("support_tickets" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (categoryFilter !== "all") q = q.eq("category", categoryFilter);
      const term = search.trim();
      if (term) {
        q = q.or(
          `subject.ilike.%${term}%,email.ilike.%${term}%,ticket_number.ilike.%${term}%`,
        );
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as Ticket[];
    },
  });

  const tickets = data || [];
  const counts = useMemo(() => {
    const c = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
    for (const t of tickets) c[t.status] = (c[t.status] || 0) + 1;
    return c;
  }, [tickets]);

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; status?: string; admin_notes?: string }) => {
      const patch: Record<string, unknown> = {};
      if (payload.status !== undefined) patch.status = payload.status;
      if (payload.admin_notes !== undefined) patch.admin_notes = payload.admin_notes;
      const { error } = await supabase
        .from("support_tickets" as never)
        .update(patch as never)
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ticket updated");
      queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(["open", "in_progress", "resolved", "closed"] as const).map((s) => (
          <Card key={s} className="rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                {STATUS_OPTIONS.find((o) => o.value === s)?.label}
              </p>
              <p className="text-2xl font-semibold mt-1">{counts[s] || 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5" /> Support tickets
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search subject, email, #"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-xl h-9 w-full sm:w-56"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="rounded-xl h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="rounded-xl h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No tickets match these filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                    <th className="py-2 pr-3">Ticket</th>
                    <th className="py-2 pr-3">From</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Subject</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Created</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-border/60 hover:bg-muted/40 cursor-pointer"
                      onClick={() => setActiveTicket(t)}
                    >
                      <td className="py-2.5 pr-3 font-mono text-xs">{t.ticket_number}</td>
                      <td className="py-2.5 pr-3 truncate max-w-[180px]">{t.email}</td>
                      <td className="py-2.5 pr-3">
                        <Badge variant="outline" className="rounded-md font-normal">
                          {CATEGORY_LABELS[t.category] || t.category}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3 truncate max-w-[260px]">{t.subject}</td>
                      <td className="py-2.5 pr-3">
                        <Badge variant="outline" className={`rounded-md ${statusBadgeClass(t.status)}`}>
                          {STATUS_OPTIONS.find((o) => o.value === t.status)?.label || t.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground whitespace-nowrap">
                        {format(new Date(t.created_at), "MMM d, HH:mm")}
                      </td>
                      <td className="py-2.5">
                        <Button variant="ghost" size="sm" className="rounded-lg">Open</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <TicketDrawer
        ticket={activeTicket}
        onClose={() => setActiveTicket(null)}
        onUpdate={(p) => updateMutation.mutate(p)}
        updating={updateMutation.isPending}
      />
    </div>
  );
}

function TicketDrawer({
  ticket, onClose, onUpdate, updating,
}: {
  ticket: Ticket | null;
  onClose: () => void;
  onUpdate: (p: { id: string; status?: string; admin_notes?: string }) => void;
  updating: boolean;
}) {
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<string>("open");

  useMemo(() => {
    if (ticket) {
      setNotes(ticket.admin_notes || "");
      setStatus(ticket.status);
    }
  }, [ticket]);

  if (!ticket) return null;

  const replyHref = `mailto:${ticket.email}?subject=${encodeURIComponent(`Re: ${ticket.subject} [${ticket.ticket_number}]`)}`;

  return (
    <Sheet open={!!ticket} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="font-mono text-sm">{ticket.ticket_number}</span>
            <Badge variant="outline" className={`rounded-md ${statusBadgeClass(ticket.status)}`}>
              {STATUS_OPTIONS.find((o) => o.value === ticket.status)?.label}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">From</p>
            <p className="text-sm mt-1">{ticket.email}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Subject</p>
            <p className="text-base font-medium mt-1">{ticket.subject}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Category</p>
            <p className="text-sm mt-1">{CATEGORY_LABELS[ticket.category] || ticket.category}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Message</p>
            <div className="mt-2 rounded-xl border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap leading-relaxed">
              {ticket.message}
            </div>
          </div>

          {ticket.context && Object.keys(ticket.context).length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Context</p>
              <pre className="mt-2 rounded-xl border border-border bg-muted/30 p-3 text-xs overflow-x-auto">
                {JSON.stringify(ticket.context, null, 2)}
              </pre>
            </div>
          )}

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-notes">Internal notes</Label>
            <Textarea
              id="admin-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Not shown to the user"
              className="rounded-xl"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              className="rounded-xl"
              asChild
            >
              <a href={replyHref}>
                <Mail className="h-4 w-4" /> Reply via email
                <ExternalLink className="h-3 w-3 opacity-60" />
              </a>
            </Button>
            <Button
              className="rounded-xl sm:ml-auto"
              disabled={updating}
              onClick={() => onUpdate({ id: ticket.id, status, admin_notes: notes })}
            >
              {updating ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save changes"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground pt-2">
            Created {format(new Date(ticket.created_at), "MMM d, yyyy 'at' HH:mm")}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
