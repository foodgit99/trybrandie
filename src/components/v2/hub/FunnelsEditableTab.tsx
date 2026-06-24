import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Pencil, MoreVertical, MoveRight } from "lucide-react";
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
import { getCategoryMeta } from "@/lib/contentCategories";
import IdeaThumb from "@/components/v2/IdeaThumb";
import {
  DEFAULT_FUNNEL_STAGES,
  type FunnelStageDef,
  type FunnelStageId,
  getEffectiveStage,
  resolveBrandStages,
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

  const stageBuckets = useMemo(() => {
    const map: Record<FunnelStageId, FunnelIdea[]> = {
      awareness: [],
      consideration: [],
      conversion: [],
      retention: [],
    };
    for (const i of ideas) map[getEffectiveStage(i)].push(i);
    return map;
  }, [ideas]);

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
          const bucket = stageBuckets[s.id];
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
      {stages.map((s) => {
        const items = stageBuckets[s.id].slice(0, 8);
        const Icon = s.icon;
        return (
          <div key={s.id} className="rounded-2xl border border-border bg-card/40">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">{s.label}</h3>
                <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0">
                  {stageBuckets[s.id].length}
                </Badge>
              </div>
            </div>
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
  const [draft, setDraft] = useState(() =>
    stages.map((s) => ({ id: s.id, label: s.label, blurb: s.blurb })),
  );
  const [saving, setSaving] = useState(false);

  // Reset draft when reopening or stages change
  useMemo(() => {
    if (open) setDraft(stages.map((s) => ({ id: s.id, label: s.label, blurb: s.blurb })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async () => {
    setSaving(true);
    // Only store rows where user changed something away from the default
    const overrides = draft
      .map((d, idx) => {
        const def = DEFAULT_FUNNEL_STAGES[idx];
        const label = d.label.trim();
        const blurb = d.blurb.trim();
        const out: { id: FunnelStageId; label?: string; blurb?: string } = { id: d.id };
        if (label && label !== def.label) out.label = label;
        if (blurb && blurb !== def.blurb) out.blurb = blurb;
        return out;
      })
      .filter((o) => o.label !== undefined || o.blurb !== undefined);

    const { error } = await supabase
      .from("brands")
      .update({ funnel_stages: overrides } as never)
      .eq("id", brand.id);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save stages", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Stages updated" });
    onSaved();
    onClose();
  };

  const resetDefaults = () => {
    setDraft(DEFAULT_FUNNEL_STAGES.map((s) => ({ id: s.id, label: s.label, blurb: s.blurb })));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit funnel stages</DialogTitle>
          <DialogDescription>
            Rename a stage or tweak its description to match how you actually sell. Leave a field blank to keep the default.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {draft.map((d, idx) => {
            const def = DEFAULT_FUNNEL_STAGES[idx];
            return (
              <div key={d.id} className="rounded-xl border border-border p-3 space-y-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Stage {idx + 1}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`label-${d.id}`} className="text-xs">Label</Label>
                  <Input
                    id={`label-${d.id}`}
                    value={d.label}
                    placeholder={def.label}
                    onChange={(e) =>
                      setDraft((prev) => prev.map((x) => (x.id === d.id ? { ...x, label: e.target.value } : x)))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`blurb-${d.id}`} className="text-xs">One-line description</Label>
                  <Textarea
                    id={`blurb-${d.id}`}
                    rows={2}
                    value={d.blurb}
                    placeholder={def.blurb}
                    onChange={(e) =>
                      setDraft((prev) => prev.map((x) => (x.id === d.id ? { ...x, blurb: e.target.value } : x)))
                    }
                  />
                </div>
              </div>
            );
          })}
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
