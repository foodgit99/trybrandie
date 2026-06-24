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

export type CampaignIdea = {
  id: string;
  title: string;
  status: string;
  scheduled_for: string | null;
  content_category: string | null;
  campaign_id: string | null;
  design_id: string | null;
  design?: { image_url: string | null; caption: string | null } | null;
};

export type CampaignRow = {
  id: string;
  name: string;
  description: string | null;
  post_count: number;
  content_category: string | null;
  created_at: string;
};

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

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">
          Group posts into a launch, restock, seasonal moment, or product story.
        </p>
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
          {campaigns.map((c) => {
            const cat = getCategoryMeta(c.content_category ?? "");
            const linkedIdeas = ideas.filter((i) => i.campaign_id === c.id);
            const done = linkedIdeas.filter((i) => i.status === "completed" || i.status === "posted").length;
            const pct = linkedIdeas.length ? Math.round((done / linkedIdeas.length) * 100) : 0;
            const firstIdea = linkedIdeas[0];
            return (
              <div key={c.id} className="relative rounded-2xl border border-border bg-card/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => firstIdea && onOpenPost(firstIdea.id)}
                    disabled={!firstIdea}
                    className="text-left min-w-0 flex-1 disabled:cursor-default"
                  >
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {c.description || "No description"}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    {cat && (
                      <Badge variant="outline" className={cn("rounded-full text-[10px]", cat.badgeClass)}>
                        {cat.emoji} {cat.short}
                      </Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Campaign actions">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onSelect={() => openEdit(c)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Edit details
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setAssignFor(c)}>
                          <Users className="h-3.5 w-3.5 mr-2" /> Manage posts
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => setDeleteFor(c)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{linkedIdeas.length} posts</span>
                  <span>{pct}% delivered</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-foreground/80" style={{ width: `${pct}%` }} />
                </div>

                <button
                  type="button"
                  onClick={() => setAssignFor(c)}
                  className="mt-3 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Manage posts <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <CampaignEditorDialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        brand={brand}
        editing={editing}
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
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  brand: Brand;
  editing: CampaignRow | null;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string | "none">("none");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setDescription(editing?.description ?? "");
    setCategory(editing?.content_category ?? "none");
  }, [open, editing]);

  const isEdit = !!editing;

  const save = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim(),
      content_category: category === "none" ? null : category,
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
    toast({ title: isEdit ? "Campaign updated" : "Campaign created" });
    onSaved();
    onClose();
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
