import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import brandConsistency from "@/assets/landing-brand.jpg";
import contentHub from "@/assets/landing-content.jpg";
import carouselPreview from "@/assets/landing-carousel.jpg";
import aiIntelligence from "@/assets/landing-ai.jpg";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.12, ease: "easeOut" as const },
  }),
};

const ShowcaseImage = ({ src, alt, direction = "right" }: { src: string; alt: string; direction?: "left" | "right" }) => (
  <motion.div
    initial={{ opacity: 0, x: direction === "right" ? 30 : -30 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true, margin: "-80px" }}
    transition={{ duration: 0.6 }}
    className={direction === "left" ? "order-2 md:order-1" : ""}
  >
    <div className="relative">
      <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent blur-xl pointer-events-none" />
      <img src={src} alt={alt} className="relative w-full rounded-2xl border border-border shadow-lg" loading="lazy" />
    </div>
  </motion.div>
);

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
              Your Brand Centre stores everything, colours, fonts, tone, personality, and inspiration. Brandie uses this DNA to ensure every graphic feels unmistakably yours.
            </motion.p>
            <motion.div variants={fadeUp} custom={2}>
              <Button variant="outline" className="rounded-xl gap-2" onClick={() => navigate("/auth?mode=signup")}>
                Start building your brand <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          </motion.div>
          <ShowcaseImage src={brandConsistency} alt="Brand Centre dashboard with colours, typography, and tone settings" />
        </div>
      </section>

      {/* Content Hub */}
      <section className="bg-secondary/30 border-y border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-20 sm:py-28">
          <div className="grid md:grid-cols-2 gap-10 sm:gap-16 items-center">
            <ShowcaseImage src={contentHub} alt="Content Hub calendar with AI-generated ideas and content pillars" direction="left" />
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} className="space-y-5 order-1 md:order-2">
              <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-serif tracking-tight">
                Plan, create, and schedule, all in one place
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
          <ShowcaseImage src={carouselPreview} alt="Multi-slide carousel preview with Hook, Problem, Solution, Proof, CTA flow" />
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
              <div className="relative">
                <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-primary-foreground/10 via-primary-foreground/5 to-transparent blur-xl pointer-events-none" />
                <img src={aiIntelligence} alt="Visual Style Genome with Trend Lab and Audience Intelligence" className="relative w-full rounded-2xl border border-primary-foreground/10 shadow-lg" loading="lazy" />
              </div>
            </motion.div>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} className="space-y-5 order-1 md:order-2">
              <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-serif tracking-tight">
                The engine learns your taste
              </motion.h2>
              <motion.p variants={fadeUp} custom={1} className="text-primary-foreground/70 leading-relaxed">
                Brandie's Visual Style Genome remembers what you upvote and quietly tunes future posts, tone, layout, palette, hook style. Combined with JTBD audience profiling, the engine doesn't just get faster. It gets sharper, week after week.
              </motion.p>
              <motion.div variants={fadeUp} custom={2} className="flex flex-wrap gap-3">
                {["Style Genome", "Mutation Engine", "Brand Memory", "JTBD Profiling", "Trend Adaptation"].map((tag) => (
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
