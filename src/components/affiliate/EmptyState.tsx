import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

const EmptyState = ({ icon: Icon, title, description, ctaLabel, onCta }: EmptyStateProps) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center text-center gap-3 py-10 px-4"
  >
    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
      <Icon className="h-5 w-5 text-primary" />
    </div>
    <div className="space-y-1">
      <p className="font-medium">{title}</p>
      {description && <p className="text-xs text-muted-foreground max-w-xs">{description}</p>}
    </div>
    {ctaLabel && onCta && (
      <Button variant="outline" size="sm" className="rounded-xl mt-1" onClick={onCta}>
        {ctaLabel}
      </Button>
    )}
  </motion.div>
);

export default EmptyState;
