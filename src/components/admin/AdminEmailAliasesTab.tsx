import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { AtSign, BadgeCheck, XCircle, Ban, Loader2, RefreshCw, Search } from "lucide-react";
import { adminActionCall } from "./AdminPartnersTab";

interface Alias {
  id: string;
  handle: string;
  from_name: string;
  reply_to: string | null;
  reply_to_verified_at: string | null;
  status: string;
  review_note: string | null;
  created_at: string;
  owner_type: "partner" | "brand";
  owner_name: string | null;
  partner_slug: string | null;
  requester_email: string | null;
  requester_name: string | null;
}

const statusTone = (s: string) =>
  s === "approved"
    ? "default"
    : s === "pending"
      ? "secondary"
      : "outline";

export default function AdminEmailAliasesTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching, error } = useQuery({
    queryKey: ["admin-aliases"],
    queryFn: async () => (await adminActionCall({ operation: "alias_list" })).aliases as Alias[],
  });

  const aliases = data || [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return aliases;
    return aliases.filter((a) =>
      [a.handle, a.from_name, a.reply_to, a.owner_name, a.requester_email, a.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [aliases, search]);

  const pending = filtered.filter((a) => a.status === "pending");
  const others = filtered.filter((a) => a.status !== "pending");

  const decide = async (alias: Alias, decision: "approved" | "rejected" | "revoked") => {
    setBusy(alias.id);
    try {
      const res = (await adminActionCall({
        operation: "alias_decision",
        data: { alias_id: alias.id, decision, note: notes[alias.id] || "" },
      })) as { notified: boolean; notify_email?: string | null; notify_error?: string };

      const label =
        decision === "approved" ? "Approved" : decision === "rejected" ? "Rejected" : "Revoked";
      if (decision === "revoked") {
        toast.success(`${label} ${alias.handle}@trybrandie.com`);
      } else if (res.notified) {
        toast.success(`${label} — email sent to ${res.notify_email}`);
      } else if (res.notify_error === "no_email_on_file") {
        toast.warning(`${label}, but no email address on file.`);
      } else if (res.notify_error?.includes("daily_quota_exceeded")) {
        toast.warning(`${label}, but the email provider's daily quota is reached.`);
      } else {
        toast.warning(`${label}, but the email failed: ${res.notify_error || "unknown error"}`);
      }
      setNotes((p) => ({ ...p, [alias.id]: "" }));
      await qc.invalidateQueries({ queryKey: ["admin-aliases"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save decision");
    } finally {
      setBusy(null);
    }
  };

  const row = (a: Alias, reviewable: boolean) => (
    <div key={a.id} className="rounded-2xl border p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{a.handle}@trybrandie.com</span>
        <Badge variant="outline" className="rounded-full capitalize">{a.owner_type}</Badge>
        <Badge variant={statusTone(a.status)} className="rounded-full capitalize">{a.status}</Badge>
        {a.reply_to_verified_at ? (
          <Badge variant="outline" className="rounded-full text-emerald-600 border-emerald-500/40">
            reply-to verified
          </Badge>
        ) : (
          <Badge variant="outline" className="rounded-full text-amber-600 border-amber-500/40">
            reply-to unverified
          </Badge>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {new Date(a.created_at).toLocaleDateString()}
        </span>
      </div>

      <div className="grid gap-1 sm:grid-cols-2 text-sm text-muted-foreground">
        <p>Requested by: {a.requester_name || a.requester_email || "—"}</p>
        <p>Email: {a.requester_email || "—"}</p>
        <p>{a.owner_type === "partner" ? "Partner" : "Brand"}: {a.owner_name || "—"}</p>
        <p>From name: {a.from_name || "—"}</p>
        <p>Reply-to: {a.reply_to || "—"}</p>
        {a.review_note && <p className="sm:col-span-2">Note: {a.review_note}</p>}
      </div>

      {reviewable && (
        <>
          <Textarea
            rows={2}
            placeholder="Optional note included in the email…"
            className="rounded-xl"
            value={notes[a.id] || ""}
            onChange={(e) => setNotes((p) => ({ ...p, [a.id]: e.target.value }))}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="rounded-xl"
              disabled={busy === a.id}
              onClick={() => decide(a, "approved")}
            >
              {busy === a.id ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <BadgeCheck className="h-4 w-4 mr-2" />
              )}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              disabled={busy === a.id}
              onClick={() => decide(a, "rejected")}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </div>
        </>
      )}

      {a.status === "approved" && (
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl text-destructive"
          disabled={busy === a.id}
          onClick={() => decide(a, "revoked")}
        >
          <Ban className="h-4 w-4 mr-2" />
          Revoke
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AtSign className="h-5 w-5" />
            Email alias requests
            {pending.length > 0 && (
              <Badge className="rounded-full">{pending.length} pending</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Brand and partner requests for a branded sending address (handle@trybrandie.com). Approving
            emails the requester automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search handle, brand, partner, email…"
                className="pl-9 rounded-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="rounded-xl" onClick={() => refetch()}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive py-6 text-center">
              {error instanceof Error ? error.message : "Failed to load alias requests"}
            </p>
          ) : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No pending requests.</p>
          ) : (
            <div className="space-y-3">{pending.map((a) => row(a, true))}</div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>All aliases</CardTitle>
          <CardDescription>Approved, rejected and revoked sending addresses.</CardDescription>
        </CardHeader>
        <CardContent>
          {others.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nothing here yet.</p>
          ) : (
            <div className="space-y-3">{others.map((a) => row(a, false))}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
