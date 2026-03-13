import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { ArrowLeft, Check, Pencil, Upload, X, ChevronDown, ChevronUp, Target, Loader2, RefreshCw, Plus, Trash2, Users, Palette } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { TREND_PRESETS, getTrendById } from "@/lib/trendPresets";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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

const BrandCentre = () => {
  const { brand, refetch } = useBrand();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<EditingField>(null);
  const [saving, setSaving] = useState(false);

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

  // Audience Intelligence — multiple profiles
  const queryClient = useQueryClient();
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

  useEffect(() => {
    if (trendPrefs) {
      setTrendEnabled(trendPrefs.trend_enabled ?? false);
      setSelectedTrend(trendPrefs.selected_trend ?? "none");
      setTrendIntensity(trendPrefs.default_trend_intensity ?? 40);
    }
  }, [trendPrefs]);

  const saveTrendPrefs = useMutation({
    mutationFn: async (updates: { trend_enabled?: boolean; selected_trend?: string; default_trend_intensity?: number }) => {
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
    onError: (err: any) => toast({ title: "Error saving trend preferences", description: err.message, variant: "destructive" }),
  });

  const selectedAudience = audiences.find((a: any) => a.id === selectedAudienceId) || audiences[0] || null;

  useEffect(() => {
    if (audiences.length > 0 && !selectedAudienceId) {
      setSelectedAudienceId(audiences[0].id);
    }
  }, [audiences, selectedAudienceId]);

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
      if (!brand) return [];
      const { data, error } = await supabase.from("brand_inspiration").select("*").eq("brand_id", brand.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!brand,
  });

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

  const handleProductUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !brand || !user) return;
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("brand-products").upload(path, file);
      if (upErr) continue;
      const { data: urlData } = supabase.storage.from("brand-products").getPublicUrl(path);
      await supabase.from("brand_products" as any).insert({ brand_id: brand.id, image_url: urlData.publicUrl, label: file.name.replace(/\.[^.]+$/, "") } as any);
    }
    toast({ title: "Product images added" }); refetchProducts();
  };

  const deleteProduct = async (id: string) => {
    await supabase.from("brand_products" as any).delete().eq("id", id); refetchProducts();
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
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("brand-inspiration").upload(path, file);
      if (upErr) continue;
      const { data: urlData } = supabase.storage.from("brand-inspiration").getPublicUrl(path);
      await supabase.from("brand_inspiration").insert({ brand_id: brand.id, image_url: urlData.publicUrl });
    }
    toast({ title: "Inspiration added" }); refetchInspiration();
  };

  const deleteInspiration = async (id: string) => {
    await supabase.from("brand_inspiration").delete().eq("id", id); refetchInspiration();
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

  if (!brand) return null;

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

  // Audience questionnaire form (reusable)
  const AudienceForm = () => (
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
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
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
              <label className="cursor-pointer">
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground pointer-events-none"><Upload className="h-3 w-3" /> Replace</Button>
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </label>
            </div>
            {brand.logo_url ? (
              <img src={brand.logo_url} alt="Brand logo" className="h-20 object-contain" />
            ) : (
              <div className="h-20 w-20 rounded-xl bg-secondary flex items-center justify-center"><span className="text-xs text-muted-foreground">No logo</span></div>
            )}
          </div>

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
          <Section title="Typography" field="typography" editContent={
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
          }>
            <div className="flex gap-6">
              <div><label className="text-xs text-muted-foreground">Body</label><p className="text-sm font-medium">{brand.typography_primary || "Not set"}</p></div>
              <div><label className="text-xs text-muted-foreground">Headings</label><p className="text-sm font-medium">{brand.typography_secondary || "Not set"}</p></div>
            </div>
          </Section>

          {/* Product Images */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Product Images</h3>
              <label className="cursor-pointer">
                <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground">
                  <span><Upload className="h-3 w-3" /> Add</span>
                </Button>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleProductUpload} />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">Upload photos of your products. They'll be used contextually in designs when relevant (promotions, launches, showcases).</p>
            {productImages && productImages.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {productImages.map((item: any) => (
                  <div key={item.id} className="relative aspect-square group">
                    <img src={item.image_url} alt={item.label || "Product"} className="w-full h-full object-cover rounded-xl border border-border" />
                    <button onClick={() => deleteProduct(item.id)} className="absolute top-2 right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3 w-3" /></button>
                    {item.label && <span className="absolute bottom-2 left-2 right-2 text-[10px] text-foreground bg-background/80 backdrop-blur-sm rounded-lg px-2 py-1 truncate">{item.label}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No product images yet.</p>
            )}
          </div>

          {/* Inspiration */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Inspiration</h3>
              <label className="cursor-pointer">
                <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground">
                  <span><Upload className="h-3 w-3" /> Add</span>
                </Button>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleInspirationUpload} />
              </label>
            </div>
            {inspiration && inspiration.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {inspiration.map((item) => (
                  <div key={item.id} className="relative aspect-square group">
                    <img src={item.image_url} alt="" className="w-full h-full object-cover rounded-xl border border-border" />
                    <button onClick={() => deleteInspiration(item.id)} className="absolute top-2 right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No inspiration images yet.</p>
            )}
          </div>

          {/* Special Instructions */}
          <Section title="Special Instructions" field="special_instructions" editContent={
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">These are persistent, high-priority rules the AI will always follow when generating designs. Use them for things like language preferences, content restrictions, or mandatory elements.</p>
              <Textarea value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} placeholder='e.g. "Always include our website URL: www.example.com", "Use Yoruba language for headlines", "Never use stock photos of people"' maxLength={2000} className="min-h-[120px]" />
            </div>
          }>
            {(brand as any).special_instructions ? (
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{(brand as any).special_instructions}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No special instructions set. Add persistent rules that the AI will always follow.</p>
            )}
          </Section>

          {/* Target Audience Intelligence */}
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4">
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
                      <AudienceForm />
                    ) : (
                      <AudienceProfileDisplay profile={selectedAudience.jtbd_profile} />
                    )}
                  </>
                )}
              </div>
            )}
          </div>

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
        </motion.div>
      </main>
    </div>
  );
};

export default BrandCentre;
