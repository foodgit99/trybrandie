import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ColorPickerField from "@/components/ui/color-picker-field";

import {
  ArrowLeft,
  ArrowRight,
  Globe,
  Loader2,
  Sparkles,
  Upload,
  X,
  Check,
  Power,
  Plus,
  Trash2,
} from "lucide-react";
import LogoDesignerDialog from "@/components/LogoDesignerDialog";
import { INDUSTRY_PLAYBOOKS, getPlaybook } from "@/lib/industryPlaybooks";
import brandieLogo from "@/assets/brandie-logo.png";
import SEO from "@/components/SEO";
import { gaEvent } from "@/lib/ga";

type Step = 0 | 1 | 2 | 3;

const STEPS = [
  { key: "brand", label: "Brand" },
  { key: "look", label: "Look & feel" },
  { key: "audience", label: "Audience" },
  { key: "offer", label: "What you sell" },
];

type ProductDraft = { label: string; description: string; price: string };

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>(0);
  const [saving, setSaving] = useState(false);

  // step 0, Brand
  const [playbookId, setPlaybookId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  const [scanSucceeded, setScanSucceeded] = useState(false);
  const playbook = getPlaybook(playbookId || "general");
  const detailsRef = useRef<HTMLDivElement>(null);

  // step 1, Look & feel
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoDesignerOpen, setLogoDesignerOpen] = useState(false);
  const [primary, setPrimary] = useState("#2B2D33");
  const [secondary, setSecondary] = useState("#FAF8F5");
  const [accent, setAccent] = useState("#C4993B");

  // step 2, Audience JTBD
  const [audienceWho, setAudienceWho] = useState("");
  const [audienceStruggle, setAudienceStruggle] = useState("");
  const [audienceOutcome, setAudienceOutcome] = useState("");
  const [audienceTrigger, setAudienceTrigger] = useState("");
  type AudienceKey = "who" | "struggle" | "outcome" | "trigger";
  type FieldSource = "ai_suggested" | "user_edited" | "user_written";
  const [audienceSources, setAudienceSources] = useState<Record<AudienceKey, FieldSource>>({
    who: "user_written",
    struggle: "user_written",
    outcome: "user_written",
    trigger: "user_written",
  });
  const [suggestingAudience, setSuggestingAudience] = useState(false);
  const [audienceConfidence, setAudienceConfidence] = useState<Partial<Record<AudienceKey, number>>>({});

  const setAudienceField = (key: AudienceKey, value: string) => {
    const setter = { who: setAudienceWho, struggle: setAudienceStruggle, outcome: setAudienceOutcome, trigger: setAudienceTrigger }[key];
    setter(value);
    setAudienceSources((prev) => {
      const wasAi = prev[key] === "ai_suggested";
      return { ...prev, [key]: wasAi ? "user_edited" : prev[key] === "user_edited" ? "user_edited" : "user_written" };
    });
  };

  const handleSuggestAudience = async () => {
    if (suggestingAudience) return;
    setSuggestingAudience(true);
    const startedAt = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke("audience-suggest", {
        body: {
          brand: {
            name: name.trim(),
            description: description.trim(),
            playbook_id: playbook.id,
            vibe: playbook.defaultVibe,
            tone_of_voice: playbook.defaultTone,
            personality_traits: playbook.defaultPersonality,
            website_url: websiteUrl.trim(),
            products: products
              .filter((p) => p.label.trim())
              .map((p) => ({ label: p.label, description: p.description, price: p.price })),
          },
        },
      });
      if (error) throw error;
      const s = data?.suggestion;
      if (!s) throw new Error("No suggestion returned");

      const apply = (key: AudienceKey, value: string, current: string, setter: (v: string) => void) => {
        const canOverwrite =
          !current.trim() || audienceSources[key] === "ai_suggested";
        if (canOverwrite && value) {
          setter(value);
          setAudienceSources((prev) => ({ ...prev, [key]: "ai_suggested" }));
        }
      };
      apply("who", s.who, audienceWho, setAudienceWho);
      apply("struggle", s.struggle, audienceStruggle, setAudienceStruggle);
      apply("outcome", s.outcome, audienceOutcome, setAudienceOutcome);
      apply("trigger", s.trigger, audienceTrigger, setAudienceTrigger);
      setAudienceConfidence(data?.confidence ?? {});
      const ms = Math.round(performance.now() - startedAt);
      toast({ title: "Draft ready", description: `Brandie filled in a starting point in ${(ms / 1000).toFixed(1)}s. Edit anything that doesn't match your real customers.` });
    } catch (err: any) {
      const status = err?.context?.status ?? err?.status;
      const msg = status === 402
        ? "AI credits exhausted. Add credits to keep using Brandie."
        : status === 429
          ? "Too many requests. Try again in a moment."
          : err?.message || "Couldn't draft an audience. Try again.";
      toast({ title: "Couldn't suggest", description: msg, variant: "destructive" });
    } finally {
      setSuggestingAudience(false);
    }
  };

  // step 3, Offer
  const [products, setProducts] = useState<ProductDraft[]>([
    { label: "", description: "", price: "" },
  ]);

  // Auth gate
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth?next=/onboarding", { replace: true });
    }
  }, [authLoading, user, navigate]);

  // Default palette from playbook
  useEffect(() => {
    if (!playbookId) return;
    setPrimary(playbook.defaultPalette.primary);
    setSecondary(playbook.defaultPalette.secondary);
    setAccent(playbook.defaultPalette.accent);
  }, [playbookId, playbook.defaultPalette.primary, playbook.defaultPalette.secondary, playbook.defaultPalette.accent]);

  const handleScan = async () => {
    if (!websiteUrl.trim()) return;
    setScanning(true);
    const msgs = ["Reading your site…", "Pulling your colours…", "Lifting your tone…", "Almost there…"];
    let i = 0;
    setScanMsg(msgs[0]);
    const interval = window.setInterval(() => {
      i = (i + 1) % msgs.length;
      setScanMsg(msgs[i]);
    }, 1800);
    try {
      const { data, error } = await supabase.functions.invoke("brand-scraper", {
        body: { url: websiteUrl.trim() },
      });
      if (error) throw error;
      const b = data?.brand;
      if (b) {
        if (b.name && !name) setName(b.name);
        if (b.description && !description) setDescription(b.description);
        if (b.logo_url) setLogoPreview(b.logo_url);
        if (b.primary_colors?.[0]) setPrimary(b.primary_colors[0]);
        if (b.secondary_colors?.[0]) setSecondary(b.secondary_colors[0]);
        if (b.accent_colors?.[0]) setAccent(b.accent_colors[0]);
        setScanSucceeded(true);
        toast({ title: "Got it.", description: "Pre-filled what we could from your site." });
      }
    } catch (err: any) {
      toast({ title: "Couldn't scan", description: err?.message || "Add details manually.", variant: "destructive" });
    } finally {
      clearInterval(interval);
      setScanning(false);
      setScanMsg("");
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const canNext = useCallback(() => {
    if (step === 0) return !!playbookId && name.trim().length > 1;
    if (step === 1) return true;
    if (step === 2) return audienceWho.trim().length > 1;
    if (step === 3) return true;
    return false;
  }, [step, playbookId, name, audienceWho]);

  const uploadLogo = async (userId: string): Promise<string | null> => {
    if (logoFile) {
      const ext = logoFile.name.split(".").pop();
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("brand-logos").upload(path, logoFile);
      if (error) throw error;
      return supabase.storage.from("brand-logos").getPublicUrl(path).data.publicUrl;
    }
    if (logoPreview && logoPreview.startsWith("data:")) {
      const base64 = logoPreview.replace(/^data:image\/\w+;base64,/, "");
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "image/png" });
      const path = `${userId}/${crypto.randomUUID()}.png`;
      const { error } = await supabase.storage.from("brand-logos").upload(path, blob);
      if (error) throw error;
      return supabase.storage.from("brand-logos").getPublicUrl(path).data.publicUrl;
    }
    if (logoPreview && /^https?:\/\//.test(logoPreview)) return logoPreview;
    return null;
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const logoUrl = await uploadLogo(user.id);

      const { data: brand, error: brandErr } = await supabase
        .from("brands")
        .insert({
          user_id: user.id,
          name: name.trim(),
          description: description.trim() || null,
          vibe: playbook.defaultVibe,
          primary_colors: [primary],
          secondary_colors: [secondary],
          accent_colors: [accent],
          typography_primary: "DM Sans",
          typography_secondary: "Instrument Serif",
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
      const brandId = (brand as any).id as string;

      // Audience JTBD
      if (audienceWho.trim()) {
        await supabase.from("target_audiences").insert({
          brand_id: brandId,
          label: audienceWho.trim().slice(0, 80),
          jtbd_profile: {
            who: audienceWho.trim(),
            struggle: audienceStruggle.trim(),
            desired_outcome: audienceOutcome.trim(),
            buying_trigger: audienceTrigger.trim(),
          },
          raw_inputs: {
            source: "v2_onboarding",
            who: audienceWho.trim(),
            struggle: audienceStruggle.trim(),
            outcome: audienceOutcome.trim(),
            trigger: audienceTrigger.trim(),
            field_sources: audienceSources,
            ai_confidence: audienceConfidence,
          },
        } as any);
      }

      // Products (only non-empty)
      const validProducts = products.filter((p) => p.label.trim());
      if (validProducts.length) {
        await supabase.from("brand_products").insert(
          validProducts.map((p) => ({
            brand_id: brandId,
            label: p.label.trim(),
            description: p.description.trim(),
            price: p.price.trim(),
            image_url: "",
          })) as any,
        );
      }

      // Opt this user into the v2 experience so '/' lands them on the cockpit.
      await supabase
        .from("profiles")
        .update({ v2_enabled: true })
        .eq("user_id", user.id);

      // Fire-and-forget: seed the engine
      supabase.functions
        .invoke("autopilot-planner", {
          body: { brand_id: brandId, playbook_id: playbook.id, seed: true },
        })
        .catch(() => {});

      // Welcome email
      supabase.functions
        .invoke("send-email", {
          body: { type: "welcome", to: user.email, data: { name: user.user_metadata?.full_name || "" } },
        })
        .catch(() => {});

      gaEvent("onboarding_complete", { playbook_id: playbook.id, has_website: !!websiteUrl.trim() });
      toast({ title: "Your engine is starting." });
      navigate("/cockpit");
    } catch (err: any) {
      toast({ title: "Couldn't finish", description: err?.message || "Try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (!canNext()) return;
    if (step < 3) setStep((s) => (s + 1) as Step);
    else handleFinish();
  };
  const back = () => {
    if (step > 0) setStep((s) => (s - 1) as Step);
  };

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <SEO title="Set up, Brandie" description="Four steps to your autonomous engine." path="/onboarding" noindex />

      {/* Header + step indicator */}
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={brandieLogo} alt="Brandie" className="h-7 w-7" />
            <span className="font-serif text-xl tracking-tight">Brandie</span>
          </div>
          <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground">
            Step {step + 1} / 4
          </p>
        </div>
        <div className="max-w-3xl mx-auto px-5 sm:px-8 pb-3">
          <div className="grid grid-cols-4 gap-2">
            {STEPS.map((s, i) => (
              <div key={s.key} className="space-y-1.5">
                <div
                  className={`h-1 rounded-full transition-colors ${
                    i <= step ? "bg-foreground" : "bg-border"
                  }`}
                />
                <p
                  className={`text-[11px] tracking-wider uppercase transition-colors ${
                    i === step ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-8 py-10 sm:py-16">
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            {/* ===== STEP 0: BRAND ===== */}
            {step === 0 && (
              <motion.div
                key="brand"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="space-y-10"
              >
                <div>
                  <h1 className="font-serif text-4xl sm:text-5xl tracking-tight">
                    What does your business <em>do?</em>
                  </h1>
                  <p className="text-muted-foreground mt-3">
                    Pick the closest playbook. We use it to seed your weekly cadence.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {INDUSTRY_PLAYBOOKS.map((p) => {
                    const active = p.id === playbookId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPlaybookId(p.id);
                          requestAnimationFrame(() => {
                            detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                          });
                        }}
                        className={`text-left p-3 rounded-xl border transition-all ${
                          active
                            ? "border-foreground bg-foreground text-background"
                            : "border-border hover:border-foreground/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-lg">{p.emoji}</span>
                          {active && <Check className="h-3.5 w-3.5" />}
                        </div>
                        <p className="text-sm font-medium mt-1.5">{p.name}</p>
                      </button>
                    );
                  })}
                </div>

                <div ref={detailsRef} className="space-y-5 scroll-mt-6">
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Brand name</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Bloom Studio"
                      className="h-12 text-base"
                      maxLength={100}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-1.5">
                      Have a website? <span className="text-muted-foreground font-normal">(we'll pre-fill the rest)</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={websiteUrl}
                          onChange={(e) => setWebsiteUrl(e.target.value)}
                          placeholder="yourstore.com"
                          className="pl-9 h-12"
                          disabled={scanning}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleScan}
                        disabled={scanning || !websiteUrl.trim()}
                        className="h-12 px-4 rounded-md gap-2 shrink-0"
                      >
                        {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {scanning ? "Scanning" : "Scan"}
                      </Button>
                    </div>
                    {scanning && <p className="text-xs text-muted-foreground mt-2">{scanMsg}</p>}
                    {scanSucceeded && !scanning && (
                      <div className="mt-3 rounded-xl border border-foreground/10 bg-secondary/40 p-3 space-y-2">
                        <Button
                          type="button"
                          onClick={handleFinish}
                          disabled={saving || !playbookId || name.trim().length < 2}
                          className="w-full h-11 rounded-md gap-2"
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                          Finish with website data
                        </Button>
                        <p className="text-xs text-muted-foreground text-center">
                          We'll use what we pulled from your site. You can refine everything later in Brand Centre.
                        </p>
                      </div>
                    )}
                  </div>


                  <div>
                    <label className="text-sm font-medium block mb-1.5">In one line, what do you sell?</label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Handmade leather bags for working professionals."
                      className="min-h-[80px]"
                      maxLength={500}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* ===== STEP 1: LOOK & FEEL ===== */}
            {step === 1 && (
              <motion.div
                key="look"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="space-y-10"
              >
                <div>
                  <h1 className="font-serif text-4xl sm:text-5xl tracking-tight">
                    What does your brand <em>look like?</em>
                  </h1>
                  <p className="text-muted-foreground mt-3">
                    Pick your three colours first, then your logo. Brandie factors your palette into every logo it designs.
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Colours</p>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Tap a swatch to open the picker, drag to fine-tune, or paste a hex code.
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      ["Primary", primary, setPrimary],
                      ["Surface", secondary, setSecondary],
                      ["Accent", accent, setAccent],
                    ] as const).map(([label, value, setter]) => (
                      <ColorPickerField
                        key={label}
                        label={label}
                        value={value}
                        onChange={setter}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Logo</p>
                  {logoPreview ? (
                    <div className="flex items-center gap-4">
                      <div className="relative h-28 w-28 rounded-xl border border-border bg-card p-3">
                        <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />
                        <button
                          type="button"
                          onClick={() => {
                            setLogoFile(null);
                            setLogoPreview("");
                          }}
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground grid place-items-center"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setLogoDesignerOpen(true)}>
                        Or design a new one
                      </Button>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <label className="flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-border hover:border-foreground/40 transition-colors cursor-pointer">
                        <Upload className="h-5 w-5 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">Upload your logo</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                      </label>
                      <button
                        type="button"
                        onClick={() => setLogoDesignerOpen(true)}
                        className="flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-border hover:border-foreground/40 transition-colors"
                      >
                        <Sparkles className="h-5 w-5 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">Design with AI</span>
                      </button>
                    </div>
                  )}
                  <LogoDesignerDialog
                    open={logoDesignerOpen}
                    onOpenChange={setLogoDesignerOpen}
                    brandId={null}
                    brandName={name}
                    brandContext={{
                      name,
                      tagline: "",
                      description,
                      vibe: playbook.defaultVibe,
                      primary_colors: [primary],
                      secondary_colors: [secondary],
                      accent_colors: [accent],
                    }}
                    onLogoCreated={(imageData) => {
                      setLogoPreview(imageData);
                      setLogoFile(null);
                    }}
                  />
                </div>



                <div className="rounded-2xl border border-border bg-secondary/40 p-5">
                  <p className="font-serif text-2xl" style={{ color: primary, background: secondary, padding: "0.5rem 0.75rem", borderRadius: "0.5rem" }}>
                    {name || "Your brand"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-3">
                    Live preview, Brandie locks these into every post.
                  </p>
                </div>
              </motion.div>
            )}

            {/* ===== STEP 2: AUDIENCE ===== */}
            {step === 2 && (
              <motion.div
                key="audience"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="space-y-10"
              >
                <div>
                  <h1 className="font-serif text-4xl sm:text-5xl tracking-tight">
                    Who is the post <em>actually for?</em>
                  </h1>
                  <p className="text-muted-foreground mt-3">
                    Be specific. The sharper this is, the more your content converts.
                  </p>
                </div>

                <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-sm">Not sure where to start?</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Brandie can draft a starting point from your brand. Edit anything that doesn't match your real customers.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleSuggestAudience}
                    disabled={suggestingAudience || !name.trim()}
                    className="w-full sm:w-auto"
                  >
                    {suggestingAudience ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Drafting…</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" />Suggest with Brandie</>
                    )}
                  </Button>
                </div>

                <div className="space-y-5">
                  <Field
                    label="Who are they?"
                    hint="One sentence. Age, role, vibe."
                    value={audienceWho}
                    onChange={(v) => setAudienceField("who", v)}
                    placeholder="e.g. 28-40 working women in Lagos who care about craftsmanship."
                    source={audienceSources.who}
                  />
                  <Field
                    label="What are they struggling with?"
                    hint="The pain that makes them open their phone at midnight. Worth double-checking — this drives every caption."
                    value={audienceStruggle}
                    onChange={(v) => setAudienceField("struggle", v)}
                    placeholder="e.g. Can't find a bag that's elegant for work and big enough for a laptop."
                    source={audienceSources.struggle}
                  />
                  <Field
                    label="What outcome do they want?"
                    hint="The version of life they're paying for."
                    value={audienceOutcome}
                    onChange={(v) => setAudienceField("outcome", v)}
                    placeholder="e.g. To walk into the boardroom and feel quietly powerful."
                    source={audienceSources.outcome}
                  />
                  <Field
                    label="What makes them finally buy?"
                    hint="The trigger event or moment of decision."
                    value={audienceTrigger}
                    onChange={(v) => setAudienceField("trigger", v)}
                    placeholder="e.g. A promotion. A new role. End-of-month bonus."
                    source={audienceSources.trigger}
                  />
                </div>

              </motion.div>
            )}

            {/* ===== STEP 3: OFFER ===== */}
            {step === 3 && (
              <motion.div
                key="offer"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="space-y-10"
              >
                <div>
                  <h1 className="font-serif text-4xl sm:text-5xl tracking-tight">
                    What do you <em>sell?</em>
                  </h1>
                  <p className="text-muted-foreground mt-3">
                    Add up to a few flagship products or services. Optional, you can add more in Brand Centre.
                  </p>
                </div>

                <div className="space-y-4">
                  {products.map((p, idx) => (
                    <div key={idx} className="rounded-2xl border border-border p-4 space-y-3 relative">
                      {products.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setProducts(products.filter((_, i) => i !== idx))}
                          className="absolute top-3 right-3 text-muted-foreground hover:text-destructive"
                          aria-label="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      <Input
                        value={p.label}
                        onChange={(e) => {
                          const copy = [...products];
                          copy[idx] = { ...copy[idx], label: e.target.value };
                          setProducts(copy);
                        }}
                        placeholder="Name (e.g. Signature Tote)"
                        className="h-11 font-medium"
                        maxLength={120}
                      />
                      <Textarea
                        value={p.description}
                        onChange={(e) => {
                          const copy = [...products];
                          copy[idx] = { ...copy[idx], description: e.target.value };
                          setProducts(copy);
                        }}
                        placeholder="One line, what it is and who it's for."
                        className="min-h-[60px]"
                        maxLength={500}
                      />
                      <Input
                        value={p.price}
                        onChange={(e) => {
                          const copy = [...products];
                          copy[idx] = { ...copy[idx], price: e.target.value };
                          setProducts(copy);
                        }}
                        placeholder="Price (e.g. ₦85,000)"
                        className="h-11"
                        maxLength={60}
                      />
                    </div>
                  ))}

                  {products.length < 5 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setProducts([...products, { label: "", description: "", price: "" }])}
                      className="w-full h-11 gap-2 rounded-xl border-dashed"
                    >
                      <Plus className="h-4 w-4" /> Add another
                    </Button>
                  )}
                </div>

                <div className="rounded-2xl border border-border bg-secondary/40 p-5 text-sm">
                  <p className="font-medium mb-1">After this:</p>
                  <ul className="text-muted-foreground space-y-1">
                    <li>• Brandie generates your first 5-day Strategic Arc</li>
                    <li>• Pre-tuned to {playbook.name} cadence and your audience</li>
                    <li>• You'll review and approve it from the Cockpit</li>
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="border-t border-border bg-background sticky bottom-0">
        <div className="max-w-2xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={back}
            disabled={step === 0 || saving}
            className="gap-1 text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button
            onClick={next}
            disabled={!canNext() || saving}
            className="gap-2 h-11 px-6 rounded-full"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Starting…
              </>
            ) : step === 3 ? (
              <>
                <Power className="h-4 w-4" /> Start my engine
              </>
            ) : (
              <>
                Continue <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
};

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  source,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  source?: "ai_suggested" | "user_edited" | "user_written";
}) {
  const isAi = source === "ai_suggested";
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="text-sm font-medium">{label}</label>
        {isAi && (
          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
            AI draft
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground mb-2">{hint}</p>}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`min-h-[72px] ${isAi ? "bg-amber-50/60 border-amber-200 focus-visible:ring-amber-300 dark:bg-amber-950/20 dark:border-amber-900/40" : ""}`}
        maxLength={500}
      />
    </div>
  );
}


export default Onboarding;
