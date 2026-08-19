import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart3,
  Check,
  Copy,
  ExternalLink,
  Eye,
  Loader2,
  Mail,
  Megaphone,
  Pause,
  Play,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  CAMPAIGN_STATUS_LABELS,
  campaignPageUrl,
  normaliseSections,
  type CampaignCopy,
  type CampaignPage,
} from "@/lib/campaignSections";
import CampaignLanding from "@/components/campaign/CampaignLanding";
import {
  CreateCampaignDialog,
  EditCampaignDialog,
  StatsDialog,
  STATUS_TONE,
  callEngine,
  type ListResponse,
} from "@/components/campaign/CampaignManager";
import EmailCampaignDialog, {
  sendEmailCampaign,
  type EmailCampaign,
} from "@/components/partner/EmailCampaignDialog";
import PartnerCampaignSendsDialog from "@/components/partner/PartnerCampaignSendsDialog";

type Filter = "all" | "email" | "page";

/** One campaign, carrying an email blast, a landing page, or both. */
type Row = {
  key: string;
  name: string;
  page: CampaignPage | null;
  email: EmailCampaign | null;
  sortAt: string;
};

const EMAIL_TONE: Record<string, string> = {
  sent: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  sending: "bg-primary/10 text-primary border-primary/30",
  scheduled: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  failed: "bg-destructive/10 text-destructive border-destructive/30",
};

/**
 * Single Campaigns surface. A campaign can reach people by email (partner_campaigns)
 * and by a public landing page (campaigns_public); the two are linked by
 * `campaigns_public.partner_campaign_id` and shown as one row.
 */
const UnifiedCampaigns = ({ partnerId }: { partnerId?: string }) => {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");

  const [createPageFor, setCreatePageFor] = useState<EmailCampaign | null>(null);
  const [createPageOpen, setCreatePageOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<CampaignPage | null>(null);
  const [previewing, setPreviewing] = useState<CampaignPage | null>(null);
  const [statsFor, setStatsFor] = useState<CampaignPage | null>(null);

  const [emailOpen, setEmailOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState<EmailCampaign | null>(null);
  const [emailPrefill, setEmailPrefill] = useState<{ name?: string; subject?: string } | undefined>();
  const [linkPageAfterEmail, setLinkPageAfterEmail] = useState<CampaignPage | null>(null);
  const [recipientsFor, setRecipientsFor] = useState<EmailCampaign | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const pagesQuery = useQuery({
    queryKey: ["campaign-pages"],
    queryFn: () => callEngine<ListResponse>({ action: "list" }),
    staleTime: 20_000,
  });

  const emailsQuery = useQuery({
    queryKey: ["partner-email-campaigns", partnerId],
    enabled: !!partnerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_campaigns")
        .select("*")
        .eq("partner_id", partnerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as EmailCampaign[];
    },
  });

  const refreshPages = () => qc.invalidateQueries({ queryKey: ["campaign-pages"] });
  const refreshEmails = () => qc.invalidateQueries({ queryKey: ["partner-email-campaigns", partnerId] });

  const pageAction = useMutation({
    mutationFn: (body: Record<string, unknown>) => callEngine(body),
    onSuccess: () => {
      refreshPages();
      toast({ title: "Campaign updated" });
    },
    onError: (e: Error) => toast({ title: "That didn't work", description: e.message, variant: "destructive" }),
  });

  const isAdmin = !!pagesQuery.data?.is_admin;
  const pages = pagesQuery.data?.campaigns ?? [];
  const emails = emailsQuery.data ?? [];

  const rows = useMemo<Row[]>(() => {
    const linked = new Set<string>();
    const out: Row[] = [];

    for (const p of pages) {
      const email = p.partner_campaign_id
        ? emails.find((e) => e.id === p.partner_campaign_id) || null
        : null;
      if (email) linked.add(email.id);
      out.push({ key: `page-${p.id}`, name: p.name, page: p, email, sortAt: p.created_at });
    }
    for (const e of emails) {
      if (linked.has(e.id)) continue;
      out.push({ key: `email-${e.id}`, name: e.name, page: null, email: e, sortAt: (e as any).created_at || "" });
    }

    return out
      .filter((r) => (filter === "email" ? !!r.email : filter === "page" ? !!r.page : true))
      .sort((a, b) => (a.sortAt < b.sortAt ? 1 : -1));
  }, [pages, emails, filter]);

  const send = async (id: string, test: boolean) => {
    setSendingId(id);
    const res = await sendEmailCampaign(id, test);
    setSendingId(null);
    if (!res.ok) {
      toast({ title: "Send failed", description: res.message, variant: "destructive" });
      return;
    }
    toast({
      title: test ? "Test sent to you" : "Campaign sent",
      description: `${res.delivered} of ${res.recipients} delivered`,
    });
    refreshEmails();
  };

  const removeEmail = async (id: string) => {
    if (!window.confirm("Delete this email campaign? The landing page, if any, stays.")) return;
    await supabase.from("partner_campaigns").delete().eq("id", id);
    refreshEmails();
    refreshPages();
  };

  const addEmailToPage = (page: CampaignPage) => {
    setEditingEmail(null);
    setLinkPageAfterEmail(page);
    setEmailPrefill({
      name: page.name,
      subject: page.copy?.hero?.headline || page.name,
    });
    setEmailOpen(true);
  };

  const addPageToEmail = (email: EmailCampaign) => {
    setCreatePageFor(email);
    setCreatePageOpen(true);
  };

  if (pagesQuery.isLoading) return <LoadingState label="Loading campaigns" />;

  const live = pagesQuery.data?.live;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Megaphone className="h-4 w-4" /> Campaigns
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl">
            One campaign, two channels: an email to your leads and a public landing page. Only one landing page can be
            live at a time, and referral attribution keeps working exactly as before.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {partnerId && (
            <Button
              variant="outline"
              className="rounded-xl gap-2"
              onClick={() => {
                setEditingEmail(null);
                setLinkPageAfterEmail(null);
                setEmailPrefill(undefined);
                setEmailOpen(true);
              }}
            >
              <Mail className="h-4 w-4" /> New email
            </Button>
          )}
          <Button
            className="rounded-xl gap-2"
            onClick={() => {
              setCreatePageFor(null);
              setCreatePageOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New campaign page
          </Button>
        </div>
      </div>

      {live && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Live now: {live.name}
              </p>
              <p className="text-xs text-muted-foreground">/c/{live.slug}</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-lg gap-1.5" asChild>
              <a href={campaignPageUrl(live.slug)} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Open
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {partnerId && (
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              ["email", "Emails"],
              ["page", "Landing pages"],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={filter === key ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Megaphone className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              No campaigns yet. Start with an email to your leads, or a landing page the engine writes in Brandie's
              voice.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const c = row.page;
            const e = row.email;
            return (
              <Card key={row.key}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium truncate">{row.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c ? `/c/${c.slug}` : e?.subject}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className={c ? STATUS_TONE[c.status] || "" : "text-muted-foreground"}>
                        Page: {c ? CAMPAIGN_STATUS_LABELS[c.status] ?? c.status : "none"}
                      </Badge>
                      <Badge variant="outline" className={e ? EMAIL_TONE[e.status] || "" : "text-muted-foreground"}>
                        Email: {e ? e.status : "none"}
                        {e?.sent_at ? ` · ${e.delivered_count} delivered` : ""}
                      </Badge>
                    </div>
                  </div>

                  {c?.goal && <p className="text-sm text-muted-foreground line-clamp-2">{c.goal}</p>}
                  {c?.review_note && (
                    <p className="text-xs rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-400">
                      Reviewer note: {c.review_note}
                    </p>
                  )}
                  {e && (
                    <p className="text-xs text-muted-foreground">
                      Audience:{" "}
                      {Array.isArray(e.audience?.statuses) && e.audience.statuses.length
                        ? e.audience.statuses.join(", ")
                        : "all leads"}
                      {e.scheduled_for && e.status === "scheduled"
                        ? ` · sends ${new Date(e.scheduled_for).toLocaleString()}`
                        : ""}
                    </p>
                  )}

                  {c && (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        ["Views", c.views_count],
                        ["Clicks", c.clicks_count],
                        ["Signups", c.signups_count],
                      ].map(([label, value]) => (
                        <div key={label as string} className="rounded-lg border border-border py-2">
                          <p className="text-sm font-semibold">{value as number}</p>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {label as string}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Channel actions */}
                  <div className="flex flex-wrap gap-2">
                    {c ? (
                      <>
                        <Button size="sm" variant="outline" className="rounded-lg gap-1.5" onClick={() => setEditingPage(c)}>
                          <Sparkles className="h-3.5 w-3.5" /> Edit page
                        </Button>
                        <Button size="sm" variant="ghost" className="rounded-lg gap-1.5" onClick={() => setPreviewing(c)}>
                          <Eye className="h-3.5 w-3.5" /> Preview
                        </Button>
                        <Button size="sm" variant="ghost" className="rounded-lg gap-1.5" onClick={() => setStatsFor(c)}>
                          <BarChart3 className="h-3.5 w-3.5" /> Stats
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-lg gap-1.5"
                          onClick={() => {
                            navigator.clipboard.writeText(campaignPageUrl(c.slug));
                            toast({ title: "Link copied" });
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" /> Link
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg gap-1.5"
                        onClick={() => addPageToEmail(e!)}
                      >
                        <Megaphone className="h-3.5 w-3.5" /> Add landing page
                      </Button>
                    )}

                    {e ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg gap-1.5"
                          onClick={() => {
                            setLinkPageAfterEmail(null);
                            setEmailPrefill(undefined);
                            setEditingEmail(e);
                            setEmailOpen(true);
                          }}
                        >
                          <Mail className="h-3.5 w-3.5" /> Edit email
                        </Button>
                        {["sent", "sending", "failed"].includes(e.status) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-lg gap-1.5"
                            onClick={() => setRecipientsFor(e)}
                          >
                            <Users className="h-3.5 w-3.5" /> Recipients
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-lg"
                          disabled={sendingId === e.id}
                          onClick={() => send(e.id, true)}
                        >
                          Send test
                        </Button>
                        <Button
                          size="sm"
                          className="rounded-lg gap-1.5"
                          disabled={sendingId === e.id || e.status === "sent"}
                          onClick={() => send(e.id, false)}
                        >
                          {sendingId === e.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          {e.status === "sent" ? "Sent" : "Send now"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-lg text-muted-foreground"
                          onClick={() => removeEmail(e.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      partnerId && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg gap-1.5"
                          onClick={() => addEmailToPage(c!)}
                        >
                          <Mail className="h-3.5 w-3.5" /> Add email
                        </Button>
                      )
                    )}
                  </div>

                  {/* Lifecycle actions for the landing page */}
                  {c && (
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
                      {["draft", "rejected"].includes(c.status) && (
                        <Button
                          size="sm"
                          className="rounded-lg gap-1.5"
                          disabled={pageAction.isPending}
                          onClick={() => pageAction.mutate({ action: "submit", campaign_id: c.id })}
                        >
                          <Send className="h-3.5 w-3.5" /> {isAdmin ? "Mark ready" : "Submit for approval"}
                        </Button>
                      )}
                      {isAdmin && c.status === "pending_review" && (
                        <>
                          <Button
                            size="sm"
                            className="rounded-lg gap-1.5"
                            disabled={pageAction.isPending}
                            onClick={() => pageAction.mutate({ action: "approve", campaign_id: c.id })}
                          >
                            <Check className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg gap-1.5"
                            disabled={pageAction.isPending}
                            onClick={() => {
                              const note = window.prompt("Why is this campaign rejected?") || "";
                              pageAction.mutate({ action: "reject", campaign_id: c.id, note });
                            }}
                          >
                            <X className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </>
                      )}
                      {isAdmin && ["approved", "paused", "archived"].includes(c.status) && (
                        <Button
                          size="sm"
                          className="rounded-lg gap-1.5"
                          disabled={pageAction.isPending}
                          onClick={() => pageAction.mutate({ action: "activate", campaign_id: c.id })}
                        >
                          <Play className="h-3.5 w-3.5" /> Put live
                        </Button>
                      )}
                      {c.status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg gap-1.5"
                          disabled={pageAction.isPending}
                          onClick={() => pageAction.mutate({ action: "pause", campaign_id: c.id })}
                        >
                          <Pause className="h-3.5 w-3.5" /> Pause
                        </Button>
                      )}
                      {c.status !== "active" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-lg gap-1.5 text-destructive hover:text-destructive"
                          disabled={pageAction.isPending}
                          onClick={() => {
                            if (window.confirm(`Delete the page “${c.name}”? This cannot be undone.`)) {
                              pageAction.mutate({ action: "delete", campaign_id: c.id });
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete page
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateCampaignDialog
        key={createPageFor?.id || "new"}
        open={createPageOpen}
        onOpenChange={(v) => {
          setCreatePageOpen(v);
          if (!v) setCreatePageFor(null);
        }}
        partnerCampaignId={createPageFor?.id || null}
        prefill={
          createPageFor
            ? { name: createPageFor.name, goal: createPageFor.subject, offer_text: "" }
            : undefined
        }
        onCreated={(c) => {
          refreshPages();
          setCreatePageOpen(false);
          setCreatePageFor(null);
          setEditingPage(c);
        }}
      />

      {editingPage && (
        <EditCampaignDialog
          campaign={editingPage}
          onOpenChange={(open) => !open && setEditingPage(null)}
          onSaved={(c) => {
            refreshPages();
            setEditingPage(c);
          }}
          onPreview={(c) => {
            setEditingPage(null);
            setPreviewing(c);
          }}
        />
      )}

      {previewing && (
        <Dialog open onOpenChange={(open) => !open && setPreviewing(null)}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>Preview: {previewing.name}</DialogTitle>
              <DialogDescription>Exactly what a visitor sees at /c/{previewing.slug}.</DialogDescription>
            </DialogHeader>
            <div className="border-t border-border">
              <div className="pointer-events-none">
                <CampaignLanding
                  copy={(previewing.copy || {}) as CampaignCopy}
                  sections={normaliseSections(previewing.sections)}
                  signupHref="/auth"
                  preview
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {statsFor && <StatsDialog campaign={statsFor} onOpenChange={(open) => !open && setStatsFor(null)} />}

      {partnerId && (
        <EmailCampaignDialog
          open={emailOpen}
          partnerId={partnerId}
          campaign={editingEmail}
          prefill={emailPrefill}
          onOpenChange={(v) => {
            setEmailOpen(v);
            if (!v) {
              setEditingEmail(null);
              setLinkPageAfterEmail(null);
              setEmailPrefill(undefined);
            }
          }}
          onSaved={async (saved) => {
            // Adding an email to an existing page links the two records.
            if (linkPageAfterEmail && !editingEmail) {
              try {
                await callEngine({
                  action: "update",
                  campaign_id: linkPageAfterEmail.id,
                  partner_campaign_id: saved.id,
                });
              } catch {
                /* the email still exists on its own; the link can be retried */
              }
              setLinkPageAfterEmail(null);
              refreshPages();
            }
            refreshEmails();
          }}
        />
      )}

      <PartnerCampaignSendsDialog
        campaignId={recipientsFor?.id ?? null}
        campaignName={recipientsFor?.name}
        onClose={() => setRecipientsFor(null)}
      />
    </div>
  );
};

export default UnifiedCampaigns;
