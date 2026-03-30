import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import heroDesigns from "@/assets/landing-hero-designs.png";
import HeroChatInput from "@/components/HeroChatInput";

const LandingHero = () => (
  <section className="relative overflow-hidden">
    <div className="max-w-4xl mx-auto px-4 sm:px-8 pt-16 sm:pt-24 pb-12 text-center space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-secondary text-muted-foreground border border-border">
          <Sparkles className="h-3 w-3" />
          AI-Powered Brand Studio
        </span>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="text-4xl sm:text-5xl md:text-6xl font-serif tracking-tight leading-[1.1]"
      >
        Your AI creative director.
        <br />
        <span className="text-muted-foreground">Always on brand.</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-base sm:text-lg text-muted-foreground max-w-lg mx-auto"
      >
        Describe what you need. Brandie generates stunning, brand-consistent social media graphics in seconds — powered by audience intelligence and design trends.
      </motion.p>

      <HeroChatInput />
    </div>

    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.5 }}
      className="max-w-5xl mx-auto px-4 sm:px-8 pb-16"
    >
      <img
        src={heroDesigns}
        alt="Brandie AI Design Studio — chat-driven social media graphic generation"
        className="w-full rounded-2xl border border-border shadow-2xl"
        width={1920}
        height={1080}
      />
    </motion.div>
  </section>
);

export default LandingHero;
