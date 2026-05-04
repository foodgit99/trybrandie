import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, Upload, X, Check, Sparkles, Globe, Loader2, Power, Zap } from "lucide-react";
import brandieLogo from "@/assets/brandie-logo.png";
import LogoDesignerDialog from "@/components/LogoDesignerDialog";
import { INDUSTRY_PLAYBOOKS, getPlaybook, type IndustryPlaybook } from "@/lib/industryPlaybooks";

type Phase = "playbook" | "boot" | "essentials" | "logo" | "palette";

type BrandData = {
  name: string;
  description: string;
  logoFile: File | null;
  logoPreview: string;
  primary: string;
  secondary: string;
  accent: string;
};

const PHASE_ORDER: Phase[] = ["playbook", "boot", "essentials", "logo", "palette"];

const Onboarding = () => {
  const [phase, setPhase] = useState<Phase>("playbook");
  const [playbookId, setPlaybookId] = useState<string>("");
  const [bootStep, setBootStep] = useState(0);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [logoDesignerOpen, setLogoDesignerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customIndustry, setCustomIndustry] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const playbook: IndustryPlaybook = getPlaybook(playbookId);

  const [data, setData] = useState<BrandData>({
    name: "",
    description: "",
    logoFile: null,
    logoPreview: "",
    primary: "#2B2D33",
    secondary: "#FAF8F5",
    accent: "#C4993B",
  });

  const update = <K extends keyof BrandData>(key: K, value: BrandData[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

  // When a playbook is chosen, seed default palette
  useEffect(() => {
    if (!playbookId) return;
    setData((prev) => ({
      ...prev,
      primary: playbook.defaultPalette.primary,
      secondary: playbook.defaultPalette.secondary,
      accent: playbook.defaultPalette.accent,
    }));
  }, [playbookId, playbook.defaultPalette.primary, playbook.defaultPalette.secondary, playbook.defaultPalette.accent]);

  // Boot sequence: 4 steps, each ~900ms
  useEffect(() => {
    if (phase !== "boot") return;
    setBootStep(0);
    const timers: number[] = [];
    [800, 1700, 2700, 3800].forEach((ms, i) => {
      timers.push(window.setTimeout(() => setBootStep(i + 1), ms));
    });
    timers.push(window.setTimeout(() => setPhase("essentials"), 4500));
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  const handleSelectPlaybook = (id: string) => {
    setPlaybookId(id);
    setPhase("boot");
  };

  const handleWebsiteScan = async () => {
    if (!websiteUrl.trim()) return;
    setScanning(true);
    setScanMessage("Scanning your website…");
    const messages = ["Scanning your website…", "Extracting colours…", "Reading your tone…", "Almost there…"];
    let i = 0;
    const interval = window.setInterval(() => {
      i = (i + 1) % messages.length;
      setScanMessage(messages[i]);
    }, 2000);
    try {
      const { data: result, error } = await supabase.functions.invoke("brand-scraper", {
        body: { url: websiteUrl.trim() },
      });
      clearInterval(interval);
      if (result?.error) throw new Error(result.error);
      if (error) throw new Error((error as any)?.context?.responseJson?.error || error.message || "Couldn't scan website");
      const brand = result?.brand;
      if (brand) {
        setData((prev) => ({
          ...prev,
          name: brand.name || prev.name,
          description: brand.description || prev.description,
          logoPreview: brand.logo_url || prev.logoPreview,
          primary: brand.primary_colors?.[0] || prev.primary,
          secondary: brand.secondary_colors?.[0] || prev.secondary,
          accent: brand.accent_colors?.[0] || prev.accent,
        }));
        toast({ title: "Got it!", description: "We've pre-filled your brand details." });
      }
    } catch (err: any) {
      clearInterval(interval);
      toast({ title: "Couldn't scan", description: err.message || "Add details manually.", variant: "destructive" });
    } finally {
      setScanning(false);
      setScanMessage("");
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    update("logoFile", file);
    update("logoPreview", URL.createObjectURL(file));
  };

  const phaseIndex = PHASE_ORDER.indexOf(phase);
  const inputPhases: Phase[] = ["essentials", "logo", "palette"];

  const goNext = () => {
    if (phase === "essentials" && !data.name.trim()) return;
    const idx = PHASE_ORDER.indexOf(phase);
    if (idx < PHASE_ORDER.length - 1) setPhase(PHASE_ORDER[idx + 1]);
  };

  const goBack = () => {
    const idx = PHASE_ORDER.indexOf(phase);
    if (phase === "essentials") {
      // Allow re-picking playbook
      setPhase("playbook");
      return;
    }
    if (idx > 0) setPhase(PHASE_ORDER[idx - 1]);
  };

  const handleFinish = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    try {
      let logoUrl: string | null = null;
      if (data.logoFile) {
        const ext = data.logoFile.name.split(".").pop();
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("brand-logos").upload(path, data.logoFile);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("brand-logos").getPublicUrl(path);
        logoUrl = urlData.publicUrl;
      } else if (data.logoPreview && data.logoPreview.startsWith("data:")) {
        const base64 = data.logoPreview.replace(/^data:image\/\w+;base64,/, "");
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "image/png" });
        const path = `${user.id}/${crypto.randomUUID()}.png`;
        const { error: uploadErr } = await supabase.storage.from("brand-logos").upload(path, blob);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("brand-logos").getPublicUrl(path);
        logoUrl = urlData.publicUrl;
      } else if (data.logoPreview && /^https?:\/\//.test(data.logoPreview)) {
        logoUrl = data.logoPreview;
      }

      const { data: brand, error: brandErr } = await supabase
        .from("brands")
        .insert({
          user_id: user.id,
          name: data.name.trim(),
          description: data.description.trim() || null,
          vibe: playbook.defaultVibe,
          primary_colors: [data.primary],
          secondary_colors: [data.secondary],
          accent_colors: [data.accent],
          typography_primary: "DM Sans",
          typography_secondary: "Playfair Display",
          logo_url: logoUrl,
          tone_of_voice: playbook.defaultTone,
          personality_traits: playbook.defaultPersonality,
          onboarding_complete: true,
          website_url: websiteUrl.trim() || null,
          playbook_id: playbook.id,
        } as any)
        .select()
        .single();
      if (brandErr) throw brandErr;

      // Seed the engine with playbook ideas — fire-and-forget so the home is ready when they land.
      supabase.functions
        .invoke("autopilot-planner", {
          body: { brand_id: (brand as any).id, playbook_id: playbook.id, seed: true },
        })
        .catch(() => {});

      // Welcome email — fire-and-forget
      supabase.functions
        .invoke("send-email", {
          body: { type: "welcome", to: user.email, data: { name: user.user_metadata?.full_name || "" } },
        })
        .catch(() => {});

      toast({ title: "Your engine is running." });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [data, user, navigate, toast, playbook, websiteUrl]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress strip — only during input phases */}
      {inputPhases.includes(phase) && (
        <div className="w-full bg-secondary h-1">
          <motion.div
            className="h-full bg-primary"
            initial={false}
            animate={{ width: `${((inputPhases.indexOf(phase) + 1) / inputPhases.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}

      <header className="px-4 sm:px-8 py-4 sm:py-6 flex items-center gap-2">
        <img src={brandieLogo} alt="Brandie" className="h-7 w-7" />
        <span className="text-lg font-serif tracking-tight">Brandie</span>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 pb-8">
        <AnimatePresence mode="wait">
          {phase === "playbook" && (
            <motion.div
              key="playbook"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-3xl space-y-8"
            >
              <div className="text-center space-y-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-secondary text-muted-foreground border border-border">
                  <Zap className="h-3 w-3" />
                  Autonomous Content System
                </span>
                <h1 className="text-3xl sm:text-4xl font-serif tracking-tight">
                  Pick the playbook your business runs on.
                </h1>
                <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
                  Brandie's engine takes it from here — generating, sequencing, and structuring a full week of on-brand content automatically.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {INDUSTRY_PLAYBOOKS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPlaybook(p.id)}
                    className="group text-left rounded-2xl border border-border bg-card hover:border-primary/40 hover:bg-secondary/50 transition-all p-5 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-2xl" aria-hidden>
                        {p.emoji}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <h3 className="text-base font-medium">{p.name}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{p.tagline}</p>
                    <p className="text-[11px] text-muted-foreground/70 italic pt-1 border-t border-border/60">
                      {p.sample}
                    </p>
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-dashed border-border bg-card/50 p-5 space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-medium">Don't see your industry?</h3>
                  <p className="text-xs text-muted-foreground">
                    Type it in and we'll build a balanced weekly cadence tailored to it.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={customIndustry}
                    onChange={(e) => setCustomIndustry(e.target.value)}
                    placeholder="e.g. Architecture firm, Pet grooming, Law practice…"
                    className="h-11 flex-1"
                    maxLength={80}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customIndustry.trim()) handleSelectPlaybook("general");
                    }}
                  />
                  <Button
                    type="button"
                    onClick={() => customIndustry.trim() && handleSelectPlaybook("general")}
                    disabled={!customIndustry.trim()}
                    className="h-11 gap-2 rounded-xl"
                  >
                    Use this
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {phase === "boot" && (
            <motion.div
              key="boot"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-md text-center space-y-8"
            >
              <motion.div
                animate={{ scale: [1, 1.05, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center"
              >
                <Power className="h-7 w-7 text-primary" />
              </motion.div>
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-serif tracking-tight">Starting your engine</h2>
                <p className="text-sm text-muted-foreground">{playbook.name}</p>
              </div>
              <div className="text-left space-y-2.5 mx-auto max-w-xs font-mono text-sm">
                {[
                  `Loading ${playbook.name} playbook`,
                  "Setting up your weekly cadence",
                  "Generating your first 7 posts",
                  "Personalising for your brand",
                ].map((label, i) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <span
                      className={`h-4 w-4 flex items-center justify-center rounded-full transition-colors ${
                        bootStep > i
                          ? "bg-primary text-primary-foreground"
                          : bootStep === i
                          ? "bg-primary/20 text-primary"
                          : "bg-secondary text-muted-foreground/40"
                      }`}
                    >
                      {bootStep > i ? <Check className="h-2.5 w-2.5" /> : bootStep === i ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : null}
                    </span>
                    <span className={bootStep > i ? "text-foreground" : "text-muted-foreground"}>{label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {phase === "essentials" && (
            <motion.div
              key="essentials"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-lg space-y-6"
            >
              <div>
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
                  Personalise · {playbook.name}
                </p>
                <h2 className="text-2xl sm:text-3xl font-serif tracking-tight">Tell us about your business.</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Drop your website and we'll fill the rest in for you. Or add the basics yourself.
                </p>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="yourwebsite.com (optional)"
                    className="pl-9 h-11"
                    disabled={scanning}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleWebsiteScan}
                  disabled={scanning || !websiteUrl.trim()}
                  className="w-full h-10 gap-2 rounded-xl"
                >
                  {scanning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {scanMessage}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Scan my website
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Brand name</label>
                  <Input
                    value={data.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="e.g. Bloom Studio"
                    className="h-11"
                    maxLength={100}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">One-line description</label>
                  <Textarea
                    value={data.description}
                    onChange={(e) => update("description", e.target.value)}
                    placeholder="What you do and who it's for."
                    className="min-h-[80px]"
                    maxLength={500}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {phase === "logo" && (
            <motion.div
              key="logo"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-lg space-y-6"
            >
              <div>
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Logo</p>
                <h2 className="text-2xl sm:text-3xl font-serif tracking-tight">Drop in your logo.</h2>
                <p className="text-muted-foreground text-sm mt-1">Optional — we can design one for you, or you can add it later.</p>
              </div>

              <div className="space-y-4">
                {data.logoPreview ? (
                  <div className="relative w-32 h-32 mx-auto">
                    <img src={data.logoPreview} alt="Logo" className="w-full h-full object-contain rounded-xl border border-border" />
                    <button
                      onClick={() => {
                        update("logoFile", null);
                        update("logoPreview", "");
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-muted-foreground/40 transition-colors">
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Click to upload your logo</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground">or</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <Button variant="outline" className="w-full gap-2" onClick={() => setLogoDesignerOpen(true)}>
                      <Sparkles className="h-4 w-4" /> Create with AI
                    </Button>
                  </>
                )}
                <LogoDesignerDialog
                  open={logoDesignerOpen}
                  onOpenChange={setLogoDesignerOpen}
                  brandId={null}
                  brandName={data.name}
                  brandContext={{
                    name: data.name,
                    tagline: "",
                    description: data.description,
                    vibe: playbook.defaultVibe,
                  }}
                  onLogoCreated={(imageData) => {
                    update("logoPreview", imageData);
                    update("logoFile", null);
                  }}
                />
              </div>
            </motion.div>
          )}

          {phase === "palette" && (
            <motion.div
              key="palette"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-lg space-y-6"
            >
              <div>
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Brand colours</p>
                <h2 className="text-2xl sm:text-3xl font-serif tracking-tight">Approve your palette.</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  We've picked sensible defaults for {playbook.name}. Adjust or keep as-is.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {(["primary", "secondary", "accent"] as const).map((field) => (
                  <div key={field} className="space-y-2">
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">{field}</label>
                    <input
                      type="color"
                      value={data[field]}
                      onChange={(e) => update(field, e.target.value)}
                      className="w-full h-20 rounded-xl border border-border cursor-pointer"
                    />
                    <span className="text-[11px] font-mono text-muted-foreground block text-center">{data[field]}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-border bg-secondary/40 p-4 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">After this, your engine starts with:</p>
                <p>• 7 ready-to-publish post ideas for this week</p>
                <p>• Tone, vibe, and personality pre-tuned for {playbook.name}</p>
                <p>• You can refine everything later in Brand Centre</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {inputPhases.includes(phase) && (
        <footer className="px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between max-w-lg mx-auto w-full">
          <Button variant="ghost" onClick={goBack} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>

          {phase === "palette" ? (
            <Button onClick={handleFinish} disabled={saving} className="gap-2 h-11 px-6 rounded-xl">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Starting…
                </>
              ) : (
                <>
                  <Power className="h-4 w-4" /> Start my engine
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={goNext}
              disabled={phase === "essentials" && !data.name.trim()}
              className="gap-1 h-11 px-6 rounded-xl"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </footer>
      )}
    </div>
  );
};

export default Onboarding;
