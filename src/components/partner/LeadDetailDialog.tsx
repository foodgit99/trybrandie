import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { LeadStatusBadge, type PartnerLead } from "./PartnerLeadsTable";

interface TimelineEvent {
  at: string;
  label: string;
}

export default function LeadDetailDialog({
  lead,
  onClose,
}: {
  lead: PartnerLead | null;
  onClose: () => void;
}) {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lead) {
      setTimeline([]);
      return;
    }
    setLoading(true);
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data } = await supabase.functions.invoke("partner-portal", {
        body: { action: "lead_detail", user_id: lead.user_id },
        headers: { Authorization: `Bearer ${sessionData?.session?.access_token}` },
      });
      setTimeline((data?.timeline as TimelineEvent[]) || []);
      setLoading(false);
    })();
  }, [lead?.user_id]);

  return (
    <Dialog open={!!lead} onOpenChange={() => onClose()}>
      <DialogContent className="rounded-2xl max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead?.full_name || "Lead"}</DialogTitle>
        </DialogHeader>
        {lead && (
          <div className="space-y-5 mt-1">
            <div className="flex items-center gap-2">
              <LeadStatusBadge status={lead.status} />
              <span className="text-xs text-muted-foreground">
                Acquired via {lead.source === "manual" ? "manual attribution" : "your referral link"}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Email", lead.email || "—"],
                ["Joined", new Date(lead.joined).toLocaleDateString()],
                ["Current plan", lead.plan],
                ["Credits", String(lead.credits)],
                ["Designs created", String(lead.designs)],
                ["Last active", lead.last_active ? new Date(lead.last_active).toLocaleDateString() : "—"],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
                  <dd className="mt-0.5 break-all capitalize">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Activity</p>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading activity
                </div>
              ) : timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <ol className="space-y-2">
                  {timeline.map((e, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="text-muted-foreground w-16 shrink-0">
                        {new Date(e.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                      </span>
                      <span>{e.label}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
