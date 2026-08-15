import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, Users, Workflow, Activity, Send } from "lucide-react";
import { toast } from "sonner";
import { adminActionCall } from "./AdminPartnersTab";
import { LeadStatusBadge, STATUS_LABELS, type PartnerLead } from "@/components/partner/PartnerLeadsTable";


interface Detail {
  partner: {
    id: string;
    name: string;
    slug: string;
    partner_type: string;
    status: string;
    email: string | null;
    organization: string | null;
    contact_person: string | null;
    contact_phone: string | null;
    commission_first_pct: number;
    commission_recurring_pct: number;
    start_date: string;
    notes: string | null;
    created_at: string;
  };
  links: { code: string; label: string; active: boolean; click_count: number }[];
  metrics: {
    leads: number;
    activated: number;
    paying: number;
    revenue: number;
    clicks: number;
    emails_sent: number;
    new_leads_week: number;
    statuses: Record<string, number>;
  };
  leads: PartnerLead[];
  campaigns: {
    id: string;
    name: string;
    subject: string;
    status: string;
    recipients_count: number;
    delivered_count: number;
    opened_count: number;
    clicked_count: number;
    scheduled_for: string | null;
    sent_at: string | null;
    created_at: string;
  }[];
  automations: {
    id: string;
    name: string;
    trigger: string;
    active: boolean;
    delay_hours: number;
    sent_count: number;
    last_run_at: string | null;
  }[];
  sends: { id: string; email: string; status: string; sent_at: string | null; opened_at: string | null; clicked_at: string | null; created_at: string }[];
  runs: { id: string; email: string | null; status: string; created_at: string }[];
  transactions: { id: string; amount: number; created_at: string }[];
}

const NGN = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(Number(n || 0));

const fmt = (v: string | null) =>
  v ? new Date(v).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

const Metric = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-xl border border-border bg-card px-3 py-2.5">
    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
    <p className="mt-1 text-lg tabular-nums">{value}</p>
  </div>
);

export default function PartnerDetailDialog({
  partnerId,
  onClose,
}: {
  partnerId: string | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-partner-detail", partnerId],
    enabled: !!partnerId,
    queryFn: async () =>
      (await adminActionCall({ operation: "partner_detail", data: { partner_id: partnerId } })) as Detail,
  });

  const [resending, setResending] = useState(false);
  const resendWelcome = async () => {
    if (!partnerId) return;
    setResending(true);
    try {
      const res = (await adminActionCall({
        operation: "resend_partner_welcome",
        data: { partner_id: partnerId },
      })) as { notified: boolean; notify_email?: string | null; notify_error?: string };
      if (res.notified) {
        toast.success(`Welcome email sent to ${res.notify_email}`);
      } else if (res.notify_error?.includes("daily_quota_exceeded")) {
        toast.error("Email provider daily quota reached — try again after it resets.");
      } else if (res.notify_error === "no_email_on_file") {
        toast.error("This partner has no email address on file.");
      } else {
        toast.error(`Email failed: ${res.notify_error || "unknown error"}`);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to send email");
    } finally {
      setResending(false);
    }
  };

  return (
    <Dialog open={!!partnerId} onOpenChange={() => onClose()}>
      <DialogContent className="rounded-2xl max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {data?.partner.name || "Partner"}
            {data && (
              <>
                <Badge variant="secondary" className="rounded-full border-0 capitalize">
                  {data.partner.partner_type.replace(/_/g, " ")}
                </Badge>
                <Badge variant={data.partner.status === "active" ? "default" : "outline"} className="rounded-full capitalize">
                  {data.partner.status}
                </Badge>
              </>
            )}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-3">
            <span>
              {data ? `${data.partner.email || "No email"} · joined ${fmt(data.partner.created_at)}` : "Loading partner activity"}
            </span>
            {data && (
              <Button size="sm" variant="outline" className="rounded-full h-7" onClick={resendWelcome} disabled={resending}>
                {resending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Resend welcome email
              </Button>
            )}
          </DialogDescription>
        </DialogHeader>


        {isLoading || !data ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading partner activity
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Metric label="Clicks" value={data.metrics.clicks} />
              <Metric label="Leads" value={data.metrics.leads} />
              <Metric label="Activated" value={data.metrics.activated} />
              <Metric label="Paying" value={data.metrics.paying} />
              <Metric label="Revenue" value={NGN(data.metrics.revenue)} />
              <Metric label="Emails sent" value={data.metrics.emails_sent} />
              <Metric label="New this week" value={data.metrics.new_leads_week} />
              <Metric
                label="Commission"
                value={`${data.partner.commission_first_pct}% / ${data.partner.commission_recurring_pct}%`}
              />
            </div>

            <div className="rounded-xl border border-border p-4 grid sm:grid-cols-2 gap-3 text-sm">
              {[
                ["Slug", data.partner.slug],
                ["Organization", data.partner.organization || "—"],
                ["Contact person", data.partner.contact_person || "—"],
                ["Phone", data.partner.contact_phone || "—"],
                ["Start date", fmt(data.partner.start_date)],
                ["Links", data.links.map((l) => `${l.code}${l.active ? "" : " (revoked)"}`).join(", ") || "—"],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{k}</p>
                  <p className="mt-0.5 break-all">{v}</p>
                </div>
              ))}
              {data.partner.notes && (
                <div className="sm:col-span-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Notes</p>
                  <p className="mt-0.5 whitespace-pre-wrap">{data.partner.notes}</p>
                </div>
              )}
            </div>

            {Object.keys(data.metrics.statuses).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.metrics.statuses).map(([s, n]) => (
                  <Badge key={s} variant="outline" className="rounded-full">
                    {STATUS_LABELS[s] || s}: {n}
                  </Badge>
                ))}
              </div>
            )}

            <Tabs defaultValue="leads">
              <TabsList className="rounded-xl">
                <TabsTrigger value="leads" className="rounded-lg gap-2">
                  <Users className="h-3.5 w-3.5" /> Leads
                </TabsTrigger>
                <TabsTrigger value="campaigns" className="rounded-lg gap-2">
                  <Mail className="h-3.5 w-3.5" /> Campaigns
                </TabsTrigger>
                <TabsTrigger value="automations" className="rounded-lg gap-2">
                  <Workflow className="h-3.5 w-3.5" /> Automations
                </TabsTrigger>
                <TabsTrigger value="activity" className="rounded-lg gap-2">
                  <Activity className="h-3.5 w-3.5" /> Activity
                </TabsTrigger>
              </TabsList>

              <TabsContent value="leads" className="mt-4 space-y-2">
                {data.leads.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No leads attributed yet.</p>
                ) : (
                  data.leads.map((l) => (
                    <div
                      key={l.user_id}
                      className="rounded-xl border border-border px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                    >
                      <span className="font-medium">{l.full_name || "Unnamed"}</span>
                      <span className="text-muted-foreground break-all">{l.email}</span>
                      <LeadStatusBadge status={l.status} />
                      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                        {l.designs} designs · {l.credits} credits · joined {fmt(l.joined)}
                      </span>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="campaigns" className="mt-4 space-y-2">
                {data.campaigns.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No campaigns created yet.</p>
                ) : (
                  data.campaigns.map((c) => (
                    <div key={c.id} className="rounded-xl border border-border px-3 py-2.5 text-sm space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{c.name}</span>
                        <Badge variant="outline" className="rounded-full capitalize">
                          {c.status}
                        </Badge>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {c.sent_at ? `Sent ${fmt(c.sent_at)}` : c.scheduled_for ? `Scheduled ${fmt(c.scheduled_for)}` : fmt(c.created_at)}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{c.subject}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {c.recipients_count} recipients · {c.delivered_count} delivered · {c.opened_count} opened ·{" "}
                        {c.clicked_count} clicked
                      </p>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="automations" className="mt-4 space-y-2">
                {data.automations.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No automations set up yet.</p>
                ) : (
                  data.automations.map((a) => (
                    <div key={a.id} className="rounded-xl border border-border px-3 py-2.5 text-sm space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{a.name}</span>
                        <Badge variant={a.active ? "default" : "outline"} className="rounded-full">
                          {a.active ? "Active" : "Paused"}
                        </Badge>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {a.last_run_at ? `Last run ${fmt(a.last_run_at)}` : "Never run"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Trigger: {a.trigger.replace(/_/g, " ")} · delay {a.delay_hours}h · {a.sent_count} sent
                      </p>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="activity" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Recent campaign sends</p>
                  {data.sends.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No sends yet.</p>
                  ) : (
                    data.sends.map((s) => (
                      <div key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-muted-foreground w-24 shrink-0 text-xs">{fmt(s.created_at)}</span>
                        <span className="break-all">{s.email}</span>
                        <Badge variant="outline" className="rounded-full capitalize text-[11px]">
                          {s.clicked_at ? "clicked" : s.opened_at ? "opened" : s.status}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Automation runs</p>
                  {data.runs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No automation runs yet.</p>
                  ) : (
                    data.runs.map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-muted-foreground w-24 shrink-0 text-xs">{fmt(r.created_at)}</span>
                        <span className="break-all">{r.email || "—"}</span>
                        <Badge variant="outline" className="rounded-full capitalize text-[11px]">
                          {r.status}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Lead payments</p>
                  {data.transactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No payments from this partner's leads yet.</p>
                  ) : (
                    data.transactions.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground w-24 shrink-0 text-xs">{fmt(t.created_at)}</span>
                        <span className="tabular-nums">{NGN(t.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
