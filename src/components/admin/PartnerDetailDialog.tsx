import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, Users, Workflow, Activity, Send, BadgeCheck, XCircle, AtSign, Gift, LayoutTemplate, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { adminActionCall } from "./AdminPartnersTab";
import { callEngine } from "@/components/campaign/CampaignManager";
import { LeadStatusBadge, STATUS_LABELS, type PartnerLead } from "@/components/partner/PartnerLeadsTable";
import { PartnerLeadActivityDialog } from "./PartnerLeadActivityDialog";
import CampaignLanding from "@/components/campaign/CampaignLanding";
import { normaliseSections, type CampaignCopy } from "@/lib/campaignSections";




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
};

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

  const queryClient = useQueryClient();

  // Sending identity (email alias) review, so admins never have to leave this dialog
  const { data: aliasData, isLoading: aliasLoading } = useQuery({
    queryKey: ["admin-partner-alias", partnerId],
    enabled: !!partnerId,
    queryFn: async () => (await adminActionCall({ operation: "alias_list" })).aliases as any[],
  });
  const partnerAliases = (aliasData || []).filter((a) => a.partner_id === partnerId);
  const pendingAliases = partnerAliases.filter((a) => a.status === "pending").length;
  const [aliasNote, setAliasNote] = useState<Record<string, string>>({});
  const [aliasBusy, setAliasBusy] = useState<string | null>(null);

  const decideAlias = async (alias: any, decision: "approved" | "rejected" | "revoked") => {
    setAliasBusy(alias.id);
    try {
      const res = (await adminActionCall({
        operation: "alias_decision",
        data: { alias_id: alias.id, decision, note: aliasNote[alias.id] || "" },
      })) as { notified?: boolean; notify_email?: string | null; notify_error?: string };
      const label = decision === "approved" ? "Approved" : decision === "rejected" ? "Rejected" : "Revoked";
      if (res.notified) toast.success(`${label} ${alias.handle}@trybrandie.com`);
      else toast.warning(`${label}, but the email failed: ${res.notify_error || "unknown error"}`);
      setAliasNote((p) => ({ ...p, [alias.id]: "" }));
      await queryClient.invalidateQueries({ queryKey: ["admin-partner-alias", partnerId] });
    } catch (e: any) {
      toast.error(e.message || "Failed to save decision");
    } finally {
      setAliasBusy(null);
    }
  };

  // Signup credit grants review
  const { data: grantData, isLoading: grantsLoading } = useQuery({
    queryKey: ["admin-partner-credit-grants", partnerId],
    enabled: !!partnerId,
    queryFn: async () =>
      (await adminActionCall({ operation: "partner_credit_grant_list" })).grants as any[],
  });
  const partnerGrants = (grantData || []).filter((g) => g.partner_id === partnerId);
  const pendingGrants = partnerGrants.filter((g) => g.status === "pending").length;
  const [grantNote, setGrantNote] = useState<Record<string, string>>({});
  const [grantTerms, setGrantTerms] = useState<Record<string, { per: string; budget: string; ends: string }>>({});
  const [grantBusy, setGrantBusy] = useState<string | null>(null);
  const [activityLeadId, setActivityLeadId] = useState<string | null>(null);


  const termsFor = (g: any) =>
    grantTerms[g.id] || {
      per: String(g.credits_per_signup),
      budget: String(g.total_budget_credits),
      ends: String(g.ends_at || "").slice(0, 10),
    };

  const decideGrant = async (g: any, decision: "approved" | "rejected" | "paused" | "stopped") => {
    setGrantBusy(g.id);
    try {
      const t = termsFor(g);
      const res = (await adminActionCall({
        operation: "partner_credit_grant_decision",
        data: {
          grant_id: g.id,
          decision,
          note: grantNote[g.id] || "",
          ...(decision === "approved"
            ? {
                credits_per_signup: Number(t.per),
                total_budget_credits: Number(t.budget),
                ends_at: t.ends,
              }
            : {}),
        },
      })) as { notified?: boolean; notify_error?: string };
      const label =
        decision === "approved"
          ? "Approved"
          : decision === "rejected"
            ? "Rejected"
            : decision === "paused"
              ? "Paused"
              : "Stopped";
      if (decision === "paused" || decision === "stopped") toast.success(`${label} the credits campaign`);
      else if (res.notified) toast.success(`${label} the credits request`);
      else toast.warning(`${label}, but the email failed: ${res.notify_error || "unknown error"}`);
      setGrantNote((p) => ({ ...p, [g.id]: "" }));
      await queryClient.invalidateQueries({ queryKey: ["admin-partner-credit-grants", partnerId] });
    } catch (e: any) {
      toast.error(e.message || "Failed to save decision");
    } finally {
      setGrantBusy(null);
    }
  };

  // Campaign page (landing page) review, so admins can approve and put a page live here
  const { data: pageData, isLoading: pagesLoading } = useQuery({
    queryKey: ["admin-partner-campaign-pages"],
    enabled: !!partnerId,
    queryFn: async () => (await callEngine<{ campaigns: any[] }>({ action: "list" })).campaigns,
  });
  const partnerPages = (pageData || []).filter((c) => c.partner_id === partnerId);
  const pendingPages = partnerPages.filter((c) => c.status === "pending_review").length;
  const [pageBusy, setPageBusy] = useState<string | null>(null);
  // Admins preview pages in place, because the public /c/:slug route only serves live campaigns
  const [previewPage, setPreviewPage] = useState<any | null>(null);

  const decidePage = async (c: any, action: "approve" | "reject" | "activate" | "pause") => {
    setPageBusy(c.id);
    try {
      await callEngine({ action, campaign_id: c.id });
      toast.success(
        action === "approve"
          ? `Approved “${c.name}”`
          : action === "reject"
            ? `Denied “${c.name}”`
            : action === "activate"
              ? `“${c.name}” is now the live campaign page`
              : `Paused “${c.name}”`,
      );
      await queryClient.invalidateQueries({ queryKey: ["admin-partner-campaign-pages"] });
      await queryClient.invalidateQueries({ queryKey: ["campaign-pages"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to save decision");
    } finally {
      setPageBusy(null);
    }
  };

  const [requestFilter, setRequestFilter] = useState<"all" | "identity" | "credits" | "pages">("all");
  const [resending, setResending] = useState(false);





  const resendWelcome = async () => {
    if (!partnerId) return;
    setResending(true);
    try {
      const res = (await adminActionCall({
        operation: "resend_partner_welcome",
        data: { partner_id: partnerId },
      })) as { notified: boolean; notify_email?: string | null; notify_error?: string; notify_queued?: boolean };
      if (res.notified) {
        toast.success(`Welcome email sent to ${res.notify_email}`);
      } else if (res.notify_queued) {
        toast.warning("Provider is rate-limited — the welcome email is queued and will send automatically.");
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
              <TabsList className="rounded-xl flex-wrap h-auto">
                <TabsTrigger value="leads" className="rounded-lg gap-2">
                  <Users className="h-3.5 w-3.5" /> Leads
                </TabsTrigger>
                <TabsTrigger value="requests" className="rounded-lg gap-2">
                  <AtSign className="h-3.5 w-3.5" /> Partner requests
                  {pendingAliases + pendingGrants + pendingPages > 0 && (
                    <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground tabular-nums">
                      {pendingAliases + pendingGrants + pendingPages}
                    </span>
                  )}
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

              <TabsContent value="requests" className="mt-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Everything this partner has asked Brandie to approve. Three kinds of request can appear here:{" "}
                  <strong>Sending identity</strong> (their own handle@trybrandie.com address for campaigns),{" "}
                  <strong>Signup credits</strong> (free credits gifted to every user who signs up through their
                  referral link) and <strong>Campaign page</strong> (a public landing page at /c/their-slug — only one
                  page can be live across Brandie at a time). Review the details, add an optional note, then approve or
                  deny.
                </p>

                <div className="flex flex-wrap gap-2">
                  {(["all", "identity", "credits", "pages"] as const).map((f) => (
                    <Button
                      key={f}
                      size="sm"
                      variant={requestFilter === f ? "default" : "outline"}
                      className="rounded-full text-xs"
                      onClick={() => setRequestFilter(f)}
                    >
                      {f === "all"
                        ? "All requests"
                        : f === "identity"
                          ? "Sending identity"
                          : f === "credits"
                            ? "Signup credits"
                            : "Campaign pages"}
                    </Button>
                  ))}
                </div>


                {aliasLoading || grantsLoading || pagesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading partner requests
                  </div>
                ) : (
                  <>
                    {(requestFilter === "all" || requestFilter === "identity") && (
                      <div className="space-y-3">
                        {partnerAliases.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-2">
                            No sending identity request from this partner yet.
                          </p>
                        ) : (
                          partnerAliases.map((a) => (
                            <div
                              key={a.id}
                              className="rounded-2xl border border-border bg-card px-4 py-4 text-sm space-y-3"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="rounded-full gap-1 text-[11px]">
                                  <AtSign className="h-3 w-3" /> Sending identity
                                </Badge>
                                <Badge
                                  variant={
                                    a.status === "approved"
                                      ? "default"
                                      : a.status === "pending"
                                        ? "secondary"
                                        : "outline"
                                  }
                                  className="rounded-full capitalize text-[11px]"
                                >
                                  {a.status}
                                </Badge>
                                <span className="ml-auto text-xs text-muted-foreground">{fmt(a.created_at)}</span>
                              </div>

                              <p className="font-medium break-all">
                                {a.from_name} &lt;{a.handle}@trybrandie.com&gt;
                              </p>

                              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <p className="break-all">Reply-to: {a.reply_to || "—"}</p>
                                <p>{a.reply_to_verified_at ? "Reply-to verified" : "Reply-to unverified"}</p>
                                <p className="break-all">Requester: {a.requester_email || "—"}</p>
                                {a.review_note && <p className="sm:col-span-2">Your note: {a.review_note}</p>}
                              </div>

                              <Textarea
                                rows={2}
                                placeholder="Optional note included in the email…"
                                value={aliasNote[a.id] || ""}
                                onChange={(e) => setAliasNote((p) => ({ ...p, [a.id]: e.target.value }))}
                                className="rounded-xl text-sm"
                              />

                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  className="rounded-full"
                                  disabled={aliasBusy === a.id || a.status === "approved"}
                                  onClick={() => decideAlias(a, "approved")}
                                >
                                  {aliasBusy === a.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <BadgeCheck className="h-3.5 w-3.5" />
                                  )}
                                  Approve address
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-full"
                                  disabled={aliasBusy === a.id || a.status === "rejected"}
                                  onClick={() => decideAlias(a, "rejected")}
                                >
                                  <XCircle className="h-3.5 w-3.5" /> Deny
                                </Button>
                                {a.status === "approved" && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="rounded-full"
                                    disabled={aliasBusy === a.id}
                                    onClick={() => decideAlias(a, "revoked")}
                                  >
                                    Revoke
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {(requestFilter === "all" || requestFilter === "credits") && (
                      <div className="space-y-3">
                        {partnerGrants.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-2">
                            No signup credits request from this partner yet.
                          </p>
                        ) : (
                          partnerGrants.map((g) => {
                            const t = termsFor(g);
                            const editable = g.status === "pending";
                            return (
                              <div
                                key={g.id}
                                className="rounded-2xl border border-border bg-card px-4 py-4 text-sm space-y-3"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className="rounded-full gap-1 text-[11px]">
                                    <Gift className="h-3 w-3" /> Signup credits
                                  </Badge>
                                  <Badge
                                    variant={
                                      g.status === "approved"
                                        ? "default"
                                        : g.status === "pending"
                                          ? "secondary"
                                          : "outline"
                                    }
                                    className="rounded-full capitalize text-[11px]"
                                  >
                                    {g.status}
                                  </Badge>
                                  <span className="ml-auto text-xs text-muted-foreground">{fmt(g.created_at)}</span>
                                </div>

                                <p className="font-medium">
                                  {g.credits_per_signup} credits per signup · {g.total_budget_credits} credit budget
                                </p>

                                <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                  <p className="break-all">
                                    Requested by: {g.requester_name || "—"}
                                    {g.requester_email ? ` · ${g.requester_email}` : ""}
                                  </p>
                                  <p>Ends: {fmt(g.ends_at)}</p>
                                  <p>
                                    Given out: {g.credits_granted} / {g.total_budget_credits} credits
                                  </p>
                                  <p>Leads credited: {g.leads_credited}</p>
                                  {g.request_note && <p className="sm:col-span-2">Partner note: {g.request_note}</p>}
                                  {g.review_note && <p className="sm:col-span-2">Your note: {g.review_note}</p>}
                                </div>

                                {editable && (
                                  <div className="grid sm:grid-cols-3 gap-2">
                                    <Input
                                      type="number"
                                      min={1}
                                      max={50}
                                      value={t.per}
                                      onChange={(e) =>
                                        setGrantTerms((p) => ({ ...p, [g.id]: { ...t, per: e.target.value } }))
                                      }
                                      className="rounded-xl"
                                      placeholder="Credits per signup"
                                    />
                                    <Input
                                      type="number"
                                      min={1}
                                      value={t.budget}
                                      onChange={(e) =>
                                        setGrantTerms((p) => ({ ...p, [g.id]: { ...t, budget: e.target.value } }))
                                      }
                                      className="rounded-xl"
                                      placeholder="Total budget"
                                    />
                                    <Input
                                      type="date"
                                      value={t.ends}
                                      onChange={(e) =>
                                        setGrantTerms((p) => ({ ...p, [g.id]: { ...t, ends: e.target.value } }))
                                      }
                                      className="rounded-xl"
                                    />
                                  </div>
                                )}

                                <Textarea
                                  rows={2}
                                  placeholder="Optional note included in the email…"
                                  value={grantNote[g.id] || ""}
                                  onChange={(e) => setGrantNote((p) => ({ ...p, [g.id]: e.target.value }))}
                                  className="rounded-xl text-sm"
                                />

                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    className="rounded-full"
                                    disabled={
                                      grantBusy === g.id || g.status === "approved" || g.status === "rejected"
                                    }
                                    onClick={() => decideGrant(g, "approved")}
                                  >
                                    {grantBusy === g.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <BadgeCheck className="h-3.5 w-3.5" />
                                    )}
                                    Approve credits
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-full"
                                    disabled={grantBusy === g.id || g.status !== "pending"}
                                    onClick={() => decideGrant(g, "rejected")}
                                  >
                                    <XCircle className="h-3.5 w-3.5" /> Deny
                                  </Button>
                                  {g.status === "approved" && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="rounded-full"
                                        disabled={grantBusy === g.id}
                                        onClick={() => decideGrant(g, "paused")}
                                      >
                                        Pause
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="rounded-full"
                                        disabled={grantBusy === g.id}
                                        onClick={() => decideGrant(g, "stopped")}
                                      >
                                        Stop
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {(requestFilter === "all" || requestFilter === "pages") && (
                      <div className="space-y-3">
                        {partnerPages.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-2">
                            No campaign page request from this partner yet.
                          </p>
                        ) : (
                          partnerPages.map((c) => (
                            <div
                              key={c.id}
                              className="rounded-2xl border border-border bg-card px-4 py-4 text-sm space-y-3"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="rounded-full gap-1 text-[11px]">
                                  <LayoutTemplate className="h-3 w-3" /> Campaign page
                                </Badge>
                                <Badge
                                  variant={
                                    c.status === "active"
                                      ? "default"
                                      : c.status === "pending_review" || c.status === "approved"
                                        ? "secondary"
                                        : "outline"
                                  }
                                  className="rounded-full capitalize text-[11px]"
                                >
                                  {String(c.status).replace(/_/g, " ")}
                                </Badge>
                                <span className="ml-auto text-xs text-muted-foreground">{fmt(c.created_at)}</span>
                              </div>

                              <p className="font-medium break-all">{c.name}</p>

                              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <p className="break-all">Link: /c/{c.slug}</p>
                                <p>
                                  Runs: {fmt(c.starts_at)} → {c.ends_at ? fmt(c.ends_at) : "no end date"}
                                </p>
                                {c.goal && <p className="sm:col-span-2">Goal: {c.goal}</p>}
                                {c.offer_text && <p className="sm:col-span-2">Offer: {c.offer_text}</p>}
                                <p>
                                  {c.view_count || 0} views · {c.signup_count || 0} signups
                                </p>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  className="rounded-full"
                                  disabled={pageBusy === c.id || c.status !== "pending_review"}
                                  onClick={() => decidePage(c, "approve")}
                                >
                                  {pageBusy === c.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <BadgeCheck className="h-3.5 w-3.5" />
                                  )}
                                  Approve page
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-full"
                                  disabled={pageBusy === c.id || c.status !== "pending_review"}
                                  onClick={() => decidePage(c, "reject")}
                                >
                                  <XCircle className="h-3.5 w-3.5" /> Deny
                                </Button>
                                {(c.status === "approved" || c.status === "paused") && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-full"
                                    disabled={pageBusy === c.id}
                                    onClick={() => decidePage(c, "activate")}
                                  >
                                    Put live
                                  </Button>
                                )}
                                {c.status === "active" && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="rounded-full"
                                    disabled={pageBusy === c.id}
                                    onClick={() => decidePage(c, "pause")}
                                  >
                                    Pause
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="rounded-full"
                                  onClick={() => setPreviewPage(c)}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" /> Preview
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </TabsContent>





              <TabsContent value="leads" className="mt-4 space-y-2">
                {data.leads.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No leads attributed yet.</p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Tap a lead to watch their live activity — generations, planned content, jobs and billing.
                    </p>
                    {data.leads.map((l) => (
                      <button
                        key={l.user_id}
                        type="button"
                        onClick={() => setActivityLeadId(l.user_id)}
                        className="w-full text-left rounded-xl border border-border px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm hover:bg-muted/60 transition-colors"
                      >
                        <span className="font-medium">{l.full_name || "Unnamed"}</span>
                        <span className="text-muted-foreground break-all">{l.email}</span>
                        <LeadStatusBadge status={l.status} />
                        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                          {l.designs} designs · {l.credits} credits · joined {fmt(l.joined)}
                        </span>
                      </button>
                    ))}
                  </>
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
      <PartnerLeadActivityDialog
        partnerId={partnerId}
        userId={activityLeadId}
        open={!!activityLeadId}
        onOpenChange={(v) => !v && setActivityLeadId(null)}
      />
    </Dialog>
  );
}
