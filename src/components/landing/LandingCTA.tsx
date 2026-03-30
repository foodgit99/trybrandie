import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

const LandingCTA = () => {
  const navigate = useNavigate();

  return (
    <section className="border-t border-border bg-secondary/30">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-20 sm:py-28 text-center space-y-6">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-3xl sm:text-4xl font-serif tracking-tight"
        >
          Ready to meet your AI creative director?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-muted-foreground"
        >
          Start free. 10 credits per month. No credit card required.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Button size="lg" className="h-12 px-8 rounded-xl gap-2" onClick={() => navigate("/auth?mode=signup")}>
            <Zap className="h-4 w-4" />
            Get started for free
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default LandingCTA;
