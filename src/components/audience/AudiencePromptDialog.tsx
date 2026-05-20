import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, Sparkles, ArrowRight, Target, MessageSquareQuote, TrendingUp } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { buildAudienceCopy } from "@/lib/audiencePromptCopy";

type BrandLike = Parameters<typeof buildAudienceCopy>[0];

interface AudiencePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand: BrandLike;
  onLater: () => void;
  onNever: () => void;
  onAccept: () => void;
}

const icons = [Target, MessageSquareQuote, TrendingUp];

const AudiencePromptDialog = ({
  open,
  onOpenChange,
  brand,
  onLater,
  onNever,
  onAccept,
}: AudiencePromptDialogProps) => {
  const navigate = useNavigate();
  const copy = buildAudienceCopy(brand);

  const handleAccept = () => {
    onAccept();
    navigate("/brand?section=audience&startAudience=1#audience");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0 gap-0 border-border/60">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-t-lg bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 pt-7 pb-5">
          <div className="absolute -top-6 -right-6 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="relative h-12 w-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-primary" />
              <motion.span
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 220 }}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center shadow-sm"
              >
                <Sparkles className="h-3 w-3" />
              </motion.span>
            </div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-primary/80 font-medium">
              Audience Intelligence
            </p>
          </div>
          <h2 className="relative mt-4 text-xl sm:text-2xl font-semibold leading-tight text-foreground">
            {copy.heading}
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {copy.subheading}
          </p>

          <div className="grid gap-3">
            {copy.bullets.map((b, i) => {
              const Icon = icons[i] ?? Target;
              return (
                <div key={b.title} className="flex gap-3 rounded-lg border border-border/50 bg-muted/30 p-3">
                  <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{b.title}</p>
                    <p className="text-xs text-muted-foreground leading-snug mt-0.5">{b.body}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 pt-1">
            <Button
              size="lg"
              className="flex-1 gap-2 rounded-lg"
              onClick={handleAccept}
            >
              Create my audience profile
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="sm:w-auto rounded-lg text-muted-foreground"
              onClick={onLater}
            >
              Maybe later
            </Button>
          </div>

          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={onNever}
              className="text-[11px] text-muted-foreground/70 hover:text-muted-foreground underline-offset-4 hover:underline"
            >
              Don't show this again
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AudiencePromptDialog;
