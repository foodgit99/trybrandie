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
import { ArrowLeft, Check, Pencil, Upload, X, LogOut } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

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

  // Inspiration
  const { data: inspiration, refetch: refetchInspiration } = useQuery({
    queryKey: ["brand_inspiration", brand?.id],
    queryFn: async () => {
      if (!brand) return [];
      const { data, error } = await supabase
        .from("brand_inspiration")
        .select("*")
        .eq("brand_id", brand.id);
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

    if (field === "info") {
      updates = { name: name.trim(), tagline: tagline.trim(), description: description.trim() };
    } else if (field === "colors") {
      updates = { primary_colors: primaryColors, secondary_colors: secondaryColors, accent_colors: accentColors };
    } else if (field === "typography") {
      updates = { typography_primary: typPrimary, typography_secondary: typSecondary };
    } else if (field === "vibe") {
      updates = { vibe };
    } else if (field === "tone") {
      updates = { tone_of_voice: toneOfVoice.trim() };
    } else if (field === "personality") {
      updates = { personality_traits: personalityTraits };
    }

    const { error } = await supabase.from("brands").update(updates as any).eq("id", brand.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved" });
      setEditing(null);
      refetch();
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !brand || !user) return;
    setSaving(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("brand-logos").upload(path, file);
    if (upErr) {
      toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
      setSaving(false);
      return;
    }
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

  const handleColorChange = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    arr: string[],
    index: number,
    value: string
  ) => {
    const copy = [...arr];
    copy[index] = value;
    setter(copy);
  };

  const addColor = (setter: React.Dispatch<React.SetStateAction<string[]>>, arr: string[]) => {
    if (arr.length < 5) setter([...arr, "#cccccc"]);
  };

  const togglePersonalityTrait = (trait: string) => {
    if (personalityTraits.includes(trait)) {
      setPersonalityTraits(personalityTraits.filter((t) => t !== trait));
    } else {
      setPersonalityTraits([...personalityTraits, trait]);
    }
  };

  if (!brand) return null;

  const Section = ({
    title,
    field,
    children,
    editContent,
  }: {
    title: string;
    field: EditingField;
    children: React.ReactNode;
    editContent: React.ReactNode;
  }) => (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{title}</h3>
        {editing === field ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => saveField(field)} disabled={saving} className="gap-1">
              <Check className="h-3 w-3" /> Save
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setEditing(field)} className="gap-1 text-muted-foreground">
            <Pencil className="h-3 w-3" /> Edit
          </Button>
        )}
      </div>
      {editing === field ? editContent : children}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-8 py-6 border-b border-border">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-serif tracking-tight">Brand Centre</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          {/* Brand Info */}
          <Section
            title="Brand Info"
            field="info"
            editContent={
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Tagline</label>
                  <Input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={200} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
                </div>
              </div>
            }
          >
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
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground pointer-events-none">
                  <Upload className="h-3 w-3" /> Replace
                </Button>
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </label>
            </div>
            {brand.logo_url ? (
              <img src={brand.logo_url} alt="Brand logo" className="h-20 object-contain" />
            ) : (
              <div className="h-20 w-20 rounded-xl bg-secondary flex items-center justify-center">
                <span className="text-xs text-muted-foreground">No logo</span>
              </div>
            )}
          </div>

          {/* Tone of Voice */}
          <Section
            title="Tone of Voice"
            field="tone"
            editContent={
              <Textarea
                value={toneOfVoice}
                onChange={(e) => setToneOfVoice(e.target.value)}
                placeholder="e.g. Friendly and warm, with a touch of humour..."
                maxLength={500}
              />
            }
          >
            <p className="text-sm text-muted-foreground leading-relaxed">
              {(brand as any).tone_of_voice || "Not set"}
            </p>
          </Section>

          {/* Personality Traits */}
          <Section
            title="Personality Traits"
            field="personality"
            editContent={
              <div className="flex flex-wrap gap-2">
                {PERSONALITY_OPTIONS.map((trait) => (
                  <button
                    key={trait}
                    onClick={() => togglePersonalityTrait(trait)}
                    className={`px-4 py-2.5 rounded-xl text-sm border transition-all ${
                      personalityTraits.includes(trait)
                        ? "border-primary bg-primary/5 font-medium"
                        : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    {trait}
                  </button>
                ))}
              </div>
            }
          >
            <div className="flex flex-wrap gap-2">
              {((brand as any).personality_traits || []).length > 0 ? (
                ((brand as any).personality_traits as string[]).map((trait) => (
                  <span key={trait} className="inline-block px-3 py-1.5 rounded-xl bg-secondary text-sm font-medium">
                    {trait}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">Not set</span>
              )}
            </div>
          </Section>

          {/* Vibe */}
          <Section
            title="Brand Vibe"
            field="vibe"
            editContent={
              <div className="grid grid-cols-3 gap-2">
                {VIBES.map((v) => (
                  <button
                    key={v}
                    onClick={() => setVibe(v)}
                    className={`px-4 py-3 rounded-xl border text-sm transition-all ${
                      vibe === v ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            }
          >
            <span className="inline-block px-4 py-2 rounded-xl bg-secondary text-sm font-medium">
              {brand.vibe || "Not set"}
            </span>
          </Section>

          {/* Colours */}
          <Section
            title="Colours"
            field="colors"
            editContent={
              <div className="space-y-5">
                {([
                  ["Primary", primaryColors, setPrimaryColors],
                  ["Secondary", secondaryColors, setSecondaryColors],
                  ["Accent", accentColors, setAccentColors],
                ] as const).map(([label, arr, setter]) => (
                  <div key={label} className="space-y-2">
                    <label className="text-sm font-medium">{label}</label>
                    <div className="flex items-center gap-3 flex-wrap">
                      {arr.map((c, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            type="color"
                            value={c}
                            onChange={(e) => handleColorChange(setter as any, arr as any, i, e.target.value)}
                            className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                          />
                          <span className="text-xs text-muted-foreground font-mono">{c}</span>
                        </div>
                      ))}
                      {arr.length < 5 && (
                        <button
                          onClick={() => addColor(setter as any, arr as any)}
                          className="w-10 h-10 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-muted-foreground/40 transition-colors"
                        >
                          +
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            }
          >
            <div className="space-y-3">
              {([
                ["Primary", brand.primary_colors],
                ["Secondary", brand.secondary_colors],
                ["Accent", brand.accent_colors],
              ] as const).map(([label, colors]) => (
                <div key={label} className="space-y-1">
                  <label className="text-xs text-muted-foreground">{label}</label>
                  <div className="flex gap-2">
                    {(colors || []).map((c, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <div className="w-8 h-8 rounded-lg border border-border" style={{ backgroundColor: c }} />
                        <span className="text-xs font-mono text-muted-foreground">{c}</span>
                      </div>
                    ))}
                    {(!colors || colors.length === 0) && (
                      <span className="text-xs text-muted-foreground">Not set</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Typography */}
          <Section
            title="Typography"
            field="typography"
            editContent={
              <div className="space-y-5">
                {([
                  ["Body font", typPrimary, setTypPrimary],
                  ["Heading font", typSecondary, setTypSecondary],
                ] as const).map(([label, val, setter]) => (
                  <div key={label} className="space-y-2">
                    <label className="text-sm font-medium">{label}</label>
                    <div className="grid grid-cols-2 gap-2">
                      {FONT_OPTIONS.map((font) => (
                        <button
                          key={font}
                          onClick={() => (setter as any)(font)}
                          className={`px-4 py-3 rounded-xl text-sm text-left border transition-all ${
                            val === font ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-muted-foreground/40"
                          }`}
                        >
                          {font}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            }
          >
            <div className="flex gap-6">
              <div>
                <label className="text-xs text-muted-foreground">Body</label>
                <p className="text-sm font-medium">{brand.typography_primary || "Not set"}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Headings</label>
                <p className="text-sm font-medium">{brand.typography_secondary || "Not set"}</p>
              </div>
            </div>
          </Section>

          {/* Inspiration */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Inspiration</h3>
              <label className="cursor-pointer">
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground pointer-events-none">
                  <Upload className="h-3 w-3" /> Add
                </Button>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleInspirationUpload} />
              </label>
            </div>
            {inspiration && inspiration.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {inspiration.map((item) => (
                  <div key={item.id} className="relative aspect-square group">
                    <img src={item.image_url} alt="" className="w-full h-full object-cover rounded-xl border border-border" />
                    <button
                      onClick={() => deleteInspiration(item.id)}
                      className="absolute top-2 right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No inspiration images yet.</p>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default BrandCentre;
