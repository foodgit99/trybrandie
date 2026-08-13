import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  MoreVertical,
  MoveRight,
  Pencil,
  Plus,
  Trash2,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CONTENT_CATEGORIES, getCategoryMeta } from "@/lib/contentCategories";
import IdeaThumb from "@/components/v2/IdeaThumb";
import {
  DEFAULT_FUNNEL_STAGES,
  type FunnelStageDef,
  type FunnelStageId,
  getEffectiveStage,
  resolveBrandStages,
  slugifyStageId,
} from "@/lib/funnelStages";


export type FunnelIdea = {
  id: string;
  title: string;
  status: string;
  scheduled_for: string | null;
  content_category: string | null;
  funnel_stage?: string | null;
  design_id: string | null;
  design?: { image_url: string | null; caption: string | null } | null;
};

type Brand = { id: string; funnel_stages?: unknown };

type Props = {
  ideas: FunnelIdea[];
  brand: Brand;
  onOpenPost: (id: string) => void;
  /** React Query keys whose results should be refreshed after edits. */
  invalidateKeys?: string[][];
};

const FunnelsEditableTab = ({ ideas, brand, onOpenPost, invalidateKeys = [] }: Props) => {
  const stages = useMemo(() => resolveBrandStages(brand.funnel_stages), [brand.funnel_stages]);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editStagesOpen, setEditStagesOpen] = useState(false);
  const [openStages, setOpenStages] = useState<Record<string, boolean>>({});

  const stageBuckets = useMemo(() => {
    const map: Record<FunnelStageId, FunnelIdea[]> = {};
    for (const s of stages) map[s.id] = [];
    for (const i of ideas) {
      const stage = getEffectiveStage(i, stages);
      (map[stage] ||= []).push(i);
    }
    return map;
  }, [ideas, stages]);


  const totals = ideas.length;

  const invalidate = () => {
    invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
  };

  const moveIdea = useMutation({
    mutationFn: async ({ ideaId, stage }: { ideaId: string; stage: FunnelStageId }) => {
      const { error } = await supabase
        .from("content_ideas")
        .update({ funnel_stage: stage } as never)
        .eq("id", ideaId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast({ title: "Moved", description: `Post moved to ${labelOf(stages, vars.stage)}.` });
      invalidate();
    },
    onError: (e: any) => toast({ title: "Couldn't move post", description: e.message, variant: "destructive" }),
  });

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-muted-foreground">
          Stages auto-fill from each post's category — override the bucket below or rename a stage to match how you sell.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full h-9 gap-1.5"
          onClick={() => setEditStagesOpen(true)}
        >
          <Pencil className="h-3.5 w-3.5" /> Edit stages
        </Button>
      </div>

      {/* Stage cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stages.map((s) => {
          const bucket = stageBuckets[s.id] ?? [];
          const pct = totals ? Math.round((bucket.length / totals) * 100) : 0;
          const Icon = s.icon;
          return (
            <div
              key={s.id}
              className={cn(
                "relative overflow-hidden rounded-2xl border border-border p-4 bg-gradient-to-br",
                s.accent,
              )}
            >
              <div className="flex items-start justify-between">
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{pct}%</span>
              </div>
              <div className="mt-6">
                <div className="text-2xl font-semibold">{bucket.length}</div>
                <div className="text-sm font-medium mt-0.5">{s.label}</div>
                <div className="text-[11px] opacity-80 mt-1">{s.blurb}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stage lists */}
      {stages.map((s, stageIdx) => {
        const bucketAll = stageBuckets[s.id] ?? [];
        const items = bucketAll.slice(0, 8);
        const isOpen = openStages[s.id] ?? stageIdx === 0;

        const Icon = s.icon;
        return (
          <div key={s.id} className="rounded-2xl border border-border bg-card/40">
            <button
              type="button"
              onClick={() => setOpenStages((prev) => ({ ...prev, [s.id]: !isOpen }))}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-secondary/40 transition-colors rounded-2xl"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">{s.label}</h3>
                <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0">
                  {bucketAll.length}
                </Badge>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  isOpen && "rotate-180",
                )}
              />
            </button>
            {isOpen && (
            <div className="border-t border-border">

            {items.length === 0 ? (
              <div className="p-5 text-xs text-muted-foreground">
                No content here yet. Move a post in, or ask the strategist to generate {s.label.toLowerCase()} ideas.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((i) => {
                  const cat = getCategoryMeta(i.content_category ?? "");
                  return (
                    <li key={i.id} className="group flex items-center gap-2 pr-2">
                      <button
                        onClick={() => onOpenPost(i.id)}
                        className="flex-1 flex items-center gap-3 p-3 text-left hover:bg-secondary/50 transition-colors min-w-0"
                      >
                        <IdeaThumb design={i.design} emoji={cat?.emoji} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm truncate">{i.title}</span>
                          <span className="block text-[11px] text-muted-foreground truncate">
                            {i.scheduled_for ?? "Unscheduled"} · {i.status}
                          </span>
                          {i.design?.caption && (
                            <span className="block text-[11px] text-muted-foreground/80 italic truncate mt-0.5">
                              "{i.design.caption}"
                            </span>
                          )}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                            aria-label="Move post"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel className="text-xs">Move to stage</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {stages.map((target) => {
                            const isCurrent = target.id === s.id;
                            const Tic = target.icon;
                            return (
                              <DropdownMenuItem
                                key={target.id}
                                disabled={isCurrent || moveIdea.isPending}
                                onSelect={(e) => {
                                  e.preventDefault();
                                  if (isCurrent) return;
                                  moveIdea.mutate({ ideaId: i.id, stage: target.id });
                                }}
                              >
                                <Tic className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                                <span className="flex-1">{target.label}</span>
                                {isCurrent ? (
                                  <Check className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : (
                                  <MoveRight className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  );
                })}
              </ul>
            )}
            </div>
            )}
          </div>

        );
      })}

      <EditStagesDialog
        open={editStagesOpen}
        onClose={() => setEditStagesOpen(false)}
        brand={brand}
        stages={stages}
        onSaved={invalidate}
      />
    </section>
  );
};

function labelOf(stages: FunnelStageDef[], id: FunnelStageId) {
  return stages.find((s) => s.id === id)?.label ?? id;
}

/* -------------------- Edit Stages Dialog -------------------- */

type DraftStage = {
  id: FunnelStageId;
  label: string;
  blurb: string;
  categories: string[];
  art_direction: string;
  custom: boolean;
};

function EditStagesDialog({
  open,
  onClose,
  brand,
  stages,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  brand: { id: string };
  stages: FunnelStageDef[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const toDraft = (list: FunnelStageDef[]): DraftStage[] =>
    list.map((s) => ({
      id: s.id,
      label: s.label,
      blurb: s.blurb,
      categories: [...s.categories],
      art_direction: s.art_direction ?? "",
      custom: !!s.custom,
    }));

  const [draft, setDraft] = useState<DraftStage[]>(() => toDraft(stages));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(toDraft(stages));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const patch = (id: string, next: Partial<DraftStage>) =>
    setDraft((prev) => prev.map((x) => (x.id === id ? { ...x, ...next } : x)));

  const move = (idx: number, dir: -1 | 1) =>
    setDraft((prev) => {
      const to = idx + dir;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[to]] = [next[to], next[idx]];
      return next;
    });

  const remove = (id: string) => setDraft((prev) => prev.filter((x) => x.id !== id));

  const addStage = () => {
    setDraft((prev) => {
      const id = slugifyStageId(`Stage ${prev.length + 1}`, prev.map((p) => p.id));
      return [...prev, { id, label: "", blurb: "", categories: [], art_direction: "", custom: true }];
    });
  };

  const toggleCategory = (stageId: string, catId: string) =>
    setDraft((prev) =>
      prev.map((s) => {
        if (s.id !== stageId) {
          // a category belongs to exactly one stage
          return { ...s, categories: s.categories.filter((c) => c !== catId) };
        }
        return {
          ...s,
          categories: s.categories.includes(catId)
            ? s.categories.filter((c) => c !== catId)
            : [...s.categories, catId],
        };
      }),
    );

  const save = async () => {
    const cleaned = draft
      .map((d) => ({ ...d, label: d.label.trim(), blurb: d.blurb.trim() }))
      .filter((d) => d.label || !d.custom);

    if (cleaned.length === 0) {
      toast({
        title: "Add at least one stage",
        description: "Your funnel needs a stage for the planner to route content into.",
        variant: "destructive",
      });
      return;
    }
    const missingLabel = cleaned.find((d) => !d.label);
    if (missingLabel) {
      toast({ title: "Every stage needs a name", variant: "destructive" });
      return;
    }

    // Regenerate ids for custom stages so they read like their label.
    const taken: string[] = [];
    const stored = cleaned.map((d) => {
      let id = d.id;
      if (d.custom && (!id || id.startsWith("stage-") || id === "stage")) {
        id = slugifyStageId(d.label, taken);
      }
      taken.push(id);
      return {
        id,
        label: d.label,
        blurb: d.blurb,
        categories: d.categories,
        ...(d.art_direction.trim() ? { art_direction: d.art_direction.trim() } : {}),
        ...(d.custom ? { custom: true } : {}),
      };
    });

    setSaving(true);
    const { error } = await supabase
      .from("brands")
      .update({ funnel_stages: stored } as never)
      .eq("id", brand.id);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save stages", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Funnel updated",
      description: "The planner and renderer will use these stages from your next generation.",
    });
    onSaved();
    onClose();
  };

  const resetDefaults = () => setDraft(toDraft(DEFAULT_FUNNEL_STAGES));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit funnel stages</DialogTitle>
          <DialogDescription>
            Rename, reorder, remove or add stages so the funnel matches how you actually sell. Categories decide
            where new posts land, and art direction tells the designer how each stage should look.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {draft.map((d, idx) => {
            const def = DEFAULT_FUNNEL_STAGES.find((x) => x.id === d.id);
            return (
              <div key={d.id} className="rounded-xl border border-border p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Stage {idx + 1}
                    {d.custom && <span className="ml-2 normal-case tracking-normal">· custom</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Move stage up"
                      disabled={idx === 0}
                      onClick={() => move(idx, -1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Move stage down"
                      disabled={idx === draft.length - 1}
                      onClick={() => move(idx, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      aria-label="Remove stage"
                      onClick={() => remove(d.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`label-${d.id}`} className="text-xs">Name</Label>
                    <Input
                      id={`label-${d.id}`}
                      value={d.label}
                      placeholder={def?.label ?? "e.g. Warm-up"}
                      onChange={(e) => patch(d.id, { label: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`blurb-${d.id}`} className="text-xs">One-line description</Label>
                    <Input
                      id={`blurb-${d.id}`}
                      value={d.blurb}
                      placeholder={def?.blurb ?? "What this stage is for."}
                      onChange={(e) => patch(d.id, { blurb: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Categories that land here</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {CONTENT_CATEGORIES.map((c) => {
                      const active = d.categories.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleCategory(d.id, c.id)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                            active
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border text-muted-foreground hover:bg-secondary/60",
                          )}
                        >
                          {c.emoji} {c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`art-${d.id}`} className="text-xs">
                    Art direction for the designer {def ? "(optional — overrides the built-in direction)" : ""}
                  </Label>
                  <Textarea
                    id={`art-${d.id}`}
                    rows={2}
                    value={d.art_direction}
                    placeholder="e.g. Bold single-subject hero shot, huge headline, one clear CTA."
                    onChange={(e) => patch(d.id, { art_direction: e.target.value })}
                  />
                </div>
              </div>
            );
          })}

          <Button variant="outline" className="w-full rounded-xl gap-1.5" onClick={addStage}>
            <Plus className="h-3.5 w-3.5" /> Add stage
          </Button>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
          <Button variant="ghost" onClick={resetDefaults} disabled={saving}>
            Reset to defaults
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save stages"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FunnelsEditableTab;
