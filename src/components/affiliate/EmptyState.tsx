import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { EmptyState as BaseEmptyState } from "@/components/ui/empty-state";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

const EmptyState = ({ icon, title, description, ctaLabel, onCta }: EmptyStateProps) => (
  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
    <BaseEmptyState
      icon={icon}
      title={title}
      description={description}
      ctaLabel={ctaLabel}
      onCta={onCta}
      className="py-10"
    />
  </motion.div>
);

export default EmptyState;
