import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAccessToken } from "@/lib/authStore";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingState } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart3,
  Copy,
  ExternalLink,
  Eye,
  Megaphone,
  Pause,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Send,
  Check,
  X,
} from "lucide-react";
import {
  CAMPAIGN_SECTION_HINTS,
  CAMPAIGN_SECTION_KEYS,
  CAMPAIGN_SECTION_LABELS,
  CAMPAIGN_STATUS_LABELS,
  campaignPageUrl,
  normaliseSections,
  type CampaignCopy,
  type CampaignPage,
  type CampaignSectionKey,
} from "@/lib/campaignSections";
import CampaignLanding from "@/components/campaign/CampaignLanding";

const STATUS_TONE: Record<string, string> = {
  active: "bg-primary/15 text-primary border-primary/30",
  approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  pending_review: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
};

type ListResponse = {
  campaigns: CampaignPage[];
  live: { id: string; name: string; slug: string } | null;
  is_admin: boolean;
  partner: { id: string; name: string } | null;
};

async function callEngine<T = any>(body: Record<string, unknown>): Promise<T> {
  const token = await getAccessToken();
  const { data, error } = await supabase.functions.invoke("campaign-engine", {
    body,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (error) {
    const detail = (data as any)?.error;
    throw new Error(detail || error.message);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

const DEFAULT_SECTIONS: CampaignSectionKey[] = ["hero", "features", "how_it_works", "testimonials", "pricing", "cta"];

/** Campaign module for partners (create + submit) and admins (approve + activate). */
const CampaignManager = () => {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CampaignPage | null>(null);
  const [previewing, setPreviewing] = useState<CampaignPage | null>(null);
  const [statsFor, setStatsFor] = useState<CampaignPage | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["campaign-pages"],
    queryFn: () => callEngine<ListResponse>({ action: "list" }),
    staleTime: 20_000,
  });

  const isAdmin = !!data?.is_admin;
  const campaigns = data?.campaigns ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["campaign-pages"] });

  const action = useMutation({
    mutationFn: (body: Record<string, unknown>) => callEngine(body),
    onSuccess: () => {
      refresh();
      toast({ title: "Campaign updated" });
    },
    onError: (e: Error) => toast({ title: "That didn't work", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <LoadingState label="Loading campaigns" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Megaphone className="h-4 w-4" /> Campaign pages
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl">
            A campaign is a billboard: only one can be live at a time. When it is live, Brandie's home page points visitors
            to it and referral attribution keeps working exactly as before.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="rounded-xl gap-2">
          <Plus className="h-4 w-4" /> New campaign
        </Button>
      </div>

      {data?.live && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Live now: {data.live.name}
              </p>
              <p className="text-xs text-muted-foreground">/c/{data.live.slug}</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-lg gap-1.5" asChild>
              <a href={campaignPageUrl(data.live.slug)} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Open
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Megaphone className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              No campaigns yet. Create one, let the engine write the page in Brandie's voice, then submit it for approval.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-base truncate">{c.name}</CardTitle>
                    <CardDescription className="text-xs truncate">/c/{c.slug}</CardDescription>
                  </div>
                  <Badge variant="outline" className={STATUS_TONE[c.status] || ""}>
                    {CAMPAIGN_STATUS_LABELS[c.status] ?? c.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {c.goal && <p className="text-sm text-muted-foreground line-clamp-2">{c.goal}</p>}
                {c.review_note && (
                  <p className="text-xs rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-400">
                    Reviewer note: {c.review_note}
                  </p>
                )}

                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Views", c.views_count],
                    ["Clicks", c.clicks_count],
                    ["Signups", c.signups_count],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-lg border border-border py-2">
                      <p className="text-sm font-semibold">{value as number}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label as string}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="rounded-lg gap-1.5" onClick={() => setEditing(c)}>
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
                </div>

                <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
                  {["draft", "rejected"].includes(c.status) && (
                    <Button
                      size="sm"
                      className="rounded-lg gap-1.5 mt-3"
                      disabled={action.isPending}
                      onClick={() => action.mutate({ action: "submit", campaign_id: c.id })}
                    >
                      <Send className="h-3.5 w-3.5" /> {isAdmin ? "Mark ready" : "Submit for approval"}
                    </Button>
                  )}
                  {isAdmin && c.status === "pending_review" && (
                    <>
                      <Button
                        size="sm"
                        className="rounded-lg gap-1.5 mt-3"
                        disabled={action.isPending}
                        onClick={() => action.mutate({ action: "approve", campaign_id: c.id })}
                      >
                        <Check className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg gap-1.5 mt-3"
                        disabled={action.isPending}
                        onClick={() => {
                          const note = window.prompt("Why is this campaign rejected?") || "";
                          action.mutate({ action: "reject", campaign_id: c.id, note });
                        }}
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </>
                  )}
                  {isAdmin && ["approved", "paused", "archived"].includes(c.status) && (
                    <Button
                      size="sm"
                      className="rounded-lg gap-1.5 mt-3"
                      disabled={action.isPending}
                      onClick={() => action.mutate({ action: "activate", campaign_id: c.id })}
                    >
                      <Play className="h-3.5 w-3.5" /> Put live
                    </Button>
                  )}
                  {c.status === "active" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg gap-1.5 mt-3"
                      disabled={action.isPending}
                      onClick={() => action.mutate({ action: "pause", campaign_id: c.id })}
                    >
                      <Pause className="h-3.5 w-3.5" /> Pause
                    </Button>
                  )}
                  {c.status !== "active" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-lg gap-1.5 mt-3 text-destructive hover:text-destructive"
                      disabled={action.isPending}
                      onClick={() => {
                        if (window.confirm(`Delete “${c.name}”? This cannot be undone.`)) {
                          action.mutate({ action: "delete", campaign_id: c.id });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateCampaignDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(c) => {
          refresh();
          setCreateOpen(false);
          setEditing(c);
        }}
      />

      {editing && (
        <EditCampaignDialog
          campaign={editing}
          onOpenChange={(open) => !open && setEditing(null)}
          onSaved={(c) => {
            refresh();
            setEditing(c);
          }}
          onPreview={(c) => {
            setEditing(null);
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
    </div>
  );
};

/* ---------------------------------- create --------------------------------- */

const CreateCampaignDialog = ({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (c: CampaignPage) => void;
}) => {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [audience, setAudience] = useState("");
  const [offer, setOffer] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [sections, setSections] = useState<CampaignSectionKey[]>(DEFAULT_SECTIONS);

  const create = useMutation({
    mutationFn: async () => {
      const res = await callEngine<{ campaign: CampaignPage }>({
        action: "create",
        name,
        goal,
        audience,
        offer_text: offer,
        sections,
        ends_at: endsAt || null,
      });
      return res.campaign;
    },
    onSuccess: (c) => {
      toast({ title: "Campaign created", description: "Now generate the page copy." });
      setName("");
      setGoal("");
      setAudience("");
      setOffer("");
      setEndsAt("");
      onCreated(c);
    },
    onError: (e: Error) => toast({ title: "Couldn't create it", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New campaign</DialogTitle>
          <DialogDescription>
            Tell the engine who this is for and what the offer is. It writes the page in Brandie's voice.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Campaign name</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Lagos Fashion Week push" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-goal">Goal</Label>
            <Textarea
              id="c-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={2}
              placeholder="Get 200 fashion founders to start a free engine before the show."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-audience">Target audience</Label>
            <Textarea
              id="c-audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              rows={2}
              placeholder="Lagos fashion brand owners selling on Instagram and WhatsApp."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-offer">Offer or hook (optional)</Label>
            <Input
              id="c-offer"
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              placeholder="35 free credits for the first week"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-ends">Ends on (optional)</Label>
            <Input id="c-ends" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>

          <SectionPicker sections={sections} onChange={setSections} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Creating…" : "Create campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const SectionPicker = ({
  sections,
  onChange,
}: {
  sections: CampaignSectionKey[];
  onChange: (s: CampaignSectionKey[]) => void;
}) => (
  <div className="space-y-2">
    <Label>Page sections</Label>
    <div className="space-y-2 rounded-xl border border-border p-3">
      {CAMPAIGN_SECTION_KEYS.map((key) => {
        const locked = key === "hero";
        const checked = sections.includes(key);
        return (
          <label key={key} className="flex items-start gap-3 text-sm cursor-pointer">
            <Checkbox
              checked={checked}
              disabled={locked}
              onCheckedChange={(v) =>
                onChange(
                  v
                    ? normaliseSections([...sections, key])
                    : normaliseSections(sections.filter((s) => s !== key)),
                )
              }
            />
            <span className="space-y-0.5">
              <span className="font-medium">{CAMPAIGN_SECTION_LABELS[key]}</span>
              <span className="block text-xs text-muted-foreground">{CAMPAIGN_SECTION_HINTS[key]}</span>
            </span>
          </label>
        );
      })}
    </div>
  </div>
);

/* ----------------------------------- edit ---------------------------------- */

const EditCampaignDialog = ({
  campaign,
  onOpenChange,
  onSaved,
  onPreview,
}: {
  campaign: CampaignPage;
  onOpenChange: (v: boolean) => void;
  onSaved: (c: CampaignPage) => void;
  onPreview: (c: CampaignPage) => void;
}) => {
  const [sections, setSections] = useState<CampaignSectionKey[]>(normaliseSections(campaign.sections));
  const [copy, setCopy] = useState<CampaignCopy>((campaign.copy || {}) as CampaignCopy);
  const hasCopy = useMemo(() => Object.keys(copy || {}).length > 0, [copy]);

  const generate = useMutation({
    mutationFn: async () => {
      const res = await callEngine<{ campaign: CampaignPage }>({
        action: "generate_copy",
        campaign_id: campaign.id,
        sections,
      });
      return res.campaign;
    },
    onSuccess: (c) => {
      setCopy((c.copy || {}) as CampaignCopy);
      setSections(normaliseSections(c.sections));
      toast({ title: "Page written", description: "Review the copy, then preview it." });
      onSaved(c);
    },
    onError: (e: Error) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
  });

  const save = useMutation({
    mutationFn: async () => {
      const res = await callEngine<{ campaign: CampaignPage }>({
        action: "update",
        campaign_id: campaign.id,
        sections,
        copy,
      });
      return res.campaign;
    },
    onSuccess: (c) => {
      toast({ title: "Saved" });
      onSaved(c);
    },
    onError: (e: Error) => toast({ title: "Couldn't save", description: e.message, variant: "destructive" }),
  });

  const setHero = (field: string, value: string) =>
    setCopy((prev) => ({ ...prev, hero: { ...(prev.hero || {}), [field]: value } }));

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign.name}</DialogTitle>
          <DialogDescription>
            Generate the page, then edit any line. The layout is always Brandie's own landing template.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <SectionPicker sections={sections} onChange={setSections} />

          <Button
            variant="outline"
            className="w-full rounded-xl gap-2"
            disabled={generate.isPending}
            onClick={() => generate.mutate()}
          >
            <Sparkles className="h-4 w-4" />
            {generate.isPending ? "Writing the page…" : hasCopy ? "Rewrite the page copy" : "Generate the page copy"}
          </Button>

          {hasCopy && (
            <div className="space-y-4 rounded-xl border border-border p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Hero copy</p>
              <div className="space-y-1.5">
                <Label htmlFor="h-badge">Badge</Label>
                <Input id="h-badge" value={copy.hero?.badge || ""} onChange={(e) => setHero("badge", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="h-head">Headline</Label>
                <Textarea id="h-head" rows={2} value={copy.hero?.headline || ""} onChange={(e) => setHero("headline", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="h-sub">Sub-headline</Label>
                <Textarea id="h-sub" rows={2} value={copy.hero?.subheadline || ""} onChange={(e) => setHero("subheadline", e.target.value)} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="h-cta">Button label</Label>
                  <Input id="h-cta" value={copy.hero?.cta_label || ""} onChange={(e) => setHero("cta_label", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="h-foot">Footnote</Label>
                  <Input id="h-foot" value={copy.hero?.footnote || ""} onChange={(e) => setHero("footnote", e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Every other section is editable after saving by regenerating, or in the preview you can check how it reads
                end to end.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {hasCopy && (
            <Button variant="outline" className="gap-1.5" onClick={() => onPreview({ ...campaign, copy, sections })}>
              <Eye className="h-4 w-4" /> Preview
            </Button>
          )}
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ----------------------------------- stats --------------------------------- */

type StatsResponse = {
  totals: Record<string, number>;
  sections: Record<string, number>;
  referrals: Record<string, number>;
  campaign?: CampaignPage;
};

const StatsDialog = ({
  campaign,
  onOpenChange,
}: {
  campaign: CampaignPage;
  onOpenChange: (v: boolean) => void;
}) => {
  const { data, isLoading } = useQuery({
    queryKey: ["campaign-stats", campaign.id],
    queryFn: () => callEngine<StatsResponse>({ action: "stats", campaign_id: campaign.id }),
    refetchInterval: 30_000,
  });

  const rows = (obj?: Record<string, number>) => Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign.name}</DialogTitle>
          <DialogDescription>Live engagement on /c/{campaign.slug}, refreshed every 30 seconds.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <LoadingState label="Loading stats" />
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {["view", "cta_click", "signup", "conversion"].map((k) => (
                <div key={k} className="rounded-lg border border-border py-3">
                  <p className="text-lg font-semibold">{data?.totals?.[k] ?? 0}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.replace("_", " ")}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Sections seen</p>
              {rows(data?.sections).length === 0 ? (
                <p className="text-sm text-muted-foreground">No section views yet.</p>
              ) : (
                rows(data?.sections).map(([key, count]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span>{CAMPAIGN_SECTION_LABELS[key as CampaignSectionKey] ?? key}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Referral sources</p>
              {rows(data?.referrals).length === 0 ? (
                <p className="text-sm text-muted-foreground">No referral traffic yet.</p>
              ) : (
                rows(data?.referrals).map(([key, count]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span>{key}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CampaignManager;
