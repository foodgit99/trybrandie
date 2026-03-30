import { motion } from "framer-motion";
import { Palette, Target, TrendingUp, MessageSquare, Layers, Brain } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: "easeOut" as const },
  }),
};

const features = [
  {
    icon: Palette,
    title: "Brand Centre",
    description: "Store your colours, typography, logo, tone of voice, and personality. Every design reflects your unique identity.",
  },
  {
    icon: MessageSquare,
    title: "Design Studio",
    description: "Chat with your AI creative director. Describe what you need, refine via conversation, and download in seconds.",
  },
  {
    icon: Layers,
    title: "Carousel Creator",
    description: "Generate multi-slide Instagram carousels with a narrative arc — Hook, Value, CTA — all brand-consistent.",
  },
  {
    icon: Brain,
    title: "Content Hub",
    description: "Plan your content calendar with AI-generated ideas, content pillars, and one-click design creation.",
  },
  {
    icon: Target,
    title: "Audience Intelligence",
    description: "Define who you're targeting using the JTBD framework. Brandie crafts copy and visuals that resonate and convert.",
  },
  {
    icon: TrendingUp,
    title: "Trend Lab",
    description: "Stay current with design trends — Neo Brutalism, Hyper Chromatic, Kinetic Typography — blended with your brand.",
  },
];

const LandingFeatures = () => (
  <section className="bg-secondary/30 border-y border-border">
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-20 sm:py-28">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        className="text-center mb-16 space-y-3"
      >
        <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-serif tracking-tight">
          Everything you need to design at scale
        </motion.h2>
        <motion.p variants={fadeUp} custom={1} className="text-muted-foreground max-w-lg mx-auto">
          Six powerful tools working together — brand memory, audience psychology, trend intelligence, and AI creativity.
        </motion.p>
      </motion.div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={fadeUp}
            custom={i + 2}
            className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-3"
          >
            <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center">
              <feature.icon className="h-5 w-5 text-foreground" />
            </div>
            <h3 className="text-lg font-serif">{feature.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default LandingFeatures;
