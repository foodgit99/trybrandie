import { motion } from "framer-motion";
import { Palette, Target, TrendingUp, MessageSquare, Layers, Brain } from "lucide-react";

import featureBrandCentre from "@/assets/feature-brand-centre.jpg";
import featureDesignStudio from "@/assets/feature-design-studio.jpg";
import featureCarousel from "@/assets/feature-carousel.jpg";
import featureContentHub from "@/assets/feature-content-hub.jpg";
import featureAudience from "@/assets/feature-audience.jpg";
import featureTrendLab from "@/assets/feature-trend-lab.jpg";

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
    image: featureBrandCentre,
  },
  {
    icon: MessageSquare,
    title: "Design Studio",
    description: "Chat with your AI creative director. Describe what you need, refine via conversation, and download in seconds.",
    image: featureDesignStudio,
  },
  {
    icon: Layers,
    title: "Carousel Creator",
    description: "Generate multi-slide Instagram carousels with a narrative arc — Hook, Value, CTA — all brand-consistent.",
    image: featureCarousel,
  },
  {
    icon: Brain,
    title: "Content Hub",
    description: "Plan your content calendar with AI-generated ideas, content pillars, and one-click design creation.",
    image: featureContentHub,
  },
  {
    icon: Target,
    title: "Audience Intelligence",
    description: "Define who you're targeting using the JTBD framework. Brandie crafts copy and visuals that resonate and convert.",
    image: featureAudience,
  },
  {
    icon: TrendingUp,
    title: "Trend Lab",
    description: "Stay current with design trends — Neo Brutalism, Hyper Chromatic, Kinetic Typography — blended with your brand.",
    image: featureTrendLab,
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
            className="group rounded-2xl border border-border bg-card overflow-hidden hover:shadow-lg transition-shadow duration-300"
          >
            <div className="relative h-40 sm:h-44 overflow-hidden bg-secondary/50">
              <img
                src={feature.image}
                alt={feature.title}
                loading="lazy"
                width={640}
                height={640}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
              <div className="absolute bottom-3 left-4">
                <div className="h-9 w-9 rounded-xl bg-background/90 backdrop-blur-sm flex items-center justify-center shadow-sm">
                  <feature.icon className="h-4.5 w-4.5 text-foreground" />
                </div>
              </div>
            </div>
            <div className="p-5 sm:p-6 space-y-2">
              <h3 className="text-lg font-serif">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default LandingFeatures;
