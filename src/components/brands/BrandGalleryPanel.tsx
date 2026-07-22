import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Upload, X, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type GalleryItem = { id: string; image_url: string; position?: number; label?: string | null };

const FEATURED_SLOTS = 2; // render-refs takes top 2 gallery images
const ROLE_LABEL: Record<number, { label: string; hint: string }> = {
  0: { label: "Hero", hint: "Featured as the main visual" },
  1: { label: "Support", hint: "Used as secondary reference" },
};

function SortableTile({
  item,
  index,
  onDelete,
  onLabelSave,
}: {
  item: GalleryItem;
  index: number;
  onDelete: (id: string) => void;
  onLabelSave: (id: string, label: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const [labelDraft, setLabelDraft] = useState<string>(item.label ?? "");
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const role = ROLE_LABEL[index];
  const commit = () => {
    const next = labelDraft.trim();
    if ((item.label ?? "") !== next) onLabelSave(item.id, next);
  };
  return (
    <div ref={setNodeRef} style={style} className="group touch-none space-y-1.5">
      <div className="relative aspect-square">
        <img
          src={item.image_url}
          alt={item.label ?? ""}
          className={`w-full h-full object-cover rounded-xl border pointer-events-none ${
            role ? "border-primary/60 ring-2 ring-primary/30" : "border-border"
          }`}
        />
        {role ? (
          <div
            className="absolute bottom-2 left-2 right-2 flex items-center gap-1"
            title={role.hint}
          >
            <Badge className="gap-1 px-2 py-0.5 text-[10px] font-semibold shadow-sm">
              <Sparkles className="h-2.5 w-2.5" />
              {role.label}
            </Badge>
          </div>
        ) : (
          <div className="absolute bottom-2 left-2 right-2">
            <Badge variant="secondary" className="px-2 py-0.5 text-[10px] font-medium opacity-80">
              Backup
            </Badge>
          </div>
        )}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="absolute top-2 left-2 w-6 h-6 bg-background/80 backdrop-blur border border-border rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          aria-label="Remove image"
          className="absolute top-2 right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <input
        type="text"
        value={labelDraft}
        onChange={(e) => setLabelDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        maxLength={60}
        placeholder="Add label (e.g. Product hero)"
        className="w-full text-[11px] px-2 py-1 rounded-md border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
        aria-label="Image label"
      />
    </div>
  );
}

export default function BrandGalleryPanel({
  brandId,
  userId,
  preferGalleryFirst,
  onPreferGalleryFirstChange,
}: {
  brandId: string;
  userId: string;
  preferGalleryFirst?: boolean;
  onPreferGalleryFirstChange?: (next: boolean) => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localOrder, setLocalOrder] = useState<GalleryItem[] | null>(null);
  const [preferGallery, setPreferGallery] = useState<boolean>(preferGalleryFirst ?? true);
  const [savingPref, setSavingPref] = useState(false);

  const togglePreferGallery = async (next: boolean) => {
    const prev = preferGallery;
    setPreferGallery(next);
    setSavingPref(true);
    const { error } = await supabase
      .from("brands")
      .update({ prefer_gallery_first: next })
      .eq("id", brandId);
    setSavingPref(false);
    if (error) {
      setPreferGallery(prev);
      toast({ title: "Could not save preference", description: error.message, variant: "destructive" });
      return;
    }
    onPreferGalleryFirstChange?.(next);
    toast({
      title: next ? "Gallery-first turned on" : "Gallery-first turned off",
      description: next
        ? "Brandie will prefer your exact Gallery photos in new designs."
        : "Brandie may generate replacement visuals when useful.",
    });
  };

  const { data: items = [], refetch, isLoading } = useQuery({
    queryKey: ["v2-brand-gallery", brandId],
    queryFn: async () => {
      const { data } = await supabase
        .from("brand_inspiration")
        .select("id, image_url, position, label")
        .eq("brand_id", brandId)
        .order("position", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      return (data ?? []) as GalleryItem[];
    },
  });

  const { data: nextIdea } = useQuery({
    queryKey: ["v2-brand-gallery-next-idea", brandId],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("content_ideas")
        .select("id, title, scheduled_for, content_category, status")
        .eq("brand_id", brandId)
        .gte("scheduled_for", today.toISOString())
        .not("status", "in", "(posted,failed,archived)")
        .order("scheduled_for", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data as { id: string; title: string; scheduled_for: string; content_category: string | null } | null;
    },
  });

  const gallery = localOrder ?? items;
  const nextDateLabel = nextIdea?.scheduled_for
    ? new Date(nextIdea.scheduled_for).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = gallery.findIndex((i) => i.id === active.id);
    const newIdx = gallery.findIndex((i) => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(gallery, oldIdx, newIdx);
    setLocalOrder(next);
    try {
      await Promise.all(
        next.map((item, i) =>
          supabase.from("brand_inspiration").update({ position: i }).eq("id", item.id),
        ),
      );
      await refetch();
      setLocalOrder(null);
    } catch (e: any) {
      toast({ title: "Could not save order", description: e?.message, variant: "destructive" });
      setLocalOrder(null);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    let nextPos = items.length;
    let failed = 0;
    for (const file of files) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("brand-inspiration")
        .upload(path, file);
      if (upErr) {
        failed += 1;
        continue;
      }
      const { data: urlData } = supabase.storage.from("brand-inspiration").getPublicUrl(path);
      await supabase
        .from("brand_inspiration")
        .insert({ brand_id: brandId, image_url: urlData.publicUrl, position: nextPos });
      nextPos += 1;
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    await refetch();
    if (failed) {
      toast({
        title: `Uploaded ${files.length - failed} of ${files.length}`,
        description: failed ? `${failed} file(s) failed to upload.` : undefined,
        variant: failed === files.length ? "destructive" : "default",
      });
    } else {
      toast({ title: "Added to gallery" });
    }
  };

  const deleteItem = async (id: string) => {
    const prev = gallery;
    setLocalOrder(prev.filter((i) => i.id !== id));
    const { error } = await supabase.from("brand_inspiration").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    }
    await refetch();
    setLocalOrder(null);
  };

  const saveLabel = async (id: string, label: string) => {
    const prev = gallery;
    setLocalOrder(prev.map((i) => (i.id === id ? { ...i, label } : i)));
    const { error } = await supabase
      .from("brand_inspiration")
      .update({ label: label || null })
      .eq("id", id);
    if (error) {
      toast({ title: "Could not save label", description: error.message, variant: "destructive" });
      setLocalOrder(null);
      return;
    }
    await refetch();
    setLocalOrder(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-3">
        <div className="min-w-0">
          <Label htmlFor="prefer-gallery-toggle" className="text-sm font-medium">
            Use my Gallery images first
          </Label>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            When on, Brandie prefers your exact uploaded photos over generated visuals and only invents imagery for what your Gallery can't cover.
          </p>
        </div>
        <Switch
          id="prefer-gallery-toggle"
          checked={preferGallery}
          onCheckedChange={togglePreferGallery}
          disabled={savingPref}
        />
      </div>

      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-md">
          Add real product shots, screenshots, team, or premises photos. Brandie prioritises these
          exact images in generated designs. Drag to reorder — top images are used first.
        </p>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="rounded-full gap-2 shrink-0"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? "Uploading" : "Upload"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading gallery…</div>
      ) : gallery.length === 0 ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground hover:bg-secondary/50 transition-colors"
        >
          <Upload className="h-5 w-5 mx-auto mb-2 opacity-70" />
          Tap to upload product, team, or premises photos
        </button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-background/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-primary" />
                  Next design preview
                </div>
                {nextIdea ? (
                  <p className="mt-1 text-sm text-foreground truncate">
                    <span className="font-medium">{nextIdea.title}</span>
                    {nextDateLabel ? (
                      <span className="text-muted-foreground"> · {nextDateLabel}</span>
                    ) : null}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    No upcoming post scheduled. These roles will apply to the next design generated.
                  </p>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              The top {Math.min(FEATURED_SLOTS, gallery.length)} image
              {gallery.length === 1 ? " is" : "s are"} sent to the renderer as
              {" "}<span className="font-medium text-foreground">Hero</span> and
              {" "}<span className="font-medium text-foreground">Support</span> references. Drag to change priority.
            </p>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={gallery.map((i) => i.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {gallery.map((item, idx) => (
                  <SortableTile key={item.id} item={item} index={idx} onDelete={deleteItem} onLabelSave={saveLabel} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}
