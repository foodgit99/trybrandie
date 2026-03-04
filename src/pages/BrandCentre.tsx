import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBrand } from "@/hooks/useBrand";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Pencil, Upload, X, LogOut, ChevronDown, ChevronUp, Target, Loader2, RefreshCw } from "lucide-react";
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

type EditingField = null | "info" | "colors" | "typography" | "vibe" | "logo" | "tone" | "personality";

const BrandCentre = () => {
  const { brand, refetch } = useBrand();
  const { user, signOut } = useAuth();
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
  const [personalityTraits, setPersonalityTraits] = useState<string[]>([]);
  const [primaryColors, setPrimaryColors] = useState<string[]>([]);
  const [secondaryColors, setSecondaryColors] = useState<string[]>([]);
  const [accentColors, setAccentColors] = useState<string[]>([]);
  const [typPrimary, setTypPrimary] = useState("");
  const [typSecondary, setTypSecondary] = useState("");

  // Audience Intelligence
  const queryClient = useQueryClient();
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [audienceEditing, setAudienceEditing] = useState(false);
  const [audienceInputs, setAudienceInputs] = useState({
    who_buys: "", life_stage: "", improving: "",
    frustrations: "", not_working: "", tried_before: "",
    success_looks_like: "", consequences: "",
    when_buy: "", hesitations: "",
    emotional_drivers: [] as string[],
  });

  const { data: audience } = useQuery({
    queryKey: ["target_audience", brand?.id],
    queryFn: async () => {
      if (!brand) return null;
      const { data, error } = await supabase
        .from("target_audiences" as any)
        .select("*")
        .eq("brand_id", brand.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!brand,
  });

  useEffect(() => {
    if (audience?.raw_inputs && typeof audience.raw_inputs === "object") {
      const ri = audience.raw_inputs as any;
      setAudienceInputs({
        who_buys: ri.who_buys || "", life_stage: ri.life_stage || "", improving: ri.improving || "",
        frustrations: ri.frustrations || "", not_working: ri.not_working || "", tried_before: ri.tried_before || "",
        success_looks_like: ri.success_looks_like || "", consequences: ri.consequences || "",
        when_buy: ri.when_buy || "", hesitations: ri.hesitations || "",
        emotional_drivers: ri.emotional_drivers || [],
      });
    }
  }, [audience]);

  const hasJtbdProfile = audience?.jtbd_profile && Object.keys(audience.jtbd_profile as any).length > 0;

  const generateProfileMutation = useMutation({
    mutationFn: async () => {
      if (audience) {
        await supabase.from("target_audiences" as any).update({ raw_inputs: audienceInputs } as any).eq("id", audience.id);
      } else {
        const { error } = await supabase.from("target_audiences" as any).insert({ brand_id: brand!.id, raw_inputs: audienceInputs } as any);
        if (error) throw error;
      }
      const { data, error } = await supabase.functions.invoke("audience-intelligence", {
        body: { raw_inputs: audienceInputs, brand: { name: brand!.name, description: brand!.description, tagline: brand!.tagline } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const { data: latest } = await supabase.from("target_audiences" as any).select("id").eq("brand_id", brand!.id).order("created_at", { ascending: true }).limit(1).single();
      if (latest) {
        await supabase.from("target_audiences" as any).update({ jtbd_profile: data.profile } as any).eq("id", (latest as any).id);
      }
      return data.profile;
    },
    onSuccess: () => {
      toast({ title: "Audience profile generated" });
      queryClient.invalidateQueries({ queryKey: ["target_audience", brand?.id] });
      setAudienceEditing(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
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

  useEffect(() => {
    if (brand) {
      setName(brand.name || "");
      setTagline(brand.tagline || "");
      setDescription(brand.description || "");
      setVibe(brand.vibe || "");
      setToneOfVoice((brand as any).tone_of_voice || "");
      setPersonalityTraits((brand as any).personality_traits || []);
      setPrimaryColors(brand.primary_colors || []);
      setSecondaryColors(brand.secondary_colors || []);
      setAccentColors(brand.accent_colors || []);
      setTypPrimary(brand.typography_primary || "");
      setTypSecondary(brand.typography_secondary || "");
    }
  }, [brand]);

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
    toast({ title: "Logo updated" });
    refetch();
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
    toast({ title: "Inspiration added" });
    refetchInspiration();
  };

  const deleteInspiration = async (id: string) => {
    await supabase.from("brand_inspiration").delete().eq("id", id);
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

  if (!brand) return null;

  const Section = ({ title, field, children, editContent }: { title: string; field: EditingField; children: React.ReactNode; editContent: React.ReactNode }) => (
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

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-xl sm:text-2xl font-serif tracking-tight">Brand Centre</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
          {/* Brand Info */}
          <Section title="Brand Info" field="info" editContent={
            <div className="space-y-4">
              <div className="space-y-1"><label className="text-sm font-medium">Name</label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} /></div>
              <div className="space-y-1"><label className="text-sm font-medium">Tagline</label><Input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={200} /></div>
              <div className="space-y-1"><label className="text-sm font-medium">Description</label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} /></div>
            </div>
          }>
            <div className="space-y-2">
              <h2 className="text-2xl font-serif">{brand.name}</h2>
              {brand.tagline && <p className="text-muted-foreground">{brand.tagline}</p>}
              {brand.description && <p className="text-sm text-muted-foreground leading-relaxed">{brand.description}</p>}
            </div>
          </Section>

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
          <Section title="Tone of Voice" field="tone" editContent={
            <Textarea value={toneOfVoice} onChange={(e) => setToneOfVoice(e.target.value)} placeholder="e.g. Friendly and warm, with a touch of humour..." maxLength={500} />
          }>
            <p className="text-sm text-muted-foreground leading-relaxed">{(brand as any).tone_of_voice || "Not set"}</p>
          </Section>

          {/* Personality Traits */}
          <Section title="Personality Traits" field="personality" editContent={
            <div className="flex flex-wrap gap-2">
              {PERSONALITY_OPTIONS.map((trait) => (
                <button key={trait} onClick={() => togglePersonalityTrait(trait)} className={`px-4 py-2.5 rounded-xl text-sm border transition-all ${personalityTraits.includes(trait) ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-muted-foreground/40"}`}>{trait}</button>
              ))}
            </div>
          }>
            <div className="flex flex-wrap gap-2">
              {((brand as any).personality_traits || []).length > 0 ? (
                ((brand as any).personality_traits as string[]).map((trait) => (
                  <span key={trait} className="inline-block px-3 py-1.5 rounded-xl bg-secondary text-sm font-medium">{trait}</span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">Not set</span>
              )}
            </div>
          </Section>

          {/* Vibe */}
          <Section title="Brand Vibe" field="vibe" editContent={
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {VIBES.map((v) => (
                <button key={v} onClick={() => setVibe(v)} className={`px-4 py-3 rounded-xl border text-sm transition-all ${vibe === v ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-muted-foreground/40"}`}>{v}</button>
              ))}
            </div>
          }>
            <span className="inline-block px-4 py-2 rounded-xl bg-secondary text-sm font-medium">{brand.vibe || "Not set"}</span>
          </Section>

          {/* Colours */}
          <Section title="Colours" field="colors" editContent={
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
          }>
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
            </div>
          </Section>

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

          {/* Inspiration */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Inspiration</h3>
              <label className="cursor-pointer">
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground pointer-events-none"><Upload className="h-3 w-3" /> Add</Button>
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

          {/* Target Audience Intelligence */}
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4">
            <button onClick={() => setAudienceOpen(!audienceOpen)} className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Target Audience Intelligence</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${hasJtbdProfile ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                  {hasJtbdProfile ? "Profile active" : "Not configured"}
                </span>
                {audienceOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>

            {!audienceOpen && hasJtbdProfile && (
              <div className="space-y-1 pt-1">
                <p className="text-sm font-medium">{(audience.jtbd_profile as any).persona_summary}</p>
                <p className="text-xs text-muted-foreground italic">{(audience.jtbd_profile as any).core_job_statement}</p>
              </div>
            )}

            {audienceOpen && (
              <div className="space-y-6 pt-2">
                {(audienceEditing || !hasJtbdProfile) && (
                  <div className="space-y-6">
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
                )}

                {hasJtbdProfile && !audienceEditing && (
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setAudienceEditing(true)} className="gap-1 text-muted-foreground"><Pencil className="h-3 w-3" /> Edit</Button>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground uppercase tracking-wider">Persona</label>
                      <p className="text-sm">{(audience.jtbd_profile as any).persona_summary}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground uppercase tracking-wider">Core Job Statement</label>
                      <p className="text-sm italic">{(audience.jtbd_profile as any).core_job_statement}</p>
                    </div>
                    {([["Struggling Moments", "struggling_moments"], ["Push Forces", "push_forces"], ["Pull Forces", "pull_forces"], ["Anxiety Forces", "anxiety_forces"], ["Buying Triggers", "buying_triggers"], ["Hesitation Factors", "hesitation_factors"], ["Messaging Angles", "messaging_angles"], ["Conversion Levers", "conversion_levers_ranked"]] as const).map(([label, key]) => {
                      const items = (audience.jtbd_profile as any)[key];
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
                      const items = (audience.jtbd_profile as any)[key];
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
