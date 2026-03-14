import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, Upload, X, Check, Sparkles } from "lucide-react";
import brandieLogo from "@/assets/brandie-logo.png";
import LogoDesignerDialog from "@/components/LogoDesignerDialog";

const VIBES = ["Minimal", "Bold", "Luxury", "Playful", "Corporate", "Cinematic"] as const;

const PERSONALITY_OPTIONS = [
  "Witty", "Warm", "Bold", "Sophisticated", "Approachable",
  "Energetic", "Calm", "Edgy", "Playful", "Authoritative",
  "Inspiring", "Trustworthy",
];

const FONT_OPTIONS = [
  "DM Sans", "Inter", "Poppins", "Playfair Display", "Montserrat", "Lora",
  "Raleway", "Oswald", "Merriweather", "Roboto Slab", "Space Grotesk", "Outfit",
];

const TOTAL_STEPS = 10;

const STEP_TITLES = [
  "What's your brand called?",
  "Got a tagline?",
  "Tell us about your brand",
  "Upload your logo",
  "Pick your brand colours",
  "Choose your typography",
  "What's your brand vibe?",
  "Describe your tone of voice",
  "Pick your personality traits",
  "Upload some inspiration",
];

const STEP_SUBTITLES = [
  "This is how we'll refer to your brand throughout Brandie.",
  "A short phrase that captures your brand's essence. Optional.",
  "A few sentences about what your brand does and who it's for.",
  "We'll use this in every design we create for you.",
  "Choose primary, secondary, and accent colours for your brand.",
  "Pick fonts that represent your brand's personality.",
  "Select the overall aesthetic direction for your designs.",
  "How should your brand sound? e.g. 'Friendly and warm' or 'Professional and direct'.",
  "Select traits that best describe your brand's personality.",
  "Upload examples of designs you love. We'll learn from them. Optional.",
];

type BrandData = {
  name: string;
  tagline: string;
  description: string;
  logoFile: File | null;
  logoPreview: string;
  primaryColors: string[];
  secondaryColors: string[];
  accentColors: string[];
  typographyPrimary: string;
  typographySecondary: string;
  vibe: string;
  toneOfVoice: string;
  personalityTraits: string[];
  inspirationFiles: File[];
  inspirationPreviews: string[];
};

const Onboarding = () => {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState<BrandData>({
    name: "",
    tagline: "",
    description: "",
    logoFile: null,
    logoPreview: "",
    primaryColors: ["#1a1a2e"],
    secondaryColors: ["#e8e4df"],
    accentColors: ["#c4a265"],
    typographyPrimary: "DM Sans",
    typographySecondary: "Playfair Display",
    vibe: "",
    toneOfVoice: "",
    personalityTraits: [],
    inspirationFiles: [],
    inspirationPreviews: [],
  });

  const update = <K extends keyof BrandData>(key: K, value: BrandData[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

  const canAdvance = () => {
    if (step === 0) return data.name.trim().length > 0;
    if (step === 6) return data.vibe.length > 0;
    return true;
  };

  const lastStep = TOTAL_STEPS - 1;
  const next = () => step < lastStep && canAdvance() && setStep(step + 1);
  const prev = () => step > 0 && setStep(step - 1);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    update("logoFile", file);
    update("logoPreview", URL.createObjectURL(file));
  };

  const handleInspirationSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const previews = files.map((f) => URL.createObjectURL(f));
    update("inspirationFiles", [...data.inspirationFiles, ...files]);
    update("inspirationPreviews", [...data.inspirationPreviews, ...previews]);
  };

  const removeInspiration = (index: number) => {
    update("inspirationFiles", data.inspirationFiles.filter((_, i) => i !== index));
    update("inspirationPreviews", data.inspirationPreviews.filter((_, i) => i !== index));
  };

  const handleColorChange = (
    field: "primaryColors" | "secondaryColors" | "accentColors",
    index: number,
    value: string
  ) => {
    const arr = [...data[field]];
    arr[index] = value;
    update(field, arr);
  };

  const addColor = (field: "primaryColors" | "secondaryColors" | "accentColors") => {
    if (data[field].length < 5) update(field, [...data[field], "#cccccc"]);
  };

  const togglePersonalityTrait = (trait: string) => {
    if (data.personalityTraits.includes(trait)) {
      update("personalityTraits", data.personalityTraits.filter((t) => t !== trait));
    } else {
      update("personalityTraits", [...data.personalityTraits, trait]);
    }
  };

  const handleFinish = useCallback(async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Upload logo
      let logoUrl: string | null = null;
      if (data.logoFile) {
        const ext = data.logoFile.name.split(".").pop();
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("brand-logos")
          .upload(path, data.logoFile);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("brand-logos").getPublicUrl(path);
        logoUrl = urlData.publicUrl;
      }

      // Insert brand
      const { data: brand, error: brandErr } = await supabase
        .from("brands")
        .insert({
          user_id: user.id,
          name: data.name.trim(),
          tagline: data.tagline.trim() || null,
          description: data.description.trim() || null,
          vibe: data.vibe || null,
          primary_colors: data.primaryColors,
          secondary_colors: data.secondaryColors,
          accent_colors: data.accentColors,
          typography_primary: data.typographyPrimary,
          typography_secondary: data.typographySecondary,
          logo_url: logoUrl,
          tone_of_voice: data.toneOfVoice.trim() || null,
          personality_traits: data.personalityTraits,
          onboarding_complete: true,
        } as any)
        .select()
        .single();
      if (brandErr) throw brandErr;

      // Upload inspiration images
      for (const file of data.inspirationFiles) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("brand-inspiration")
          .upload(path, file);
        if (upErr) continue;
        const { data: urlData } = supabase.storage.from("brand-inspiration").getPublicUrl(path);
        await supabase.from("brand_inspiration").insert({
          brand_id: (brand as any).id,
          image_url: urlData.publicUrl,
        });
      }

      // Send welcome email (fire-and-forget)
      supabase.functions.invoke("send-email", {
        body: { type: "welcome", to: user.email, data: { name: user.user_metadata?.full_name || "" } },
      }).catch(() => {});


      toast({ title: "Your brand system is ready." });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [data, user, navigate, toast]);

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <Input
            value={data.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="e.g. Bloom Studio"
            className="text-lg h-12"
            maxLength={100}
            autoFocus
          />
        );
      case 1:
        return (
          <Input
            value={data.tagline}
            onChange={(e) => update("tagline", e.target.value)}
            placeholder="e.g. Design that speaks"
            className="text-lg h-12"
            maxLength={200}
            autoFocus
          />
        );
      case 2:
        return (
          <Textarea
            value={data.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Tell us what your brand does, who it serves, and what makes it unique..."
            className="min-h-[120px] text-base"
            maxLength={1000}
            autoFocus
          />
        );
      case 3:
        return (
          <div className="space-y-4">
            {data.logoPreview ? (
              <div className="relative w-32 h-32 mx-auto">
                <img src={data.logoPreview} alt="Logo" className="w-full h-full object-contain rounded-xl border border-border" />
                <button
                  onClick={() => { update("logoFile", null); update("logoPreview", ""); }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-muted-foreground/40 transition-colors">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">Click to upload your logo</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
              </label>
            )}
          </div>
        );
      case 4:
        return (
          <div className="space-y-6">
            {(["primaryColors", "secondaryColors", "accentColors"] as const).map((field) => (
              <div key={field} className="space-y-2">
                <label className="text-sm font-medium capitalize">
                  {field.replace("Colors", " colours")}
                </label>
                <div className="flex items-center gap-3 flex-wrap">
                  {data[field].map((color, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => handleColorChange(field, i, e.target.value)}
                        className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                      />
                      <span className="text-xs text-muted-foreground font-mono">{color}</span>
                    </div>
                  ))}
                  {data[field].length < 5 && (
                    <button
                      onClick={() => addColor(field)}
                      className="w-10 h-10 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-muted-foreground/40 transition-colors"
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      case 5:
        return (
          <div className="space-y-6">
            {(["typographyPrimary", "typographySecondary"] as const).map((field) => (
              <div key={field} className="space-y-2">
                <label className="text-sm font-medium">
                  {field === "typographyPrimary" ? "Primary font (body)" : "Secondary font (headings)"}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {FONT_OPTIONS.map((font) => (
                    <button
                      key={font}
                      onClick={() => update(field, font)}
                      className={`px-4 py-3 rounded-xl text-sm text-left border transition-all ${
                        data[field] === font
                          ? "border-primary bg-primary/5 font-medium"
                          : "border-border hover:border-muted-foreground/40"
                      }`}
                    >
                      {font}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      case 6:
        return (
          <div className="grid grid-cols-2 gap-3">
            {VIBES.map((v) => (
              <button
                key={v}
                onClick={() => update("vibe", v)}
                className={`px-6 py-5 rounded-xl border text-left transition-all ${
                  data.vibe === v
                    ? "border-primary bg-primary/5 font-medium"
                    : "border-border hover:border-muted-foreground/40"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        );
      case 7:
        return (
          <Textarea
            value={data.toneOfVoice}
            onChange={(e) => update("toneOfVoice", e.target.value)}
            placeholder="e.g. Friendly and warm, with a touch of humour. We speak like a trusted friend, never corporate or stiff."
            className="min-h-[120px] text-base"
            maxLength={500}
            autoFocus
          />
        );
      case 8:
        return (
          <div className="flex flex-wrap gap-2">
            {PERSONALITY_OPTIONS.map((trait) => (
              <button
                key={trait}
                onClick={() => togglePersonalityTrait(trait)}
                className={`px-4 py-2.5 rounded-xl text-sm border transition-all ${
                  data.personalityTraits.includes(trait)
                    ? "border-primary bg-primary/5 font-medium"
                    : "border-border hover:border-muted-foreground/40"
                }`}
              >
                {trait}
              </button>
            ))}
          </div>
        );
      case 9:
        return (
          <div className="space-y-4">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-muted-foreground/40 transition-colors">
              <Upload className="h-6 w-6 text-muted-foreground mb-1" />
              <span className="text-sm text-muted-foreground">Upload inspiration images</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleInspirationSelect} />
            </label>
            {data.inspirationPreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {data.inspirationPreviews.map((src, i) => (
                  <div key={i} className="relative aspect-square">
                    <img src={src} alt="" className="w-full h-full object-cover rounded-xl border border-border" />
                    <button
                      onClick={() => removeInspiration(i)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const isLast = step === lastStep;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress bar */}
      <div className="w-full bg-secondary h-1">
        <motion.div
          className="h-full bg-primary"
          initial={false}
          animate={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Header */}
      <header className="px-4 sm:px-8 py-4 sm:py-6 flex items-center gap-2">
        <img src={brandieLogo} alt="Brandie" className="h-7 w-7" />
        <span className="text-lg font-serif tracking-tight">Brandie</span>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div>
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
                  Step {step + 1} of {TOTAL_STEPS}
                </p>
                <h2 className="text-2xl sm:text-3xl font-serif tracking-tight">{STEP_TITLES[step]}</h2>
                <p className="text-muted-foreground text-sm mt-1">{STEP_SUBTITLES[step]}</p>
              </div>

              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Navigation */}
      <footer className="px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={prev}
          disabled={step === 0}
          className="gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        {isLast ? (
          <Button onClick={handleFinish} disabled={saving} className="gap-2 h-11 px-6 rounded-xl">
            {saving ? "Setting up…" : (
              <>
                <Check className="h-4 w-4" /> Finish
              </>
            )}
          </Button>
        ) : (
          <Button onClick={next} disabled={!canAdvance()} className="gap-1 h-11 px-6 rounded-xl">
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </footer>
    </div>
  );
};

export default Onboarding;
