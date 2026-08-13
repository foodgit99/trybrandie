import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  Megaphone,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import IdeaThumb from "@/components/v2/IdeaThumb";
import { CONTENT_CATEGORIES, getCategoryMeta } from "@/lib/contentCategories";

/* -------------------- Campaign form validation -------------------- */

export const CAMPAIGN_QUOTA_MIN = 1;
export const CAMPAIGN_QUOTA_MAX = 30;

/**
 * Builds a zod schema for the campaign editor. `minQuota` is the number of posts
 * already assigned to the campaign — the quota can never drop below it, otherwise
 * the planner would be over-committed the moment it saves.
 */
const campaignSchema = (minQuota: number) =>
  z.object({
    name: z
      .string()
      .trim()
      .min(1, { message: "Give the campaign a name." })
      .max(120, { message: "Name must be under 120 characters." }),
    description: z
      .string()
      .trim()
      .max(500, { message: "Description must be under 500 characters." }),
    post_count: z
      .number({ invalid_type_error: "Post quota must be a whole number." })
      .int({ message: "Post quota must be a whole number." })
      .min(CAMPAIGN_QUOTA_MIN, { message: `Post quota must be at least ${CAMPAIGN_QUOTA_MIN}.` })
      .max(CAMPAIGN_QUOTA_MAX, { message: `Post quota can't exceed ${CAMPAIGN_QUOTA_MAX}.` })
      .refine((v) => v >= minQuota, {
        message: `You already have ${minQuota} post${minQuota === 1 ? "" : "s"} assigned — unassign posts first or keep the quota at ${minQuota} or above.`,
      }),
    priority: z
      .number()
      .int()
      .min(1, { message: "Pick a priority level." })
      .max(3, { message: "Pick a priority level." }),
  });

type CampaignFormValues = {
  name: string;
  description: string;
  post_count: number;
  priority: number;
};

function validateCampaignForm(
  raw: { name: string; description: string; postCount: string; priority: number },
  minQuota: number,
): { success: boolean; data: CampaignFormValues; errors: Record<string, string> } {
  const trimmed = raw.postCount.trim();
  const parsedQuota = /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  const result = campaignSchema(minQuota).safeParse({
    name: raw.name,
    description: raw.description,
    post_count: parsedQuota,
    priority: raw.priority,
  });

  const fallback: CampaignFormValues = {
    name: raw.name.trim(),
    description: raw.description.trim(),
    post_count: Number.isFinite(parsedQuota)
      ? Math.min(CAMPAIGN_QUOTA_MAX, Math.max(minQuota, parsedQuota))
      : Math.max(minQuota, CAMPAIGN_QUOTA_MIN),
    priority: raw.priority,
  };

  if (result.success) {
    return { success: true, data: result.data, errors: {} };
  }
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  if (!trimmed) errors.post_count = "Enter a post quota.";
  return { success: false, data: fallback, errors };
}

export type CampaignIdea = {
  id: string;
  title: string;
  status: string;
  scheduled_for: string | null;
  content_category: string | null;
  campaign_id: string | null;
  campaign_rationale?: string | null;
  funnel_rationale?: string | null;
  design_id: string | null;
  design?: { image_url: string | null; caption: string | null } | null;
};

export type CampaignRow = {
  id: string;
  name: string;
  description: string | null;
  post_count: number;
  priority?: number | null;
  content_category: string | null;
  created_at: string;
};

/** 1 = Low, 2 = Normal, 3 = High. Tells the weekly planner what to fill first. */
export const CAMPAIGN_PRIORITIES = [
  { value: 3, label: "High", hint: "Planner fills this campaign before anything else." },
  { value: 2, label: "Normal", hint: "Filled after high-priority campaigns." },
  { value: 1, label: "Low", hint: "Only filled when other campaigns are satisfied." },
] as const;

export function normalisePriority(v: unknown): number {
  const n = Number(v);
  return n === 1 || n === 3 ? n : 2;
}

export function priorityMeta(v: unknown) {
  const p = normalisePriority(v);
  return CAMPAIGN_PRIORITIES.find((x) => x.value === p)!;
}

type Brand = { id: string };

type Props = {
  campaigns: CampaignRow[];
  ideas: CampaignIdea[];
  brand: Brand;
  onOpenPost: (id: string) => void;
  invalidateKeys?: string[][];
};

const CampaignsEditableTab = ({ campaigns, ideas, brand, onOpenPost, invalidateKeys = [] }: Props) => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CampaignRow | null>(null);
  const [assignFor, setAssignFor] = useState<CampaignRow | null>(null);
  const [deleteFor, setDeleteFor] = useState<CampaignRow | null>(null);

  const invalidate = () => invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));

  const openNew = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (c: CampaignRow) => { setEditing(c); setEditorOpen(true); };

  // Overall quota summary across all campaigns
  const totals = useMemo(() => {
    let target = 0, assigned = 0;
    for (const c of campaigns) {
      const a = ideas.filter((i) => i.campaign_id === c.id).length;
      target += Math.max(0, c.post_count || 0);
      assigned += a;
    }
    return { target, assigned, remaining: Math.max(0, target - assigned) };
  }, [campaigns, ideas]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            Group posts into a launch, restock, seasonal moment, or product story.
          </p>
          {campaigns.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Quota across all campaigns: <span className="text-foreground font-medium">{totals.assigned}/{totals.target}</span> assigned
              {" · "}
              <span className={cn(totals.remaining > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                {totals.remaining} slot{totals.remaining === 1 ? "" : "s"} open
              </span>
            </p>
          )}
        </div>
        <Button size="sm" className="rounded-full h-9 gap-1.5" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" /> New campaign
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Megaphone className="h-6 w-6 mx-auto text-muted-foreground" />
          <h3 className="mt-3 text-sm font-medium">No campaigns yet</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            Build your first multi-post campaign around a launch, restock, or seasonal moment.
          </p>
          <Button size="sm" variant="outline" className="rounded-xl mt-4" onClick={openNew}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Create campaign
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {[...campaigns]
            .sort((a, b) => {
              const pa = normalisePriority(a.priority);
              const pb = normalisePriority(b.priority);
              if (pb !== pa) return pb - pa;
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            })
            .map((c) => {
              const cat = getCategoryMeta(c.content_category ?? "");
              const linkedIdeas = ideas.filter((i) => i.campaign_id === c.id);
              const done = linkedIdeas.filter((i) => i.status === "completed" || i.status === "posted").length;
              const target = Math.max(0, c.post_count || 0);
              const assigned = linkedIdeas.length;
              const remaining = Math.max(0, target - assigned);
              const fillPct = target ? Math.min(100, Math.round((assigned / target) * 100)) : 0;
              const deliveredPct = assigned ? Math.round((done / assigned) * 100) : 0;
              const isOver = target > 0 && assigned > target;
              return (
                <CampaignQuotaCard
                  key={c.id}
                  campaign={c}
                  category={cat}
                  linkedIdeas={linkedIdeas}
                  assigned={assigned}
                  target={target}
                  remaining={remaining}
                  fillPct={fillPct}
                  deliveredPct={deliveredPct}
                  isOver={isOver}
                  onOpenPost={onOpenPost}
                  onEdit={() => openEdit(c)}
                  onManage={() => setAssignFor(c)}
                  onDelete={() => setDeleteFor(c)}
                />
              );
            })}
        </div>
      )}


      <CampaignEditorDialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        brand={brand}
        editing={editing}
        assignedCount={editing ? ideas.filter((i) => i.campaign_id === editing.id).length : 0}
        onSaved={invalidate}
      />

      <ManagePostsDialog
        open={!!assignFor}
        onClose={() => setAssignFor(null)}
        campaign={assignFor}
        ideas={ideas}
        onSaved={invalidate}
      />

      <AlertDialog open={!!deleteFor} onOpenChange={(o) => !o && setDeleteFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteFor?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The campaign is removed and its posts are unlinked — the posts themselves stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteFor) return;
                // Unlink ideas first so post_count stays sane on any other consumer
                await supabase.from("content_ideas").update({ campaign_id: null } as never).eq("campaign_id", deleteFor.id);
                const { error } = await supabase.from("campaigns").delete().eq("id", deleteFor.id);
                if (error) {
                  toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
                } else {
                  toast({ title: "Campaign deleted" });
                  invalidate();
                }
                setDeleteFor(null);
              }}
            >
              Delete campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};



/* -------------------- Campaign editor (create / rename) -------------------- */

function CampaignEditorDialog({
  open,
  onClose,
  brand,
  editing,
  assignedCount = 0,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  brand: Brand;
  editing: CampaignRow | null;
  assignedCount?: number;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string | "none">("none");
  const [postCount, setPostCount] = useState("5");
  const [priority, setPriority] = useState(2);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setDescription(editing?.description ?? "");
    setCategory(editing?.content_category ?? "none");
    setPostCount(String(editing ? Math.max(1, editing.post_count || 1) : 5));
    setPriority(normalisePriority(editing?.priority));
  }, [open, editing]);

  const isEdit = !!editing;
  const minQuota = isEdit ? Math.max(1, assignedCount) : 1;

  // Live validation of the whole form (client-side guardrails).
  const validation = useMemo(
    () => validateCampaignForm({ name, description, postCount, priority }, minQuota),
    [name, description, postCount, priority, minQuota],
  );
  const quotaError = validation.errors.post_count;

  const save = async () => {
    if (!validation.success) {
      toast({
        title: "Check the campaign details",
        description: Object.values(validation.errors)[0],
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const payload = {
      name: validation.data.name,
      description: validation.data.description,
      content_category: category === "none" ? null : category,
      post_count: validation.data.post_count,
      priority: validation.data.priority,
    };
    let error: any = null;
    if (isEdit && editing) {
      ({ error } = await supabase.from("campaigns").update(payload as never).eq("id", editing.id));
    } else {
      if (!user) { setSaving(false); return; }
      ({ error } = await supabase
        .from("campaigns")
        .insert({ ...payload, brand_id: brand.id, user_id: user.id } as never));
    }
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }

    // Mid-cycle replan: if quota or priority changed on an existing campaign, ask the
    // weekly planner to rebalance the remaining days of this week.
    const quotaChanged = isEdit && editing
      ? Math.max(1, editing.post_count || 1) !== payload.post_count
      : false;
    const priorityChanged = isEdit && editing
      ? normalisePriority(editing.priority) !== priority
      : false;

    toast({ title: isEdit ? "Campaign updated" : "Campaign created" });
    onSaved();
    onClose();

    if (quotaChanged || priorityChanged) {
      const reasons = [
        quotaChanged ? `quota changed to ${payload.post_count} posts` : null,
        priorityChanged ? `priority changed to ${priorityMeta(priority).label}` : null,
      ].filter(Boolean).join(" and ");
      toast({
        title: "Replanning this week…",
        description: `Brandie is rebalancing the remaining days (${reasons}).`,
      });
      try {
        const { error: replanErr } = await supabase.functions.invoke("brand-engine", {
          body: {
            action: "generate_weekly_ideas",
            brand_id: brand.id,
            replan_from_today: true,
            replan_reason: `Campaign "${payload.name}" ${reasons}.`,
          },
        });
        if (replanErr) throw replanErr;
        toast({ title: "Week replanned", description: "Review the updated arc in the Blueprint." });
        onSaved();
      } catch (e: any) {
        toast({
          title: "Couldn't replan the week",
          description: e?.message || "Your campaign was saved — try replanning from the Blueprint.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit campaign" : "New campaign"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Rename or refine this campaign." : "Group multiple posts under one launch, restock, or story."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="c-name" className="text-xs">Name</Label>
            <Input
              id="c-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Summer Launch 2026"
              maxLength={120}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-desc" className="text-xs">Description</Label>
            <Textarea
              id="c-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's the goal, audience, or hook?"
              maxLength={500}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-quota" className="text-xs">Post quota</Label>
              <Input
                id="c-quota"
                type="number"
                min={1}
                max={30}
                value={postCount}
                onChange={(e) => setPostCount(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                How many posts this campaign should receive in total.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <div className="flex flex-wrap gap-1.5">
                {CAMPAIGN_PRIORITIES.map((p) => (
                  <button
                    type="button"
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    className={cn(
                      "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                      priority === p.value
                        ? "bg-foreground text-background border-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">{priorityMeta(priority).hint}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Primary category</Label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCategory("none")}
                className={cn(
                  "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                  category === "none"
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                Any
              </button>
              {CONTENT_CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                    category === c.id
                      ? "bg-foreground text-background border-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c.emoji} {c.short}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || !name.trim()}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Manage posts (assign / unassign) -------------------- */

function ManagePostsDialog({
  open,
  onClose,
  campaign,
  ideas,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  campaign: CampaignRow | null;
  ideas: CampaignIdea[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // Allow assigning posts that have no campaign OR are already in this one
  const candidates = useMemo(() => {
    if (!campaign) return [];
    const q = query.trim().toLowerCase();
    return ideas
      .filter((i) => i.campaign_id === campaign.id || i.campaign_id === null)
      .filter((i) => !q || i.title.toLowerCase().includes(q))
      .slice(0, 80);
  }, [ideas, campaign, query]);

  const toggle = async (idea: CampaignIdea) => {
    if (!campaign) return;
    setBusy(idea.id);
    const next = idea.campaign_id === campaign.id ? null : campaign.id;
    const { error } = await supabase
      .from("content_ideas")
      .update({ campaign_id: next } as never)
      .eq("id", idea.id);
    setBusy(null);
    if (error) {
      toast({ title: "Couldn't update post", description: error.message, variant: "destructive" });
      return;
    }
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage posts — {campaign?.name}</DialogTitle>
          <DialogDescription>
            Tap a post to add it to or remove it from this campaign. Posts already in another campaign are hidden.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mt-1 mb-3">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search posts…"
            className="pl-9"
          />
        </div>

        {candidates.length === 0 ? (
          <div className="text-xs text-muted-foreground p-6 text-center border border-dashed border-border rounded-xl">
            No matching posts. Posts already in another campaign are excluded.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden max-h-[50vh] overflow-y-auto">
            {candidates.map((i) => {
              const inCampaign = i.campaign_id === campaign?.id;
              const cat = getCategoryMeta(i.content_category ?? "");
              return (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    disabled={busy === i.id}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-secondary/50 transition-colors disabled:opacity-60"
                  >
                    <IdeaThumb design={i.design} emoji={cat?.emoji} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm truncate">{i.title}</span>
                      <span className="block text-[11px] text-muted-foreground truncate">
                        {i.scheduled_for ?? "Unscheduled"} · {i.status}
                      </span>
                    </span>
                    {inCampaign ? (
                      <Badge className="rounded-full text-[10px] gap-1">
                        <Check className="h-3 w-3" /> In campaign
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="rounded-full text-[10px] gap-1">
                        <Plus className="h-3 w-3" /> Add
                      </Badge>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CampaignsEditableTab;

/* -------------------- Campaign Quota Card (per-card view) -------------------- */

function CampaignQuotaCard({
  campaign,
  category,
  linkedIdeas,
  assigned,
  target,
  remaining,
  fillPct,
  deliveredPct,
  isOver,
  onOpenPost,
  onEdit,
  onManage,
  onDelete,
}: {
  campaign: CampaignRow;
  category: ReturnType<typeof getCategoryMeta>;
  linkedIdeas: CampaignIdea[];
  assigned: number;
  target: number;
  remaining: number;
  fillPct: number;
  deliveredPct: number;
  isOver: boolean;
  onOpenPost: (id: string) => void;
  onEdit: () => void;
  onManage: () => void;
  onDelete: () => void;
}) {
  const [showReasons, setShowReasons] = useState(false);
  const firstIdea = linkedIdeas[0];

  return (
    <div className="relative rounded-2xl border border-border bg-card/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => firstIdea && onOpenPost(firstIdea.id)}
          disabled={!firstIdea}
          className="text-left min-w-0 flex-1 disabled:cursor-default"
        >
          <div className="text-sm font-medium truncate">{campaign.name}</div>
          <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {campaign.description || "No description"}
          </div>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          {normalisePriority(campaign.priority) !== 2 && (
            <Badge
              variant="outline"
              className={cn(
                "rounded-full text-[10px]",
                normalisePriority(campaign.priority) === 3
                  ? "border-primary/40 text-primary"
                  : "text-muted-foreground",
              )}
              title={priorityMeta(campaign.priority).hint}
            >
              {priorityMeta(campaign.priority).label} priority
            </Badge>
          )}
          {category && (
            <Badge variant="outline" className={cn("rounded-full text-[10px]", category.badgeClass)}>
              {category.emoji} {category.short}
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Campaign actions">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil className="h-3.5 w-3.5 mr-2" /> Edit details
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onManage}>
                <Users className="h-3.5 w-3.5 mr-2" /> Manage posts
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Quota row */}
      <div className="mt-4 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground">Quota</div>
          <div className="text-sm font-medium tabular-nums">
            {assigned}<span className="text-muted-foreground"> / {target || "∞"}</span>
            <span className="text-xs text-muted-foreground"> assigned</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground">Open slots</div>
          <Badge
            variant="outline"
            className={cn(
              "rounded-full text-[11px] font-semibold px-2.5 py-0.5",
              isOver
                ? "border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10"
                : remaining > 0
                  ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
                  : "text-muted-foreground"
            )}
          >
            {isOver
              ? `Over by ${assigned - target}`
              : remaining > 0
                ? `${remaining} slot${remaining === 1 ? "" : "s"} left`
                : "Full"}
          </Badge>
        </div>
      </div>
      <div
        className="mt-1.5 h-1.5 rounded-full bg-secondary overflow-hidden"
        role="progressbar"
        aria-valuenow={fillPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${assigned} of ${target || "unlimited"} posts assigned`}
      >
        <div
          className={cn("h-full transition-[width]", isOver ? "bg-amber-500" : "bg-foreground/80")}
          style={{ width: `${Math.min(100, fillPct)}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{deliveredPct}% delivered</span>
        <button
          type="button"
          onClick={onManage}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          Manage posts <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {/* Why these posts? */}
      {linkedIdeas.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowReasons((v) => !v)}
            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            aria-expanded={showReasons}
          >
            {showReasons ? "Hide" : "Why these posts?"}
          </button>
          {showReasons && (
            <ul className="mt-2 space-y-2">
              {linkedIdeas.slice(0, 8).map((i) => (
                <li key={i.id} className="text-[11px] leading-snug">
                  <button
                    type="button"
                    onClick={() => onOpenPost(i.id)}
                    className="text-left w-full hover:bg-secondary/40 rounded-lg p-2 -mx-2 transition-colors"
                  >
                    <span className="block text-foreground truncate">{i.title}</span>
                    <span className="block text-muted-foreground italic mt-0.5">
                      {i.campaign_rationale
                        ? `"${i.campaign_rationale}"`
                        : "Manually assigned — no planner rationale recorded."}
                    </span>
                  </button>
                </li>
              ))}
              {linkedIdeas.length > 8 && (
                <li className="text-[10px] text-muted-foreground pl-2">
                  +{linkedIdeas.length - 8} more…
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

