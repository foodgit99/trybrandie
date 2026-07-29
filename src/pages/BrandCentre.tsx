import { useState, useEffect, useRef } from "react";
import SEO from "@/components/SEO";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useBrandParamSync, brandHref } from "@/hooks/useBrandParamSync";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/hooks/useBrand";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Pencil, Upload, X, ChevronDown, ChevronUp, Target, Loader2, RefreshCw, Plus, Trash2, Users, Palette, Sparkles, Star, Globe, Search, Zap } from "lucide-react";
import { useScrollRestoration, readGroupOpen, writeGroupOpen } from "@/hooks/useScrollRestoration";
import { useEditorStateMemory } from "@/hooks/useEditorStateMemory";
import { Checkbox } from "@/components/ui/checkbox";
import NewAppHeader from "@/components/v2/NewAppHeader";
import LogoDesignerDialog from "@/components/LogoDesignerDialog";
import BrandUpdates from "@/components/BrandUpdates";
import { TREND_PRESETS, getTrendById } from "@/lib/trendPresets";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

type GalleryItem = { id: string; image_url: string; position?: number };

function SortableGalleryTile({ item, onDelete }: { item: GalleryItem; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } as React.CSSProperties;
  return (
    <div ref={setNodeRef} style={style} className="relative aspect-square group touch-none">
      <img src={item.image_url} alt="" className="w-full h-full object-cover rounded-xl border border-border pointer-events-none" />
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
        className="absolute top-2 right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}


const VIBES = ["Minimal", "Bold", "Luxury", "Playful", "Corporate", "Cinematic"] as const;
const FONT_OPTIONS = [
  "DM Sans", "Inter", "Poppins", "Playfair Display", "Montserrat", "Lora",
  "Raleway", "Oswald", "Merriweather", "Roboto Slab", "Space Grotesk", "Outfit",
];
const PERSONALITY_OPTIONS = [
  "Witty", "Warm", "Bold", "Sophisticated", "Approachable",
  "Energetic", "Calm", "Edgy", "Playful", "Authoritative",
  "Inspiring", "Trustworthy",
];
const EMOTIONAL_DRIVERS = ["Status", "Security", "Growth", "Belonging", "Freedom", "Simplicity", "Recognition"] as const;

const EMPTY_INPUTS = {
  who_buys: "", life_stage: "", improving: "",
  frustrations: "", not_working: "", tried_before: "",
  success_looks_like: "", consequences: "",
  when_buy: "", hesitations: "",
  emotional_drivers: [] as string[],
};

type EditingField = null | "info" | "colors" | "typography" | "vibe" | "logo" | "tone" | "personality" | "special_instructions";

const EditorGroup: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => {
  const storageKey = `brandeditor:group:${title}`;
  const [open, setOpen] = useState(() => readGroupOpen(storageKey));

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      writeGroupOpen(storageKey, next);
      return next;
    });
  };


  return (
    <section className="space-y-4 pt-2">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-baseline gap-4 text-left group/gh"
      >
        <h2 className="font-serif text-2xl tracking-tight leading-none shrink-0 group-hover/gh:text-primary transition-colors">{title}</h2>
        <span className="h-px flex-1 bg-border" />
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {hint && open && <p className="text-sm text-muted-foreground -mt-2">{hint}</p>}
      {open && <div className="space-y-6">{children}</div>}
    </section>
  );
};


const BrandCentre = () => {

  const { brand, refetch } = useBrand();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<EditingField>(null);
  const [saving, setSaving] = useState(false);
  const [logoDesignerOpen, setLogoDesignerOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [websiteImportOpen, setWebsiteImportOpen] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [websiteScanning, setWebsiteScanning] = useState(false);
  const [websiteScanMessage, setWebsiteScanMessage] = useState("");
  const [scannedBrand, setScannedBrand] = useState<any>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [applyingImport, setApplyingImport] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({});
  const [addingProduct, setAddingProduct] = useState(false);
  const [productForm, setProductForm] = useState({ label: "", description: "", product_type: "physical", price: "", features: [] as string[], image_url: "", duration: "", pricing_model: "", is_featured: false, gallery_images: [] as string[] });
  const [newFeature, setNewFeature] = useState("");
  const [uploadingProductImage, setUploadingProductImage] = useState(false);
  const productInputRef = useRef<HTMLInputElement>(null);
  const inspirationInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Editable state
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [vibe, setVibe] = useState("");
  const [toneOfVoice, setToneOfVoice] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [personalityTraits, setPersonalityTraits] = useState<string[]>([]);
  const [primaryColors, setPrimaryColors] = useState<string[]>([]);
  const [secondaryColors, setSecondaryColors] = useState<string[]>([]);
  const [accentColors, setAccentColors] = useState<string[]>([]);
  const [typPrimary, setTypPrimary] = useState("");
  const [typSecondary, setTypSecondary] = useState("");

  // Audience Intelligence, multiple profiles
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  useBrandParamSync();
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [selectedAudienceId, setSelectedAudienceId] = useState<string | null>(null);
  const [audienceEditing, setAudienceEditing] = useState(false);
  const [editingLabel, setEditingLabel] = useState("");
  const [audienceInputs, setAudienceInputs] = useState({ ...EMPTY_INPUTS });

  // Trend Lab state
  const [trendLabOpen, setTrendLabOpen] = useState(false);

  const { data: audiences = [] } = useQuery({
    queryKey: ["target_audiences", brand?.id],
    queryFn: async () => {
      if (!brand) return [];
      const { data, error } = await supabase
        .from("target_audiences" as any)
        .select("*")
        .eq("brand_id", brand.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!brand,
  });

  // Trend Lab preferences query
  const { data: trendPrefs } = useQuery({
    queryKey: ["brand_trend_preferences", brand?.id],
    queryFn: async () => {
      if (!brand) return null;
      const { data, error } = await supabase
        .from("brand_trend_preferences" as any)
        .select("*")
        .eq("brand_id", brand.id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!brand,
  });

  const [trendEnabled, setTrendEnabled] = useState(false);
  const [selectedTrend, setSelectedTrend] = useState("none");
  const [trendIntensity, setTrendIntensity] = useState(40);

  // Research Lab state, per-category Firecrawl tuning
  const [researchLabOpen, setResearchLabOpen] = useState(false);
  type ResearchPref = { mode?: "fast" | "accurate"; recency?: "24h" | "7d" | "30d"; enabled?: boolean };
  const [researchPrefs, setResearchPrefs] = useState<Record<string, ResearchPref>>({});

  useEffect(() => {
    if (trendPrefs) {
      setTrendEnabled(trendPrefs.trend_enabled ?? false);
      setSelectedTrend(trendPrefs.selected_trend ?? "none");
      setTrendIntensity(trendPrefs.default_trend_intensity ?? 40);
      setResearchPrefs(
        trendPrefs.research_prefs && typeof trendPrefs.research_prefs === "object"
          ? trendPrefs.research_prefs as Record<string, ResearchPref>
          : {},
      );
    }
  }, [trendPrefs]);

  const saveTrendPrefs = useMutation({
    mutationFn: async (updates: { trend_enabled?: boolean; selected_trend?: string; default_trend_intensity?: number; research_prefs?: Record<string, ResearchPref> }) => {
      const payload = { brand_id: brand!.id, ...updates };
      if (trendPrefs?.id) {
        const { error } = await supabase.from("brand_trend_preferences" as any).update(payload as any).eq("id", trendPrefs.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("brand_trend_preferences" as any).insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand_trend_preferences", brand?.id] });
    },
    onError: (err: any) => toast({ title: "Error saving preferences", description: err.message, variant: "destructive" }),
  });

  const updateResearchPref = (categoryId: string, patch: Partial<ResearchPref>) => {
    const next = { ...researchPrefs, [categoryId]: { ...(researchPrefs[categoryId] || {}), ...patch } };
    setResearchPrefs(next);
    saveTrendPrefs.mutate({ research_prefs: next });
  };

  const selectedAudience = audiences.find((a: any) => a.id === selectedAudienceId) || audiences[0] || null;

  useEffect(() => {
    if (audiences.length > 0 && !selectedAudienceId) {
      setSelectedAudienceId(audiences[0].id);
    }
  }, [audiences, selectedAudienceId]);

  // Auto-open and scroll to Audience Intelligence when linked from Content Hub
  const startAudience = searchParams.get("startAudience") === "1";
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (searchParams.get("section") === "audience") {
      setAudienceOpen(true);
      setTimeout(() => {
        document.getElementById("audience-intelligence")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [searchParams]);

  // One-click: jump straight into creating a new audience profile
  useEffect(() => {
    if (!startAudience || autoStartedRef.current || !brand?.id) return;
    if (audiences.length === 0) {
      autoStartedRef.current = true;
      addAudienceMutation.mutate();
    } else {
      autoStartedRef.current = true;
      setSelectedAudienceId(audiences[0].id);
      setAudienceEditing(true);
    }
  }, [startAudience, brand?.id, audiences]);

  useEffect(() => {
    if (selectedAudience?.raw_inputs && typeof selectedAudience.raw_inputs === "object") {
      const ri = selectedAudience.raw_inputs as any;
      setAudienceInputs({
        who_buys: ri.who_buys || "", life_stage: ri.life_stage || "", improving: ri.improving || "",
        frustrations: ri.frustrations || "", not_working: ri.not_working || "", tried_before: ri.tried_before || "",
        success_looks_like: ri.success_looks_like || "", consequences: ri.consequences || "",
        when_buy: ri.when_buy || "", hesitations: ri.hesitations || "",
        emotional_drivers: ri.emotional_drivers || [],
      });
      setEditingLabel(selectedAudience.label || "");
    } else {
      setAudienceInputs({ ...EMPTY_INPUTS });
      setEditingLabel("");
    }
    setAudienceEditing(false);
  }, [selectedAudienceId, selectedAudience?.id]);

  const hasJtbdProfile = selectedAudience?.jtbd_profile && Object.keys(selectedAudience.jtbd_profile as any).length > 0;

  const addAudienceMutation = useMutation({
    mutationFn: async () => {
      const label = `Audience ${audiences.length + 1}`;
      const { data, error } = await supabase.from("target_audiences" as any).insert({ brand_id: brand!.id, label, raw_inputs: EMPTY_INPUTS } as any).select("id").single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["target_audiences", brand?.id] });
      setSelectedAudienceId(data.id);
      setAudienceEditing(true);
      toast({ title: "New audience added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteAudienceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("target_audiences" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelectedAudienceId(null);
      queryClient.invalidateQueries({ queryKey: ["target_audiences", brand?.id] });
      toast({ title: "Audience deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const generateProfileMutation = useMutation({
    mutationFn: async () => {
      const targetId = selectedAudience?.id;
      if (targetId) {
        await supabase.from("target_audiences" as any).update({ raw_inputs: audienceInputs, label: editingLabel || selectedAudience.label } as any).eq("id", targetId);
      } else {
        const { data: inserted, error } = await supabase.from("target_audiences" as any).insert({ brand_id: brand!.id, raw_inputs: audienceInputs, label: editingLabel || "Primary Audience" } as any).select("id").single();
        if (error) throw error;
        setSelectedAudienceId((inserted as any).id);
      }
      const { data, error } = await supabase.functions.invoke("audience-intelligence", {
        body: { raw_inputs: audienceInputs, brand: { name: brand!.name, description: brand!.description, tagline: brand!.tagline } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      // Save profile to the correct audience
      const id = targetId || selectedAudienceId;
      if (id) {
        await supabase.from("target_audiences" as any).update({ jtbd_profile: data.profile } as any).eq("id", id);
      }
      return data.profile;
    },
    onSuccess: () => {
      toast({ title: "Audience profile generated" });
      queryClient.invalidateQueries({ queryKey: ["target_audiences", brand?.id] });
      setAudienceEditing(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleEmotionalDriver = (driver: string) => {
    setAudienceInputs((prev) => ({
      ...prev,
      emotional_drivers: prev.emotional_drivers.includes(driver)
        ? prev.emotional_drivers.filter((d) => d !== driver)
        : [...prev.emotional_drivers, driver],
    }));
  };

  // Inspiration
  const { data: inspiration, refetch: refetchInspiration } = useQuery({
    queryKey: ["brand_inspiration", brand?.id],
    queryFn: async () => {
      if (!brand) return [] as GalleryItem[];
      const { data, error } = await supabase
        .from("brand_inspiration")
        .select("*")
        .eq("brand_id", brand.id)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as GalleryItem[];
    },
    enabled: !!brand,
  });
  const [galleryOrder, setGalleryOrder] = useState<GalleryItem[] | null>(null);
  const gallery = galleryOrder ?? (inspiration ?? []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleGalleryDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const current = galleryOrder ?? (inspiration ?? []);
    const oldIdx = current.findIndex((i) => i.id === active.id);
    const newIdx = current.findIndex((i) => i.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const next = arrayMove(current, oldIdx, newIdx);
    setGalleryOrder(next);
    // Persist positions
    try {
      await Promise.all(
        next.map((item, i) =>
          supabase.from("brand_inspiration").update({ position: i }).eq("id", item.id)
        )
      );
      refetchInspiration();
    } catch (err) {
      console.error("Failed to reorder gallery", err);
      toast({ title: "Couldn't save order", variant: "destructive" });
      setGalleryOrder(null);
    }
  };

  // Product Images
  const { data: productImages, refetch: refetchProducts } = useQuery({
    queryKey: ["brand_products", brand?.id],
    queryFn: async () => {
      if (!brand) return [];
      const { data, error } = await supabase.from("brand_products" as any).select("*").eq("brand_id", brand.id).order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!brand,
  });

  const deleteProduct = async (id: string) => {
    await supabase.from("brand_products" as any).delete().eq("id", id); refetchProducts();
  };

  const startEditProduct = (product: any) => {
    setEditingProductId(product.id);
    setAddingProduct(false);
    setProductForm({
      label: product.label || "",
      description: product.description || "",
      product_type: product.product_type || "physical",
      price: product.price || "",
      features: product.features || [],
      image_url: product.image_url || "",
      duration: product.duration || "",
      pricing_model: product.pricing_model || "",
      is_featured: product.is_featured || false,
      gallery_images: product.gallery_images || [],
    });
    setNewFeature("");
  };

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: "main" | "gallery" = "main") => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingProductImage(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("brand-products").upload(path, file);
    if (upErr) { toast({ title: "Upload failed", description: upErr.message, variant: "destructive" }); setUploadingProductImage(false); return; }
    const { data: urlData } = supabase.storage.from("brand-products").getPublicUrl(path);
    if (target === "gallery") {
      setProductForm(p => ({ ...p, gallery_images: [...p.gallery_images, urlData.publicUrl] }));
    } else {
      setProductForm(p => ({ ...p, image_url: urlData.publicUrl }));
      if (!productForm.label) {
        setProductForm(p => ({ ...p, label: file.name.replace(/\.[^.]+$/, "") }));
      }
    }
    setUploadingProductImage(false);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const galleryInputRef = useRef<HTMLInputElement>(null);

  const removeGalleryImage = (index: number) => {
    setProductForm(p => ({ ...p, gallery_images: p.gallery_images.filter((_, i) => i !== index) }));
  };

  const saveNewProduct = async () => {
    if (!brand || !productForm.image_url) { toast({ title: "Please upload an image first", variant: "destructive" }); return; }
    setSaving(true);
    await supabase.from("brand_products" as any).insert({
      brand_id: brand.id,
      image_url: productForm.image_url,
      label: productForm.label.trim() || "Untitled",
      description: productForm.description.trim(),
      product_type: productForm.product_type,
      price: productForm.price.trim(),
      features: productForm.features,
      duration: productForm.duration.trim(),
      pricing_model: productForm.pricing_model.trim(),
      is_featured: productForm.is_featured,
      gallery_images: productForm.gallery_images,
    } as any);
    setSaving(false);
    setAddingProduct(false);
    setProductForm({ label: "", description: "", product_type: "physical", price: "", features: [], image_url: "", duration: "", pricing_model: "", is_featured: false, gallery_images: [] });
    toast({ title: productForm.product_type === "service" ? "Service added" : "Product added" });
    refetchProducts();
  };

  const saveProduct = async () => {
    if (!editingProductId) return;
    setSaving(true);
    await supabase.from("brand_products" as any).update({
      label: productForm.label.trim(),
      description: productForm.description.trim(),
      product_type: productForm.product_type,
      price: productForm.price.trim(),
      features: productForm.features,
      duration: productForm.duration.trim(),
      pricing_model: productForm.pricing_model.trim(),
      is_featured: productForm.is_featured,
      gallery_images: productForm.gallery_images,
    } as any).eq("id", editingProductId);
    setSaving(false);
    setEditingProductId(null);
    toast({ title: "Updated" });
    refetchProducts();
  };

  const addFeature = () => {
    const f = newFeature.trim();
    if (f && productForm.features.length < 5 && !productForm.features.includes(f)) {
      setProductForm(prev => ({ ...prev, features: [...prev.features, f] }));
      setNewFeature("");
    }
  };

  const removeFeature = (idx: number) => {
    setProductForm(prev => ({ ...prev, features: prev.features.filter((_, i) => i !== idx) }));
  };

  useEffect(() => {
    if (brand && !editing) {
      setName(brand.name || ""); setTagline(brand.tagline || ""); setDescription(brand.description || "");
      setVibe(brand.vibe || ""); setToneOfVoice((brand as any).tone_of_voice || "");
      setSpecialInstructions((brand as any).special_instructions || "");
      setPersonalityTraits((brand as any).personality_traits || []);
      setPrimaryColors(brand.primary_colors || []); setSecondaryColors(brand.secondary_colors || []);
      setAccentColors(brand.accent_colors || []);
      setTypPrimary(brand.typography_primary || ""); setTypSecondary(brand.typography_secondary || "");
    }
  }, [brand, editing]);

  const saveField = async (field: EditingField) => {
    if (!brand) return;
    setSaving(true);
    let updates: Record<string, unknown> = {};
    if (field === "info") updates = { name: name.trim(), tagline: tagline.trim(), description: description.trim() };
    else if (field === "colors") updates = { primary_colors: primaryColors, secondary_colors: secondaryColors, accent_colors: accentColors };
    else if (field === "typography") updates = { typography_primary: typPrimary, typography_secondary: typSecondary };
    else if (field === "vibe") updates = { vibe };
    else if (field === "tone") updates = { tone_of_voice: toneOfVoice.trim() };
    else if (field === "personality") updates = { personality_traits: personalityTraits };
    else if (field === "special_instructions") updates = { special_instructions: specialInstructions.trim() || null };
    const { error } = await supabase.from("brands").update(updates as any).eq("id", brand.id);
    setSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Saved" }); setEditing(null); refetch(); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !brand || !user) return;
    setSaving(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("brand-logos").upload(path, file);
    if (upErr) { toast({ title: "Upload failed", description: upErr.message, variant: "destructive" }); setSaving(false); return; }
    const { data: urlData } = supabase.storage.from("brand-logos").getPublicUrl(path);
    await supabase.from("brands").update({ logo_url: urlData.publicUrl }).eq("id", brand.id);
    setSaving(false);
    toast({ title: "Logo updated" }); refetch();
  };

  const handleInspirationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !brand || !user) return;
    let nextPos = (inspiration?.length ?? 0);
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("brand-inspiration").upload(path, file);
      if (upErr) continue;
      const { data: urlData } = supabase.storage.from("brand-inspiration").getPublicUrl(path);
      await supabase.from("brand_inspiration").insert({ brand_id: brand.id, image_url: urlData.publicUrl, position: nextPos });
      nextPos += 1;
    }
    setGalleryOrder(null);
    toast({ title: "Added to gallery" }); refetchInspiration();
  };

  const deleteInspiration = async (id: string) => {
    await supabase.from("brand_inspiration").delete().eq("id", id);
    setGalleryOrder(null);
    refetchInspiration();
  };

  const handleColorChange = (setter: React.Dispatch<React.SetStateAction<string[]>>, arr: string[], index: number, value: string) => {
    const copy = [...arr]; copy[index] = value; setter(copy);
  };

  const addColor = (setter: React.Dispatch<React.SetStateAction<string[]>>, arr: string[]) => {
    if (arr.length < 5) setter([...arr, "#cccccc"]);
  };

  const togglePersonalityTrait = (trait: string) => {
    if (personalityTraits.includes(trait)) setPersonalityTraits(personalityTraits.filter((t) => t !== trait));
    else setPersonalityTraits([...personalityTraits, trait]);
  };

  const SCAN_MESSAGES = ["Scanning your website…", "Extracting brand colours…", "Analyzing your tone…", "Detecting typography…", "Almost there…"];

  const handleWebsiteImport = async () => {
    if (!websiteUrl.trim() || !brand) return;
    setWebsiteScanning(true);
    setWebsiteScanMessage(SCAN_MESSAGES[0]);
    let msgIndex = 0;
    const interval = setInterval(() => {
      msgIndex = (msgIndex + 1) % SCAN_MESSAGES.length;
      setWebsiteScanMessage(SCAN_MESSAGES[msgIndex]);
    }, 2500);

    try {
      const { data: result, error } = await supabase.functions.invoke("brand-scraper", {
        body: { url: websiteUrl.trim() },
      });
      clearInterval(interval);
      if (result?.error) throw new Error(result.error);
      if (error) throw new Error((error as any)?.context?.responseJson?.error || error.message || "Couldn't scan website");

      if (result.brand) {
        const b = result.brand;
        const fields: Record<string, boolean> = {};
        if (b.name) fields.name = true;
        if (b.tagline) fields.tagline = true;
        if (b.description) fields.description = true;
        if (b.logo_url) fields.logo = true;
        if (b.primary_colors?.length || b.secondary_colors?.length || b.accent_colors?.length) fields.colours = true;
        if (b.typography_primary || b.typography_secondary) fields.typography = true;
        if (b.vibe) fields.vibe = true;
        if (b.tone_of_voice) fields.tone_of_voice = true;
        if (b.personality_traits?.length) fields.personality = true;
        if (b.audience_raw_inputs) fields.audience = true;
        setSelectedFields(fields);
        setScannedBrand(b);
        setConfirmDialogOpen(true);
      }
    } catch (err: any) {
      clearInterval(interval);
      toast({ title: "Couldn't scan website", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setWebsiteScanning(false);
      setWebsiteScanMessage("");
    }
  };

  const applyWebsiteImport = async () => {
    if (!scannedBrand || !brand) return;
    setApplyingImport(true);
    try {
      const b = scannedBrand;
      const updates: Record<string, unknown> = { website_url: websiteUrl.trim() };
      if (selectedFields.name && b.name) updates.name = b.name;
      if (selectedFields.tagline && b.tagline) updates.tagline = b.tagline;
      if (selectedFields.description && b.description) updates.description = b.description;
      if (selectedFields.logo && b.logo_url) updates.logo_url = b.logo_url;
      if (selectedFields.colours && b.primary_colors?.length) updates.primary_colors = b.primary_colors;
      if (selectedFields.colours && b.secondary_colors?.length) updates.secondary_colors = b.secondary_colors;
      if (selectedFields.colours && b.accent_colors?.length) updates.accent_colors = b.accent_colors;
      if (selectedFields.typography && b.typography_primary) updates.typography_primary = b.typography_primary;
      if (selectedFields.typography && b.typography_secondary) updates.typography_secondary = b.typography_secondary;
      if (selectedFields.vibe && b.vibe) updates.vibe = b.vibe;
      if (selectedFields.tone_of_voice && b.tone_of_voice) updates.tone_of_voice = b.tone_of_voice;
      if (selectedFields.personality && b.personality_traits?.length) updates.personality_traits = b.personality_traits;

      await supabase.from("brands").update(updates as any).eq("id", brand.id);

      if (selectedFields.audience && b.audience_raw_inputs) {
        const existingAudiences = audiences || [];
        if (existingAudiences.length === 0) {
          await supabase.from("target_audiences" as any).insert({
            brand_id: brand.id,
            label: "Website Audience",
            raw_inputs: b.audience_raw_inputs,
          } as any);
          queryClient.invalidateQueries({ queryKey: ["target_audiences", brand.id] });
        }
      }

      toast({ title: "Brand updated from website!", description: "Your brand details have been refreshed." });
      refetch();
      setConfirmDialogOpen(false);
      setScannedBrand(null);
      setWebsiteImportOpen(false);
      setWebsiteUrl("");
    } catch (err: any) {
      toast({ title: "Error applying changes", description: err.message, variant: "destructive" });
    } finally {
      setApplyingImport(false);
    }
  };

  useScrollRestoration(`brand-editor:${brand?.id || "none"}`, !!brand);

  // Remember open panels / edit focus per brand and restore on return.
  useEditorStateMemory(
    brand?.id,
    {
      editing,
      audienceOpen,
      selectedAudienceId,
      audienceEditing,
      trendLabOpen,
      researchLabOpen,
      editingProductId,
    },
    (saved) => {
      if (saved.editing !== undefined) setEditing(saved.editing as EditingField);
      if (saved.audienceOpen !== undefined) setAudienceOpen(!!saved.audienceOpen);
      if (saved.selectedAudienceId) setSelectedAudienceId(saved.selectedAudienceId);
      if (saved.audienceEditing !== undefined) setAudienceEditing(!!saved.audienceEditing);
      if (saved.trendLabOpen !== undefined) setTrendLabOpen(!!saved.trendLabOpen);
      if (saved.researchLabOpen !== undefined) setResearchLabOpen(!!saved.researchLabOpen);
      if (saved.editingProductId !== undefined) setEditingProductId(saved.editingProductId);
    },
  );

  if (!brand) return null;


  const isService = productForm.product_type === "service";

  const renderProductFormFields = () => (
    <>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Type</label>
        <div className="flex gap-1">
          {(["physical", "digital", "service"] as const).map(t => (
            <button key={t} onClick={() => setProductForm(p => ({ ...p, product_type: t }))} className={`flex-1 px-2 py-1.5 text-xs rounded-lg border transition-all ${productForm.product_type === t ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:border-muted-foreground/40"}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Name</label>
        <Input value={productForm.label} onChange={(e) => setProductForm(p => ({ ...p, label: e.target.value }))} placeholder={isService ? "Service name" : "Product name"} className="h-8 text-sm" />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Description</label>
        <Textarea value={productForm.description} onChange={(e) => setProductForm(p => ({ ...p, description: e.target.value }))} placeholder={isService ? "Describe the service and who it's for..." : "What does this product do? Key selling points..."} className="min-h-[60px] text-sm" maxLength={500} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Price</label>
          <Input value={productForm.price} onChange={(e) => setProductForm(p => ({ ...p, price: e.target.value }))} placeholder={isService ? "e.g. $300, From ₦50,000" : "e.g. $29, ₦5,000"} className="h-8 text-sm" />
        </div>
        {isService && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Duration</label>
            <Input value={productForm.duration} onChange={(e) => setProductForm(p => ({ ...p, duration: e.target.value }))} placeholder="e.g. 1 hour, 4 weeks" className="h-8 text-sm" />
          </div>
        )}
      </div>
      {isService && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Pricing Model</label>
          <div className="flex flex-wrap gap-1">
            {["fixed", "per hour", "per session", "packages from"].map(m => (
              <button key={m} onClick={() => setProductForm(p => ({ ...p, pricing_model: m }))} className={`px-2 py-1 text-[10px] rounded-lg border transition-all ${productForm.pricing_model === m ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:border-muted-foreground/40"}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">{isService ? "What's Included / Deliverables (up to 5)" : "Features (up to 5)"}</label>
        <div className="flex flex-wrap gap-1 mb-1">
          {productForm.features.map((f, i) => (
            <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground flex items-center gap-1">
              {f}
              <button onClick={() => removeFeature(i)} className="text-muted-foreground hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
            </span>
          ))}
        </div>
        {productForm.features.length < 5 && (
          <div className="flex gap-1">
            <Input value={newFeature} onChange={(e) => setNewFeature(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())} placeholder={isService ? "Add a deliverable" : "Add a feature"} className="h-8 text-sm" />
            <Button variant="outline" size="sm" onClick={addFeature} className="h-8 px-2"><Plus className="h-3 w-3" /></Button>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border p-2.5">
        <div className="flex items-center gap-2">
          <Star className={`h-3.5 w-3.5 ${productForm.is_featured ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`} />
          <span className="text-xs font-medium text-muted-foreground">Featured, AI will prioritise this in content</span>
        </div>
        <Switch checked={productForm.is_featured} onCheckedChange={(v) => setProductForm(p => ({ ...p, is_featured: v }))} className="scale-75" />
      </div>
      {/* Gallery images (additional angles/screenshots) */}
      {productForm.image_url && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Additional Images ({productForm.gallery_images.length}/5)</label>
          <div className="flex gap-2 flex-wrap">
            {productForm.gallery_images.map((url, i) => (
              <div key={i} className="relative group">
                <img src={url} alt="" className="w-14 h-14 object-cover rounded-lg border border-border" />
                <button onClick={() => removeGalleryImage(i)} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
            {productForm.gallery_images.length < 5 && (
              <button
                onClick={() => galleryInputRef.current?.click()}
                disabled={uploadingProductImage}
                className="w-14 h-14 rounded-lg border-2 border-dashed border-border hover:border-muted-foreground/40 flex flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors"
              >
                {uploadingProductImage ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                <span className="text-[8px]">Add</span>
              </button>
            )}
          </div>
          <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleProductImageUpload(e, "gallery")} />
        </div>
      )}
    </>
  );

  const renderSection = (title: string, field: EditingField, children: React.ReactNode, editContent: React.ReactNode) => (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{title}</h3>
        {editing === field ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
            <Button size="sm" onClick={() => saveField(field)} disabled={saving} className="gap-1"><Check className="h-3 w-3" /> Save</Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setEditing(field)} className="gap-1 text-muted-foreground"><Pencil className="h-3 w-3" /> Edit</Button>
        )}
      </div>
      {editing === field ? editContent : children}
    </div>
  );

  // Audience questionnaire form (rendered as a JSX element, NOT a nested
  // component, defining a component inside another component creates a new
  // function reference on every render, which forces React to unmount/remount
  // the inputs and steals focus on every keystroke.
  const audienceFormEl = (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">Audience Label</label>
        <Input value={editingLabel} onChange={(e) => setEditingLabel(e.target.value)} placeholder="e.g. Busy Executives, Beginners..." maxLength={100} />
      </div>
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Who Are They?</h4>
        <div className="space-y-2">
          <Textarea placeholder="Who typically buys from you?" value={audienceInputs.who_buys} onChange={(e) => setAudienceInputs((p) => ({ ...p, who_buys: e.target.value }))} className="min-h-[60px]" />
          <Textarea placeholder="What stage of life or business are they in?" value={audienceInputs.life_stage} onChange={(e) => setAudienceInputs((p) => ({ ...p, life_stage: e.target.value }))} className="min-h-[60px]" />
          <Textarea placeholder="What are they trying to improve?" value={audienceInputs.improving} onChange={(e) => setAudienceInputs((p) => ({ ...p, improving: e.target.value }))} className="min-h-[60px]" />
        </div>
      </div>
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Their Struggle</h4>
        <div className="space-y-2">
          <Textarea placeholder="What frustrates them right now?" value={audienceInputs.frustrations} onChange={(e) => setAudienceInputs((p) => ({ ...p, frustrations: e.target.value }))} className="min-h-[60px]" />
          <Textarea placeholder="What is not working for them?" value={audienceInputs.not_working} onChange={(e) => setAudienceInputs((p) => ({ ...p, not_working: e.target.value }))} className="min-h-[60px]" />
          <Textarea placeholder="What have they tried before?" value={audienceInputs.tried_before} onChange={(e) => setAudienceInputs((p) => ({ ...p, tried_before: e.target.value }))} className="min-h-[60px]" />
        </div>
      </div>
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Motivation</h4>
        <div className="space-y-2">
          <Textarea placeholder="What would success look like for them?" value={audienceInputs.success_looks_like} onChange={(e) => setAudienceInputs((p) => ({ ...p, success_looks_like: e.target.value }))} className="min-h-[60px]" />
          <Textarea placeholder="What happens if they don't solve this?" value={audienceInputs.consequences} onChange={(e) => setAudienceInputs((p) => ({ ...p, consequences: e.target.value }))} className="min-h-[60px]" />
        </div>
      </div>
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Buying Context</h4>
        <div className="space-y-2">
          <Textarea placeholder="When do they usually decide to buy?" value={audienceInputs.when_buy} onChange={(e) => setAudienceInputs((p) => ({ ...p, when_buy: e.target.value }))} className="min-h-[60px]" />
          <Textarea placeholder="What makes them hesitate? What almost stops them?" value={audienceInputs.hesitations} onChange={(e) => setAudienceInputs((p) => ({ ...p, hesitations: e.target.value }))} className="min-h-[60px]" />
        </div>
      </div>
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Emotional Drivers</h4>
        <div className="flex flex-wrap gap-2">
          {EMOTIONAL_DRIVERS.map((driver) => (
            <button key={driver} onClick={() => toggleEmotionalDriver(driver)} className={`px-4 py-2.5 rounded-xl text-sm border transition-all ${audienceInputs.emotional_drivers.includes(driver) ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-muted-foreground/40"}`}>{driver}</button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => generateProfileMutation.mutate()} disabled={generateProfileMutation.isPending} className="gap-2">
          {generateProfileMutation.isPending ? (<><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>) : hasJtbdProfile ? (<><RefreshCw className="h-4 w-4" /> Regenerate Profile</>) : (<><Target className="h-4 w-4" /> Generate Profile</>)}
        </Button>
        {hasJtbdProfile && audienceEditing && <Button variant="ghost" onClick={() => setAudienceEditing(false)}>Cancel</Button>}
      </div>
    </div>
  );

  // Audience profile display
  const AudienceProfileDisplay = ({ profile }: { profile: any }) => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">{selectedAudience?.label || "Audience"}</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setAudienceEditing(true)} className="gap-1 text-muted-foreground"><Pencil className="h-3 w-3" /> Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => deleteAudienceMutation.mutate(selectedAudience.id)} className="gap-1 text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /> Delete</Button>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">Persona</label>
        <p className="text-sm">{profile.persona_summary}</p>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">Core Job Statement</label>
        <p className="text-sm italic">{profile.core_job_statement}</p>
      </div>
      {([["Struggling Moments", "struggling_moments"], ["Push Forces", "push_forces"], ["Pull Forces", "pull_forces"], ["Anxiety Forces", "anxiety_forces"], ["Buying Triggers", "buying_triggers"], ["Hesitation Factors", "hesitation_factors"], ["Messaging Angles", "messaging_angles"], ["Conversion Levers", "conversion_levers_ranked"]] as const).map(([label, key]) => {
        const items = profile[key];
        if (!items?.length) return null;
        return (
          <div key={key} className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</label>
            <ul className="text-sm space-y-0.5">
              {items.map((item: string, i: number) => (<li key={i} className="flex gap-1.5"><span className="text-muted-foreground">•</span><span>{item}</span></li>))}
            </ul>
          </div>
        );
      })}
      {([["Emotional Outcomes", "emotional_outcomes"], ["Functional Outcomes", "functional_outcomes"], ["Social Outcomes", "social_outcomes"], ["Language Patterns", "language_patterns"]] as const).map(([label, key]) => {
        const items = profile[key];
        if (!items?.length) return null;
        return (
          <div key={key} className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</label>
            <div className="flex flex-wrap gap-1.5">
              {items.map((item: string, i: number) => (<span key={i} className="inline-block px-2.5 py-1 rounded-lg bg-secondary text-xs">{item}</span>))}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-dvh bg-background lg:pl-20 pb-24">
      <SEO title="Brand Centre, Brandie" description="Manage your brand identity, products, audience, and visual style genome." path="/brand" noindex />
      <NewAppHeader />

      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">

          {/* Website Import */}
          {websiteImportOpen ? (
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Import from website</h3>
                <Button variant="ghost" size="sm" onClick={() => { setWebsiteImportOpen(false); setWebsiteUrl(""); }} disabled={websiteScanning}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">Enter your website URL and we'll update your brand details automatically.</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="yourwebsite.com"
                    className="pl-9"
                    disabled={websiteScanning}
                    onKeyDown={(e) => e.key === "Enter" && !websiteScanning && websiteUrl.trim() && handleWebsiteImport()}
                  />
                </div>
                <Button onClick={handleWebsiteImport} disabled={websiteScanning || !websiteUrl.trim()} className="gap-2 shrink-0">
                  {websiteScanning ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> {websiteScanMessage}</>
                  ) : (
                    <><Sparkles className="h-4 w-4" /> Scan</>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" className="gap-1.5 pl-0" aria-label="Back to Brand Centre" onClick={() => navigate(brandHref("/brand", brand?.id))}>
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/brands")}>
                  <Palette className="h-3.5 w-3.5" /> Manage brands
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setWebsiteImportOpen(true)}>
                  <Globe className="h-3.5 w-3.5" /> Import from website
                </Button>
              </div>
            </div>
          )}


          <EditorGroup title="Identity" hint="How your brand looks and sounds in every generated asset.">
          {/* Brand Info */}
          {renderSection("Brand Info", "info",

            <div className="space-y-2">
              <h2 className="text-2xl font-serif">{brand.name}</h2>
              {brand.tagline && <p className="text-muted-foreground">{brand.tagline}</p>}
              {brand.description && <p className="text-sm text-muted-foreground leading-relaxed">{brand.description}</p>}
            </div>,
            <div className="space-y-4">
              <div className="space-y-1"><label className="text-sm font-medium">Name</label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} /></div>
              <div className="space-y-1"><label className="text-sm font-medium">Tagline</label><Input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={200} /></div>
              <div className="space-y-1"><label className="text-sm font-medium">Description</label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} /></div>
            </div>
          )}

          {/* Logo */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Logo</h3>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => setLogoDesignerOpen(true)}>
                  <Sparkles className="h-3 w-3" /> Create with AI
                </Button>
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => logoInputRef.current?.click()}>
                  <Upload className="h-3 w-3" /> {brand.logo_url ? "Replace" : "Upload"}
                </Button>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>
            </div>
            {brand.logo_url ? (
              <img src={brand.logo_url} alt="Brand logo" className="h-20 object-contain" />
            ) : (
              <div className="h-20 w-20 rounded-xl bg-secondary flex items-center justify-center"><span className="text-xs text-muted-foreground">No logo</span></div>
            )}
          </div>
          <LogoDesignerDialog
            open={logoDesignerOpen}
            onOpenChange={setLogoDesignerOpen}
            brandId={brand.id}
            brandName={brand.name}
            onLogoCreated={() => refetch()}
          />

          {/* Tone of Voice */}
          {renderSection("Tone of Voice", "tone",
            <p className="text-sm text-muted-foreground leading-relaxed">{(brand as any).tone_of_voice || "Not set"}</p>,
            <Textarea value={toneOfVoice} onChange={(e) => setToneOfVoice(e.target.value)} placeholder="e.g. Friendly and warm, with a touch of humour..." maxLength={500} />
          )}

          {/* Personality Traits */}
          {renderSection("Personality Traits", "personality",
            <div className="flex flex-wrap gap-2">
              {((brand as any).personality_traits || []).length > 0 ? (
                ((brand as any).personality_traits as string[]).map((trait) => (
                  <span key={trait} className="inline-block px-3 py-1.5 rounded-xl bg-secondary text-sm font-medium">{trait}</span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">Not set</span>
              )}
            </div>,
            <div className="flex flex-wrap gap-2">
              {PERSONALITY_OPTIONS.map((trait) => (
                <button key={trait} onClick={() => togglePersonalityTrait(trait)} className={`px-4 py-2.5 rounded-xl text-sm border transition-all ${personalityTraits.includes(trait) ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-muted-foreground/40"}`}>{trait}</button>
              ))}
            </div>
          )}

          {/* Vibe */}
          {renderSection("Brand Vibe", "vibe",
            <span className="inline-block px-4 py-2 rounded-xl bg-secondary text-sm font-medium">{brand.vibe || "Not set"}</span>,
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {VIBES.map((v) => (
                <button key={v} onClick={() => setVibe(v)} className={`px-4 py-3 rounded-xl border text-sm transition-all ${vibe === v ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-muted-foreground/40"}`}>{v}</button>
              ))}
            </div>
          )}

          {/* Colours */}
          {renderSection("Colours", "colors",
            <div className="space-y-3">
              {([["Primary", brand.primary_colors], ["Secondary", brand.secondary_colors], ["Accent", brand.accent_colors]] as const).map(([label, colors]) => (
                <div key={label} className="space-y-1">
                  <label className="text-xs text-muted-foreground">{label}</label>
                  <div className="flex gap-2">
                    {(colors || []).map((c, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <div className="w-8 h-8 rounded-lg border border-border" style={{ backgroundColor: c }} />
                        <span className="text-xs font-mono text-muted-foreground">{c}</span>
                      </div>
                    ))}
                    {(!colors || colors.length === 0) && <span className="text-xs text-muted-foreground">Not set</span>}
                  </div>
                </div>
              ))}
            </div>,
            <div className="space-y-5">
              {([["Primary", primaryColors, setPrimaryColors], ["Secondary", secondaryColors, setSecondaryColors], ["Accent", accentColors, setAccentColors]] as const).map(([label, arr, setter]) => (
                <div key={label} className="space-y-2">
                  <label className="text-sm font-medium">{label}</label>
                  <div className="flex items-center gap-3 flex-wrap">
                    {arr.map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="color" value={c} onChange={(e) => handleColorChange(setter as any, arr as any, i, e.target.value)} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                        <span className="text-xs text-muted-foreground font-mono">{c}</span>
                      </div>
                    ))}
                    {arr.length < 5 && (
                      <button onClick={() => addColor(setter as any, arr as any)} className="w-10 h-10 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-muted-foreground/40 transition-colors">+</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Typography */}
          {renderSection("Typography", "typography",
            <div className="flex gap-6">
              <div><label className="text-xs text-muted-foreground">Body</label><p className="text-sm font-medium">{brand.typography_primary || "Not set"}</p></div>
              <div><label className="text-xs text-muted-foreground">Headings</label><p className="text-sm font-medium">{brand.typography_secondary || "Not set"}</p></div>
            </div>,
            <div className="space-y-5">
              {([["Body font", typPrimary, setTypPrimary], ["Heading font", typSecondary, setTypSecondary]] as const).map(([label, val, setter]) => (
                <div key={label} className="space-y-2">
                  <label className="text-sm font-medium">{label}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {FONT_OPTIONS.map((font) => (
                      <button key={font} onClick={() => (setter as any)(font)} className={`px-4 py-3 rounded-xl text-sm text-left border transition-all ${val === font ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-muted-foreground/40"}`}>{font}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          </EditorGroup>

          <EditorGroup title="Offer & Assets" hint="What you sell and the real imagery Brandie features in your designs.">
          {/* Products & Services */}

          <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Products & Services</h3>
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => { setAddingProduct(true); setEditingProductId(null); setProductForm({ label: "", description: "", product_type: "physical", price: "", features: [] as string[], image_url: "", duration: "", pricing_model: "", is_featured: false, gallery_images: [] }); setNewFeature(""); }}>
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Add your products and services. The AI uses this to write accurate copy, pricing, and context-specific content.</p>

            {/* Add new product form */}
            {addingProduct && (
              <div className="rounded-xl border border-primary/30 bg-muted/30 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">New Product / Service</p>
                  <button onClick={() => setAddingProduct(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                </div>
                {/* Main image upload */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Main Image</label>
                  {productForm.image_url ? (
                    <div className="relative group w-fit">
                      <img src={productForm.image_url} alt="" className="w-16 h-16 object-cover rounded-lg border-2 border-primary" />
                      <button onClick={() => productInputRef.current?.click()} className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Pencil className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => productInputRef.current?.click()}
                      disabled={uploadingProductImage}
                      className="w-full h-20 rounded-lg border-2 border-dashed border-border hover:border-muted-foreground/40 flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
                    >
                      {uploadingProductImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      <span className="text-xs">{uploadingProductImage ? "Uploading..." : "Upload image"}</span>
                    </button>
                  )}
                  <input ref={productInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleProductImageUpload(e, "main")} />
                </div>
                {renderProductFormFields()}
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setAddingProduct(false)}>Cancel</Button>
                  <Button size="sm" onClick={saveNewProduct} disabled={saving || !productForm.image_url} className="gap-1"><Check className="h-3 w-3" /> {productForm.product_type === "service" ? "Add Service" : "Add Product"}</Button>
                </div>
              </div>
            )}

            {productImages && productImages.length > 0 ? (
              <div className="space-y-3">
                {productImages.map((item: any) => {
                  const isEditing = editingProductId === item.id;
                  return (
                    <div key={item.id} className="rounded-xl border border-border overflow-hidden">
                      <div className="flex gap-3 p-3">
                        <div className="flex-shrink-0">
                          <img src={item.image_url} alt={item.label || "Product"} className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg border border-border" />
                          {item.gallery_images?.length > 0 && (
                            <p className="text-[9px] text-muted-foreground text-center mt-0.5">+{item.gallery_images.length} more</p>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{item.label || "Untitled"}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${item.product_type === "digital" ? "bg-blue-500/10 text-blue-500" : item.product_type === "service" ? "bg-purple-500/10 text-purple-500" : "bg-emerald-500/10 text-emerald-500"}`}>
                                  {item.product_type || "physical"}
                                </span>
                                {item.is_featured && <Star className="h-3 w-3 fill-amber-500 text-amber-500" />}
                                {item.price && <span className="text-xs text-muted-foreground font-medium">{item.price}</span>}
                              </div>
                              {item.product_type === "service" && item.duration && <span className="text-[10px] text-muted-foreground ml-1">• {item.duration}</span>}
                              {item.product_type === "service" && item.pricing_model && <span className="text-[10px] text-muted-foreground ml-1">• {item.pricing_model}</span>}
                              {item.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>}
                              {item.features?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {item.features.map((f: string, i: number) => (
                                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground">{f}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => isEditing ? setEditingProductId(null) : startEditProduct(item)} className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                                {isEditing ? <X className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                              </button>
                              <button onClick={() => deleteProduct(item.id)} className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      {isEditing && (
                        <div className="border-t border-border p-3 space-y-3 bg-muted/30">
                          {renderProductFormFields()}
                          <div className="flex justify-end">
                            <Button size="sm" onClick={saveProduct} disabled={saving} className="gap-1"><Check className="h-3 w-3" /> Save</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : !addingProduct ? (
              <p className="text-sm text-muted-foreground">No products or services yet. Add your first to give the AI richer context.</p>
            ) : null}
          </div>

          {/* Updates, real-time business activity feed */}
          {brand?.id && user?.id && <BrandUpdates brandId={brand.id} userId={user.id} />}

          {/* Gallery */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Gallery</h3>
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => inspirationInputRef.current?.click()}>
                <Upload className="h-3 w-3" /> Add to gallery
              </Button>
              <input ref={inspirationInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleInspirationUpload} />
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              Real brand photos Brandie will feature in your designs — products, screenshots, team, premises, packaging, etc. Brandie uses these exact images instead of generating stand-ins. <span className="text-foreground/80">Drag to reorder — top images are prioritised first.</span>
            </p>
            {gallery.length > 0 ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGalleryDragEnd}>
                <SortableContext items={gallery.map((g) => g.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {gallery.map((item) => (
                      <SortableGalleryTile key={item.id} item={item} onDelete={deleteInspiration} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <p className="text-sm text-muted-foreground">No gallery images yet. Upload real brand photos so your designs look like your business.</p>
            )}
          </div>
          </EditorGroup>

          <EditorGroup title="Audience & Rules" hint="Who you are talking to, and the rules Brandie must always follow.">
          {/* Special Instructions */}
          {renderSection("Special Instructions", "special_instructions",

            (brand as any).special_instructions ? (
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{(brand as any).special_instructions}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No special instructions set. Add persistent rules that the AI will always follow.</p>
            ),
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">These are persistent, high-priority rules the AI will always follow when generating designs. Use them for things like language preferences, content restrictions, or mandatory elements.</p>
              <Textarea value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} placeholder='e.g. "Always include our website URL: www.example.com", "Use Yoruba language for headlines", "Never use stock photos of people"' maxLength={2000} className="min-h-[120px]" />
            </div>
          )}

          {/* Target Audience Intelligence */}
          <div id="audience-intelligence" className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4 scroll-mt-20">
            <button onClick={() => setAudienceOpen(!audienceOpen)} className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Target Audience Intelligence</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${audiences.length > 0 ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                  {audiences.length > 0 ? `${audiences.length} profile${audiences.length > 1 ? "s" : ""}` : "Not configured"}
                </span>
                {audienceOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>

            {/* Collapsed summary */}
            {!audienceOpen && selectedAudience && hasJtbdProfile && (
              <div className="space-y-1 pt-1">
                <p className="text-xs text-muted-foreground">{selectedAudience.label}</p>
                <p className="text-sm font-medium">{(selectedAudience.jtbd_profile as any).persona_summary}</p>
                <p className="text-xs text-muted-foreground italic">{(selectedAudience.jtbd_profile as any).core_job_statement}</p>
              </div>
            )}

            {audienceOpen && (
              <div className="space-y-4 pt-2">
                {/* Audience tabs + Add button */}
                {audiences.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {audiences.map((a: any) => (
                      <button
                        key={a.id}
                        onClick={() => setSelectedAudienceId(a.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm border transition-all ${
                          selectedAudienceId === a.id ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-muted-foreground/40"
                        }`}
                      >
                        <Users className="h-3 w-3" />
                        {a.label}
                      </button>
                    ))}
                    <button
                      onClick={() => addAudienceMutation.mutate()}
                      disabled={addAudienceMutation.isPending}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm border-2 border-dashed border-border text-muted-foreground hover:border-muted-foreground/40 transition-all"
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  </div>
                )}

                {/* No audiences yet */}
                {audiences.length === 0 && !audienceEditing && (
                  <div className="text-center py-4 space-y-3">
                    <p className="text-sm text-muted-foreground">No audience profiles yet. Add one to make your designs conversion-aware.</p>
                    <Button variant="outline" onClick={() => { addAudienceMutation.mutate(); }} className="gap-2">
                      <Plus className="h-4 w-4" /> Add First Audience
                    </Button>
                  </div>
                )}

                {/* Selected audience content */}
                {selectedAudience && (
                  <>
                    {(audienceEditing || !hasJtbdProfile) ? (
                      audienceFormEl
                    ) : (
                      <AudienceProfileDisplay profile={selectedAudience.jtbd_profile} />
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          </EditorGroup>

          <EditorGroup title="Intelligence" hint="Trend styling and research tuning that shape what Brandie creates each week.">
          {/* Trend Lab */}

          <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4">
            <button onClick={() => setTrendLabOpen(!trendLabOpen)} className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Trend Lab</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${trendEnabled && selectedTrend !== "none" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                  {trendEnabled && selectedTrend !== "none" ? getTrendById(selectedTrend)?.name || selectedTrend : "Off"}
                </span>
                {trendLabOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>

            {!trendLabOpen && trendEnabled && selectedTrend !== "none" && (
              <div className="space-y-1 pt-1">
                <p className="text-sm font-medium">{getTrendById(selectedTrend)?.name}</p>
                <p className="text-xs text-muted-foreground">Intensity: {trendIntensity}%</p>
              </div>
            )}

            {trendLabOpen && (
              <div className="space-y-5 pt-2">
                <p className="text-sm text-muted-foreground">Blend modern design trends into your brand visuals.</p>

                {/* Enable toggle */}
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Enable Trend Styling</label>
                  <Switch
                    checked={trendEnabled}
                    onCheckedChange={(val) => {
                      setTrendEnabled(val);
                      saveTrendPrefs.mutate({ trend_enabled: val, selected_trend: selectedTrend, default_trend_intensity: trendIntensity });
                    }}
                  />
                </div>

                {/* Trend preset cards */}
                {trendEnabled && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {TREND_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => {
                            setSelectedTrend(preset.id);
                            saveTrendPrefs.mutate({ trend_enabled: true, selected_trend: preset.id, default_trend_intensity: trendIntensity });
                          }}
                          className={`text-left p-4 rounded-xl border transition-all space-y-1.5 ${
                            selectedTrend === preset.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-muted-foreground/40"
                          }`}
                        >
                          <p className="text-sm font-medium">{preset.name}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{preset.description}</p>
                        </button>
                      ))}
                    </div>

                    {/* Intensity slider */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Trend Intensity</label>
                        <span className="text-sm text-muted-foreground font-mono">{trendIntensity}%</span>
                      </div>
                      <Slider
                        value={[trendIntensity]}
                        onValueChange={([val]) => setTrendIntensity(val)}
                        onValueCommit={([val]) => {
                          saveTrendPrefs.mutate({ trend_enabled: true, selected_trend: selectedTrend, default_trend_intensity: val });
                        }}
                        min={0}
                        max={100}
                        step={5}
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Pure brand</span>
                        <span>Balanced</span>
                        <span>Full trend</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Research Lab, per-category Firecrawl tuning */}
          {(() => {
            const RESEARCH_CATEGORIES: Array<{ id: string; name: string; defaultRecency: "24h" | "7d" | "30d"; description: string }> = [
              { id: "trending",      name: "Trending",      defaultRecency: "24h", description: "Viral moments, fast-moving culture" },
              { id: "entertainment", name: "Entertainment", defaultRecency: "7d",  description: "Pop culture, memes, what's hot" },
              { id: "holidays",      name: "Holidays & Greetings", defaultRecency: "7d", description: "Upcoming dates and cultural moments" },
              { id: "informational", name: "Informational", defaultRecency: "30d", description: "Stats, facts, evergreen tips" },
            ];
            const RECENCY_OPTIONS: Array<"24h" | "7d" | "30d"> = ["24h", "7d", "30d"];
            const activeCount = RESEARCH_CATEGORIES.filter(c => researchPrefs[c.id]?.enabled !== false).length;
            return (
              <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4">
                <button onClick={() => setResearchLabOpen(!researchLabOpen)} className="w-full flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Research Lab</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {activeCount}/{RESEARCH_CATEGORIES.length} on
                    </span>
                    {researchLabOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {researchLabOpen && (
                  <div className="space-y-4 pt-2">
                    <p className="text-sm text-muted-foreground">
                      Tune how aggressively Brandie searches the live web (via Firecrawl) when generating each content type. <span className="font-medium text-foreground/80">Fast</span> uses fewer sources for speed; <span className="font-medium text-foreground/80">Accurate</span> pulls more.
                    </p>

                    <div className="space-y-3">
                      {RESEARCH_CATEGORIES.map((cat) => {
                        const pref = researchPrefs[cat.id] || {};
                        const enabled = pref.enabled !== false;
                        const mode = pref.mode || "fast";
                        const recency = pref.recency || cat.defaultRecency;
                        return (
                          <div key={cat.id} className={`rounded-xl border p-3 sm:p-4 transition-colors ${enabled ? "border-border bg-background" : "border-border/60 bg-muted/30"}`}>
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium">{cat.name}</p>
                                <p className="text-xs text-muted-foreground leading-snug">{cat.description}</p>
                              </div>
                              <Switch
                                checked={enabled}
                                onCheckedChange={(val) => updateResearchPref(cat.id, { enabled: val })}
                              />
                            </div>

                            {enabled && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Mode */}
                                <div className="space-y-1.5">
                                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Search depth</label>
                                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-muted">
                                    {(["fast", "accurate"] as const).map((m) => (
                                      <button
                                        key={m}
                                        onClick={() => updateResearchPref(cat.id, { mode: m })}
                                        className={`text-xs py-1.5 rounded-md font-medium transition-all flex items-center justify-center gap-1 ${
                                          mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                        }`}
                                      >
                                        {m === "fast" ? <Zap className="h-3 w-3" /> : <Search className="h-3 w-3" />}
                                        {m === "fast" ? "Fast" : "Accurate"}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* Recency */}
                                <div className="space-y-1.5">
                                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Recency window</label>
                                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-muted">
                                    {RECENCY_OPTIONS.map((r) => (
                                      <button
                                        key={r}
                                        onClick={() => updateResearchPref(cat.id, { recency: r })}
                                        className={`text-xs py-1.5 rounded-md font-medium transition-all ${
                                          recency === r ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                        }`}
                                      >
                                        {r}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          </EditorGroup>

        </motion.div>
      </main>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={(open) => { if (!applyingImport) { setConfirmDialogOpen(open); if (!open) setScannedBrand(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply website import?</DialogTitle>
            <DialogDescription>
              Select which fields to overwrite with the detected brand details.
            </DialogDescription>
          </DialogHeader>

          {scannedBrand && (() => {
            const fieldKeys = Object.keys(selectedFields);
            const selectedCount = fieldKeys.filter(k => selectedFields[k]).length;
            const totalCount = fieldKeys.length;
            const allSelected = selectedCount === totalCount;

            const toggleField = (key: string) => setSelectedFields(prev => ({ ...prev, [key]: !prev[key] }));
            const toggleAll = () => {
              const newVal = !allSelected;
              setSelectedFields(prev => Object.fromEntries(Object.keys(prev).map(k => [k, newVal])));
            };

            return (
              <div className="space-y-1 max-h-[50vh] overflow-y-auto text-sm">
                <button onClick={toggleAll} className="text-xs text-primary hover:underline mb-2">
                  {allSelected ? "Deselect all" : "Select all"}
                </button>

                {selectedFields.name !== undefined && (
                  <label className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer hover:bg-secondary/50 transition-opacity ${!selectedFields.name ? "opacity-50" : ""}`}>
                    <Checkbox checked={selectedFields.name} onCheckedChange={() => toggleField("name")} className="mt-0.5" />
                    <div><span className="text-muted-foreground text-xs uppercase tracking-wider">Name</span><p className="font-medium">{scannedBrand.name}</p></div>
                  </label>
                )}
                {selectedFields.tagline !== undefined && (
                  <label className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer hover:bg-secondary/50 transition-opacity ${!selectedFields.tagline ? "opacity-50" : ""}`}>
                    <Checkbox checked={selectedFields.tagline} onCheckedChange={() => toggleField("tagline")} className="mt-0.5" />
                    <div><span className="text-muted-foreground text-xs uppercase tracking-wider">Tagline</span><p>{scannedBrand.tagline}</p></div>
                  </label>
                )}
                {selectedFields.description !== undefined && (
                  <label className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer hover:bg-secondary/50 transition-opacity ${!selectedFields.description ? "opacity-50" : ""}`}>
                    <Checkbox checked={selectedFields.description} onCheckedChange={() => toggleField("description")} className="mt-0.5" />
                    <div><span className="text-muted-foreground text-xs uppercase tracking-wider">Description</span><p className="text-muted-foreground">{scannedBrand.description}</p></div>
                  </label>
                )}
                {selectedFields.vibe !== undefined && (
                  <label className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer hover:bg-secondary/50 transition-opacity ${!selectedFields.vibe ? "opacity-50" : ""}`}>
                    <Checkbox checked={selectedFields.vibe} onCheckedChange={() => toggleField("vibe")} className="mt-0.5" />
                    <div><span className="text-muted-foreground text-xs uppercase tracking-wider">Vibe</span><p><span className="inline-block px-2.5 py-1 rounded-lg bg-secondary text-xs font-medium">{scannedBrand.vibe}</span></p></div>
                  </label>
                )}
                {selectedFields.colours !== undefined && (
                  <label className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer hover:bg-secondary/50 transition-opacity ${!selectedFields.colours ? "opacity-50" : ""}`}>
                    <Checkbox checked={selectedFields.colours} onCheckedChange={() => toggleField("colours")} className="mt-0.5" />
                    <div>
                      <span className="text-muted-foreground text-xs uppercase tracking-wider">Colours</span>
                      <div className="flex gap-1.5 mt-1">
                        {[...(scannedBrand.primary_colors || []), ...(scannedBrand.secondary_colors || []), ...(scannedBrand.accent_colors || [])].map((c: string, i: number) => (
                          <div key={i} className="w-7 h-7 rounded-lg border border-border" style={{ backgroundColor: c }} title={c} />
                        ))}
                      </div>
                    </div>
                  </label>
                )}
                {selectedFields.typography !== undefined && (
                  <label className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer hover:bg-secondary/50 transition-opacity ${!selectedFields.typography ? "opacity-50" : ""}`}>
                    <Checkbox checked={selectedFields.typography} onCheckedChange={() => toggleField("typography")} className="mt-0.5" />
                    <div><span className="text-muted-foreground text-xs uppercase tracking-wider">Typography</span><p>{scannedBrand.typography_primary}{scannedBrand.typography_secondary ? ` / ${scannedBrand.typography_secondary}` : ""}</p></div>
                  </label>
                )}
                {selectedFields.tone_of_voice !== undefined && (
                  <label className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer hover:bg-secondary/50 transition-opacity ${!selectedFields.tone_of_voice ? "opacity-50" : ""}`}>
                    <Checkbox checked={selectedFields.tone_of_voice} onCheckedChange={() => toggleField("tone_of_voice")} className="mt-0.5" />
                    <div><span className="text-muted-foreground text-xs uppercase tracking-wider">Tone of Voice</span><p className="text-muted-foreground">{scannedBrand.tone_of_voice}</p></div>
                  </label>
                )}
                {selectedFields.personality !== undefined && (
                  <label className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer hover:bg-secondary/50 transition-opacity ${!selectedFields.personality ? "opacity-50" : ""}`}>
                    <Checkbox checked={selectedFields.personality} onCheckedChange={() => toggleField("personality")} className="mt-0.5" />
                    <div>
                      <span className="text-muted-foreground text-xs uppercase tracking-wider">Personality</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {scannedBrand.personality_traits.map((t: string) => (
                          <span key={t} className="inline-block px-2 py-0.5 rounded-lg bg-secondary text-xs">{t}</span>
                        ))}
                      </div>
                    </div>
                  </label>
                )}
                {selectedFields.logo !== undefined && (
                  <label className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer hover:bg-secondary/50 transition-opacity ${!selectedFields.logo ? "opacity-50" : ""}`}>
                    <Checkbox checked={selectedFields.logo} onCheckedChange={() => toggleField("logo")} className="mt-0.5" />
                    <div>
                      <span className="text-muted-foreground text-xs uppercase tracking-wider">Logo</span>
                      <img src={scannedBrand.logo_url} alt="Detected logo" className="h-12 object-contain mt-1 rounded-lg border border-border p-1" />
                    </div>
                  </label>
                )}
                {selectedFields.audience !== undefined && (
                  <label className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer hover:bg-secondary/50 transition-opacity ${!selectedFields.audience ? "opacity-50" : ""}`}>
                    <Checkbox checked={selectedFields.audience} onCheckedChange={() => toggleField("audience")} className="mt-0.5" />
                    <div><span className="text-muted-foreground text-xs uppercase tracking-wider">Target Audience</span><p className="text-muted-foreground">Inferred audience profile from website</p></div>
                  </label>
                )}
              </div>
            );
          })()}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setConfirmDialogOpen(false); setScannedBrand(null); }} disabled={applyingImport}>
              Cancel
            </Button>
            <Button onClick={applyWebsiteImport} disabled={applyingImport || Object.values(selectedFields).every(v => !v)} className="gap-2">
              {applyingImport ? <><Loader2 className="h-4 w-4 animate-spin" /> Applying…</> : <><Check className="h-4 w-4" /> Apply {Object.values(selectedFields).filter(Boolean).length} of {Object.keys(selectedFields).length} fields</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BrandCentre;
