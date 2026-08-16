import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Inbox } from "lucide-react";

interface SendRow {
  id: string;
  email: string | null;
  status: string;
  error: string | null;
  sent_at: string | null;
  created_at: string;
}

interface Props {
  campaignId: string | null;
  campaignName?: string;
  onClose: () => void;
}

/** Recipient-level send log for one partner campaign. */
export default function PartnerCampaignSendsDialog({ campaignId, campaignName, onClose }: Props) {
  const [rows, setRows] = useState<SendRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("partner_campaign_sends")
        .select("id, email, status, error, sent_at, created_at")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const list = (data as SendRow[]) || [];
      // Failed rows first so problems are obvious.
      list.sort((a, b) => {
        const rank = (s: string) => (s === "sent" ? 1 : 0);
        return rank(a.status) - rank(b.status);
      });
      setRows(list);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const delivered = rows.filter((r) => r.status === "sent").length;

  return (
    <Dialog open={!!campaignId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Recipients{campaignName ? ` — ${campaignName}` : ""}</DialogTitle>
          <DialogDescription>
            A "sent" row means the email provider accepted the message for delivery. It does not
            confirm the lead opened it, or that it avoided their spam folder.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading recipients
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-2">
            <Inbox className="h-5 w-5 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No recipient records for this campaign.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {delivered} of {rows.length} delivered
            </p>
            <div className="divide-y divide-border rounded-2xl border border-border">
              {rows.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm">{r.email || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.sent_at
                        ? new Date(r.sent_at).toLocaleString()
                        : new Date(r.created_at).toLocaleString()}
                    </p>
                    {r.status !== "sent" && r.error && (
                      <p className="text-xs text-destructive break-words">{r.error}</p>
                    )}
                  </div>
                  <Badge
                    variant="secondary"
                    className={`rounded-full border-0 capitalize shrink-0 ${
                      r.status === "sent"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {r.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
