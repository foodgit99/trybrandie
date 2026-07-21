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
import { GripVertical, Upload, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type GalleryItem = { id: string; image_url: string; position?: number };

function SortableTile({
  item,
  onDelete,
}: {
  item: GalleryItem;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative aspect-square group touch-none">
      <img
        src={item.image_url}
        alt=""
        className="w-full h-full object-cover rounded-xl border border-border pointer-events-none"
      />
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
        .select("id, image_url, position")
        .eq("brand_id", brandId)
        .order("position", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      return (data ?? []) as GalleryItem[];
    },
  });

  const gallery = localOrder ?? items;

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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={gallery.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {gallery.map((item) => (
                <SortableTile key={item.id} item={item} onDelete={deleteItem} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
