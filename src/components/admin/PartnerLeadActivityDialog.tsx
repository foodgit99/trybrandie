import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw, Image as ImageIcon, Lightbulb, Cpu, CreditCard } from "lucide-react";
import { adminActionCall } from "./AdminPartnersTab";

interface LeadActivity {
  lead: {
    user_id: string;
    full_name: string | null;
    email: string | null;
    plan: string;
    joined: string | null;
    last_sign_in_at: string | null;
    source: string;
    attributed_at: string;
    credits_granted: number;
    credited_at: string | null;
    bonus_credits: number;
    paid_credits: number;
    generations_count: number;
    generations_reset_at: string | null;
  };
  counts: {
    designs_total: number;
    designs_24h: number;
    designs_7d: number;
    brands: number;
    ideas: number;
    revenue: number;
  };
  brands: { id: string; name: string; onboarding_complete: boolean; created_at: string }[];
  designs: {
    id: string;
    title: string | null;
    image_url: string | null;
    canvas_size: string | null;
    content_category: string | null;
    carousel_id: string | null;
    slide_index: number | null;
    quality_score: number | null;
    created_at: string;
  }[];
  ideas: {
    id: string;
    title: string | null;
    status: string | null;
    autopilot: boolean | null;
    autopilot_status: string | null;
    scheduled_for: string | null;
    content_format: string | null;
    created_at: string;
  }[];
  jobs: {
    id: string;
    kind: string | null;
    status: string | null;
    stage: string | null;
    progress: number | null;
    error: string | null;
    created_at: string;
    finished_at: string | null;
  }[];
  payments: { id: string; amount: number; status: string; created_at: string }[];
  rewards: { id: string; amount: number; remaining: number; reason: string | null; expires_at: string | null; created_at: string }[];
  fetched_at: string;
}

const fmt = (v?: string | null) =>
  v ? new Date(v).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const rel = (v?: string | null) => {
  if (!v) return "never";
  const diff = Date.now() - new Date(v).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function PartnerLeadActivityDialog({
  partnerId,
  userId,
  open,
  onOpenChange,
}: {
  partnerId: string;
  userId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [live, setLive] = useState(true);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["partner-lead-activity", partnerId, userId],
    enabled: open && !!userId,
    refetchInterval: open && live ? 15000 : false,
    queryFn: async () =>
      (await adminActionCall({
        operation: "partner_lead_activity",
        data: { partner_id: partnerId, user_id: userId },
      })) as LeadActivity,
  });

  useEffect(() => {
    if (!open) setLive(true);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {data?.lead.full_name || "Lead activity"}
            {live && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-normal text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> live
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {data?.lead.email || "Everything this lead has done in Brandie, refreshed automatically."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error || !data ? (
          <p className="py-10 text-sm text-muted-foreground text-center">
            {(error as Error)?.message || "Could not load this lead's activity."}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Metric label="Designs (24h)" value={data.counts.designs_24h} />
              <Metric label="Designs (7d)" value={data.counts.designs_7d} />
              <Metric label="Brands" value={data.counts.brands} />
              <Metric label="Revenue" value={`₦${data.counts.revenue.toLocaleString()}`} />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="rounded-full capitalize">
                {data.lead.plan}
              </Badge>
              <span>Last seen {rel(data.lead.last_sign_in_at)}</span>
              <span>· Joined {fmt(data.lead.joined)}</span>
              <span>· via {data.lead.source}</span>
              {data.lead.credits_granted > 0 && <span>· {data.lead.credits_granted} sponsored credits</span>}
              <span className="ml-auto flex items-center gap-2">
                Updated {rel(data.fetched_at)}
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => refetch()}>
                  <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setLive((v) => !v)}>
                  {live ? "Pause" : "Resume"}
                </Button>
              </span>
            </div>

            <Tabs defaultValue="designs">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="designs" className="gap-2">
                  <ImageIcon className="h-3.5 w-3.5" /> Generations
                </TabsTrigger>
                <TabsTrigger value="ideas" className="gap-2">
                  <Lightbulb className="h-3.5 w-3.5" /> Planned content
                </TabsTrigger>
                <TabsTrigger value="jobs" className="gap-2">
                  <Cpu className="h-3.5 w-3.5" /> Jobs
                </TabsTrigger>
                <TabsTrigger value="billing" className="gap-2">
                  <CreditCard className="h-3.5 w-3.5" /> Credits & billing
                </TabsTrigger>
              </TabsList>

              <TabsContent value="designs" className="mt-4 space-y-2">
                {data.designs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No designs generated yet.</p>
                ) : (
                  data.designs.map((d) => (
                    <div key={d.id} className="rounded-xl border border-border px-3 py-2 flex items-center gap-3 text-sm">
                      {d.image_url ? (
                        <img
                          src={d.image_url}
                          alt={d.title || "Design"}
                          loading="lazy"
                          className="h-10 w-10 rounded-lg object-cover border border-border"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-muted" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium">{d.title || "Untitled design"}</p>
                        <p className="text-xs text-muted-foreground">
                          {[d.content_category, d.canvas_size, d.carousel_id ? `slide ${(d.slide_index ?? 0) + 1}` : null]
                            .filter(Boolean)
                            .join(" · ") || "design"}
                        </p>
                      </div>
                      <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">{fmt(d.created_at)}</span>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="ideas" className="mt-4 space-y-2">
                {data.ideas.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No planned content yet.</p>
                ) : (
                  data.ideas.map((i) => (
                    <div key={i.id} className="rounded-xl border border-border px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{i.title || "Untitled idea"}</span>
                        {i.status && (
                          <Badge variant="outline" className="rounded-full capitalize">
                            {i.status}
                          </Badge>
                        )}
                        {i.autopilot && (
                          <Badge variant="secondary" className="rounded-full capitalize">
                            autopilot{i.autopilot_status ? ` · ${i.autopilot_status}` : ""}
                          </Badge>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {i.scheduled_for ? `For ${fmt(i.scheduled_for)}` : fmt(i.created_at)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="jobs" className="mt-4 space-y-2">
                {data.jobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No generation jobs yet.</p>
                ) : (
                  data.jobs.map((j) => (
                    <div key={j.id} className="rounded-xl border border-border px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium capitalize">{j.kind || "job"}</span>
                        <Badge
                          variant={j.status === "failed" ? "destructive" : "outline"}
                          className="rounded-full capitalize"
                        >
                          {j.status}
                        </Badge>
                        {j.stage && <span className="text-xs text-muted-foreground">{j.stage}</span>}
                        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                          {j.progress ?? 0}% · {fmt(j.created_at)}
                        </span>
                      </div>
                      {j.error && <p className="text-xs text-destructive mt-1 break-words">{j.error}</p>}
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="billing" className="mt-4 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <Metric label="Paid credits" value={data.lead.paid_credits} />
                  <Metric label="Bonus credits" value={data.lead.bonus_credits} />
                  <Metric label="Used this cycle" value={data.lead.generations_count} />
                </div>
                <div className="space-y-2">
                  {data.rewards.map((r) => (
                    <div key={r.id} className="rounded-xl border border-border px-3 py-2 text-sm flex flex-wrap gap-2">
                      <span className="font-medium">
                        {r.amount} credits{r.reason ? ` · ${r.reason}` : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">{r.remaining} left</span>
                      <span className="ml-auto text-xs text-muted-foreground">{fmt(r.created_at)}</span>
                    </div>
                  ))}
                  {data.payments.map((p) => (
                    <div key={p.id} className="rounded-xl border border-border px-3 py-2 text-sm flex flex-wrap gap-2">
                      <span className="font-medium">₦{Number(p.amount || 0).toLocaleString()}</span>
                      <Badge variant="outline" className="rounded-full capitalize">
                        {p.status}
                      </Badge>
                      <span className="ml-auto text-xs text-muted-foreground">{fmt(p.created_at)}</span>
                    </div>
                  ))}
                  {data.rewards.length === 0 && data.payments.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">No credit grants or payments yet.</p>
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
