import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, RotateCcw, Check, Download, Upload, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const FUN_MESSAGES = [
  "Sketching your brand vision ✏️",
  "Mixing the perfect colours 🎨",
  "Consulting the creative director 🧠",
  "Polishing every pixel ✨",
  "Making it look expensive 💎",
  "Adding that special something 🪄",
  "Almost there, patience pays off 🎯",
  "Your logo is worth the wait ⏳",
  "Crafting something memorable 🏆",
  "Fine-tuning the details 🔍",
];

const LOGO_STYLES = [
  { id: "wordmark", label: "Wordmark" },
  { id: "lettermark", label: "Lettermark" },
  { id: "icon-text", label: "Icon + Text" },
  { id: "abstract", label: "Abstract Symbol" },
  { id: "mascot", label: "Mascot" },
] as const;

const VISUAL_FEELS = [
  "Minimal", "Bold", "Luxury", "Playful", "Corporate", "Cinematic",
] as const;

interface LogoDesignerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string | null;
  brandName?: string;
  /** Pass brand context directly (for onboarding when brand doesn't exist yet) */
  brandContext?: {
    name?: string;
    tagline?: string;
    description?: string;
    vibe?: string;
    primary_colors?: string[];
    secondary_colors?: string[];
    accent_colors?: string[];
  };
  onLogoCreated: (logoUrl: string) => void;
}

function GeneratingState() {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % FUN_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-10 space-y-6">
      {/* Pulsing skeleton logo placeholder */}
      <div className="relative">
        <Skeleton className="w-28 h-28 rounded-2xl" />
        <motion.div
          className="absolute inset-0 rounded-2xl border-2 border-primary/30"
          animate={{ scale: [1, 1.08, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="h-6 w-6 text-primary/60" />
        </motion.div>
      </div>

      {/* Rotating fun messages */}
      <div className="h-6 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="text-sm text-muted-foreground text-center"
          >
            {FUN_MESSAGES[msgIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <div className="w-48 h-1 rounded-full bg-secondary overflow-hidden">
        <motion.div
          className="h-full bg-primary/50 rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: "90%" }}
          transition={{ duration: 18, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export default function LogoDesignerDialog({
  open,
  onOpenChange,
  brandId,
  brandName,
  brandContext,
  onLogoCreated,
}: LogoDesignerDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [style, setStyle] = useState<string>("wordmark");
  const [feel, setFeel] = useState<string>("Minimal");
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [logoGenUsed, setLogoGenUsed] = useState<number | null>(null);

  const [sketch, setSketch] = useState<string | null>(null);
  const [sketchName, setSketchName] = useState<string>("");
  const [brandPalette, setBrandPalette] = useState<string[]>([]);

  const paletteColors = brandId
    ? brandPalette
    : [
        ...(brandContext?.primary_colors || []),
        ...(brandContext?.secondary_colors || []),
        ...(brandContext?.accent_colors || []),
      ].filter(Boolean);

  useEffect(() => {
    if (!open || !user) return;
    supabase
      .from("profiles")
      .select("logo_generations_used")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setLogoGenUsed(data?.logo_generations_used ?? 0);
      });
  }, [open, user]);

  useEffect(() => {
    if (!open || !brandId) return;
    supabase
      .from("brands")
      .select("primary_colors, secondary_colors, accent_colors")
      .eq("id", brandId)
      .maybeSingle()
      .then(({ data }) => {
        setBrandPalette(
          [
            ...(data?.primary_colors || []),
            ...(data?.secondary_colors || []),
            ...(data?.accent_colors || []),
          ].filter(Boolean) as string[],
        );
      });
  }, [open, brandId]);


  const handleSketchSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Unsupported file", description: "Please upload a PNG or JPG image.", variant: "destructive" });
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Please upload a sketch under 6MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSketch(String(reader.result));
      setSketchName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!brandId && !brandContext) {
      toast({ title: "No brand info", description: "Please add your brand name first.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setGeneratedImage(null);
    try {
      const body: Record<string, unknown> = { style, visual_feel: feel, notes };
      if (sketch) body.sketch_image = sketch;
      if (brandId) {
        body.brand_id = brandId;
      } else {
        body.brand_context = brandContext;
      }
      const { data, error } = await supabase.functions.invoke("logo-designer", { body });
      if (error) throw error;
      if (data?.error) {
        if (data.error.includes("Rate limit")) {
          toast({ title: "Too many requests", description: "Please wait a moment and try again.", variant: "destructive" });
        } else if (data.error.includes("No credits") || data.error.includes("Payment")) {
          toast({ title: "No credits", description: data.error, variant: "destructive" });
        } else {
          throw new Error(data.error);
        }
        return;
      }
      if (!data?.image) throw new Error("No image returned");
      setGeneratedImage(data.image);
      // Update local credit state
      setLogoGenUsed((prev) => (prev ?? 0) + 1);
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message || "Please try again.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };


  const handleUseLogo = async () => {
    if (!generatedImage) return;
    setSaving(true);
    try {
      if (brandId) {
        // Brand exists, upload to storage and update DB
        const base64 = generatedImage.replace(/^data:image\/\w+;base64,/, "");
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "image/png" });

        const filePath = `${user!.id}/${brandId}-logo-${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage
          .from("brand-logos")
          .upload(filePath, blob, { upsert: true });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("brand-logos").getPublicUrl(filePath);
        const logoUrl = urlData.publicUrl;

        const { error: updateError } = await supabase
          .from("brands")
          .update({ logo_url: logoUrl })
          .eq("id", brandId);
        if (updateError) throw updateError;

        onLogoCreated(logoUrl);
        toast({ title: "Logo saved!", description: "Your new logo is live." });
      } else {
        // Onboarding mode, pass base64 back to parent
        onLogoCreated(generatedImage);
        toast({ title: "Logo ready!", description: "Your logo will be saved with your brand." });
      }
      handleClose();
    } catch (e: any) {
      toast({ title: "Failed to save logo", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setGeneratedImage(null);
    setStyle("wordmark");
    setFeel("Minimal");
    setNotes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Create a Logo with AI</DialogTitle>
          <DialogDescription>
            {brandName ? `Designing for ${brandName}` : "We'll use your brand details to generate a logo."}
          </DialogDescription>
        </DialogHeader>

        {generating ? (
          <GeneratingState />
        ) : !generatedImage ? (
          <div className="space-y-5 pt-2">
            {/* Logo Style */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Logo Style</label>
              <div className="flex flex-wrap gap-2">
                {LOGO_STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStyle(s.id)}
                    className={`px-3 py-1.5 rounded-xl text-sm border transition-all ${
                      style === s.id
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-border hover:border-muted-foreground/40 text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Feel */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Visual Feel</label>
              <div className="flex flex-wrap gap-2">
                {VISUAL_FEELS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFeel(f)}
                    className={`px-3 py-1.5 rounded-xl text-sm border transition-all ${
                      feel === f
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-border hover:border-muted-foreground/40 text-muted-foreground"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Sketch upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Sketch or reference <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              {sketch ? (
                <div className="flex items-center gap-3 rounded-xl border border-border p-2">
                  <img src={sketch} alt="Uploaded sketch" className="h-14 w-14 rounded-lg object-contain bg-secondary/40" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs truncate">{sketchName || "sketch.png"}</p>
                    <p className="text-[11px] text-muted-foreground">Brandie will follow this closely.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSketch(null); setSketchName(""); }}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground"
                    aria-label="Remove sketch"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 h-20 rounded-xl border-2 border-dashed border-border hover:border-foreground/40 transition-colors cursor-pointer text-sm text-muted-foreground">
                  <Upload className="h-4 w-4" />
                  Upload a sketch of your idea
                  <input type="file" accept="image/*" className="hidden" onChange={handleSketchSelect} />
                </label>
              )}
            </div>

            {/* Brand colours in play */}
            {paletteColors.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Brand colours in play</label>
                <div className="flex items-center gap-2">
                  {paletteColors.map((c) => (
                    <span
                      key={c}
                      className="h-7 w-7 rounded-full border border-border"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                  <span className="text-xs text-muted-foreground">Pulled from your brand palette.</span>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Additional Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Use earthy tones, include a leaf icon..."
                maxLength={200}
              />
            </div>


            {logoGenUsed !== null && logoGenUsed > 0 && (
              <p className="text-xs text-muted-foreground text-center">This will use 1 credit from your balance.</p>
            )}
            {logoGenUsed === 0 && (
              <p className="text-xs text-muted-foreground text-center">✨ Your first logo generation is free!</p>
            )}

            <Button onClick={handleGenerate} className="w-full gap-2">
              <Sparkles className="h-4 w-4" />
              Generate Logo
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="relative rounded-xl border border-border bg-secondary/30 p-4 flex items-center justify-center">
              <button
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = generatedImage!;
                  a.download = "logo.png";
                  a.click();
                }}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 backdrop-blur-sm border border-border text-muted-foreground hover:text-foreground transition-colors"
                title="Download logo"
              >
                <Download className="h-4 w-4" />
              </button>
              <img
                src={generatedImage}
                alt="Generated logo"
                className="max-h-48 object-contain"
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">Trying again will use 1 credit.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setGeneratedImage(null); handleGenerate(); }} disabled={generating} className="flex-1 gap-1">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Try Again
              </Button>
              <Button onClick={handleUseLogo} disabled={saving} className="flex-1 gap-1">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Use This Logo
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
