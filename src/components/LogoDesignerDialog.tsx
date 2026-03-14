import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, RotateCcw, Check } from "lucide-react";

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
  brandContext?: { name?: string; tagline?: string; description?: string; vibe?: string };
  onLogoCreated: (logoUrl: string) => void;
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
  const [style, setStyle] = useState<string>("wordmark");
  const [feel, setFeel] = useState<string>("Minimal");
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleGenerate = async () => {
    if (!brandId && !brandContext) {
      toast({ title: "No brand info", description: "Please add your brand name first.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setGeneratedImage(null);
    try {
      const body: Record<string, unknown> = { style, visual_feel: feel, notes };
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
        } else if (data.error.includes("Payment")) {
          toast({ title: "Credits required", description: "Please top up your workspace credits.", variant: "destructive" });
        } else {
          throw new Error(data.error);
        }
        return;
      }
      if (!data?.image) throw new Error("No image returned");
      setGeneratedImage(data.image);
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
        // Brand exists — upload to storage and update DB
        const base64 = generatedImage.replace(/^data:image\/\w+;base64,/, "");
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "image/png" });

        const filePath = `${brandId}/logo-${Date.now()}.png`;
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
        // Onboarding mode — pass base64 back to parent
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

        {!generatedImage ? (
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

            <Button onClick={handleGenerate} disabled={generating} className="w-full gap-2">
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating your logo...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Logo
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="rounded-xl border border-border bg-secondary/30 p-4 flex items-center justify-center">
              <img
                src={generatedImage}
                alt="Generated logo"
                className="max-h-48 object-contain"
              />
            </div>
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
