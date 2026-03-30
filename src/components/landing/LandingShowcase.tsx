import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import brandConsistency from "@/assets/landing-brand-consistency.png";
import contentHub from "@/assets/landing-content-hub.png";
import carouselPreview from "@/assets/landing-carousel.png";
import aiIntelligence from "@/assets/landing-ai-intelligence.png";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.12, ease: "easeOut" as const },
  }),
};

const LandingShowcase = () => {
  const navigate = useNavigate();

  return (
    <>
      {/* Brand Centre */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-20 sm:py-28">
        <div className="grid md:grid-cols-2 gap-10 sm:gap-16 items-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} className="space-y-5">
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-serif tracking-tight">
              Every post, perfectly on brand
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground leading-relaxed">
              Your Brand Centre stores everything — colours, fonts, tone, personality, and inspiration. Brandie uses this DNA to ensure every graphic feels unmistakably yours.
            </motion.p>
            <motion.div variants={fadeUp} custom={2}>
              <Button variant="outline" className="rounded-xl gap-2" onClick={() => navigate("/auth?mode=signup")}>
                Start building your brand <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
          >
            <img src={brandConsistency} alt="Brand Centre dashboard with colours, typography, and tone settings" className="w-full rounded-2xl border border-border shadow-lg" loading="lazy" />
          </motion.div>
        </div>
      </section>

      {/* Content Hub */}
      <section className="bg-secondary/30 border-y border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-20 sm:py-28">
          <div className="grid md:grid-cols-2 gap-10 sm:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
              className="order-2 md:order-1"
            >
              <img src={contentHub} alt="Content Hub calendar with AI-generated ideas and content pillars" className="w-full rounded-2xl border border-border shadow-lg" loading="lazy" />
            </motion.div>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} className="space-y-5 order-1 md:order-2">
              <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-serif tracking-tight">
                Plan, create, and schedule — all in one place
              </motion.h2>
              <motion.p variants={fadeUp} custom={1} className="text-muted-foreground leading-relaxed">
                The Content Hub generates weekly content ideas based on your brand, organises them into pillars, and lets you create designs or carousels with a single click.
              </motion.p>
              <motion.div variants={fadeUp} custom={2} className="flex flex-wrap gap-3">
                {["Content Pillars", "AI Ideas", "Post Series", "One-Click Design"].map((tag) => (
                  <span key={tag} className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Carousel Creator */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-20 sm:py-28">
        <div className="grid md:grid-cols-2 gap-10 sm:gap-16 items-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} className="space-y-5">
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-serif tracking-tight">
              Carousels that tell a story
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground leading-relaxed">
              Generate 2–10 slide Instagram carousels with a built-in narrative arc. Brandie plans Hook → Value → CTA across every slide while keeping your visual identity consistent.
            </motion.p>
            <motion.div variants={fadeUp} custom={2}>
              <Button variant="outline" className="rounded-xl gap-2" onClick={() => navigate("/auth?mode=signup")}>
                Try carousel creation <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
          >
            <img src={carouselPreview} alt="Multi-slide carousel preview with Hook, Problem, Solution, Proof, CTA flow" className="w-full rounded-2xl border border-border shadow-lg" loading="lazy" />
          </motion.div>
        </div>
      </section>

      {/* AI Intelligence */}
      <section className="bg-primary text-primary-foreground">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-20 sm:py-28">
          <div className="grid md:grid-cols-2 gap-10 sm:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
              className="order-2 md:order-1"
            >
              <img src={aiIntelligence} alt="Visual Style Genome with Trend Lab and Audience Intelligence" className="w-full rounded-2xl border border-primary-foreground/10 shadow-lg" loading="lazy" />
            </motion.div>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} className="space-y-5 order-1 md:order-2">
              <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-serif tracking-tight">
                Smarter with every design
              </motion.h2>
              <motion.p variants={fadeUp} custom={1} className="text-primary-foreground/70 leading-relaxed">
                Brandie's Visual Style Genome learns what works. Upvote your favourites and the system adapts — refining tone, layout, and styling to match your taste. Combined with JTBD audience profiling, every design is both beautiful and persuasive.
              </motion.p>
              <motion.div variants={fadeUp} custom={2} className="flex flex-wrap gap-3">
                {["Genome Scoring", "Mutation Engine", "Brand Memory", "JTBD Profiling", "Trend Adaptation"].map((tag) => (
                  <span key={tag} className="text-xs px-3 py-1.5 rounded-full border border-primary-foreground/20 text-primary-foreground/80">
                    {tag}
                  </span>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>
    </>
  );
};

export default LandingShowcase;
