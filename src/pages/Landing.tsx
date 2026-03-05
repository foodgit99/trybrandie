import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Palette, Target, TrendingUp, Sparkles } from "lucide-react";
import brandieLogo from "@/assets/brandie-logo.png";
import heroDesigns from "@/assets/landing-hero-designs.png";
import brandConsistency from "@/assets/landing-brand-consistency.png";
import aiIntelligence from "@/assets/landing-ai-intelligence.png";
import HeroChatInput from "@/components/HeroChatInput";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.12, ease: "easeOut" as const },
  }),
};

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-8 py-4 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <img src={brandieLogo} alt="Brandie" className="h-8 w-8" />
          <span className="text-xl font-serif tracking-tight">Brandie</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => navigate("/auth")}>
            Sign in
          </Button>
          <Button size="sm" className="rounded-xl" onClick={() => navigate("/auth?mode=signup")}>
            Get started
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 pt-16 sm:pt-24 pb-12 text-center space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
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
            Describe what you need. Brandie generates stunning, brand-consistent social media graphics in seconds — no design skills required.
          </motion.p>

          {/* Hero chat input */}
          <HeroChatInput />
        </div>

        {/* Hero image */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="max-w-5xl mx-auto px-4 sm:px-8 pb-16"
        >
          <img
            src={heroDesigns}
            alt="Social media designs created by Brandie AI"
            className="w-full rounded-2xl border border-border shadow-2xl"
            loading="lazy"
          />
        </motion.div>
      </section>

      {/* Features */}
      <section className="bg-secondary/30 border-y border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-20 sm:py-28">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="text-center mb-16 space-y-3"
          >
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-serif tracking-tight">
              Design intelligence, not templates
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground max-w-md mx-auto">
              Brandie understands your brand, your audience, and the latest design trends — then brings them together.
            </motion.p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                icon: Palette,
                title: "Brand Centre",
                description: "Store your colours, typography, tone, and logo. Every design reflects your unique identity.",
              },
              {
                icon: Target,
                title: "Audience Intelligence",
                description: "Tell us who you're targeting. We'll craft copy and visuals that resonate and convert.",
              },
              {
                icon: TrendingUp,
                title: "Trend Lab",
                description: "Stay current with design trends — Neo Brutalism, Hyper Chromatic, and more — blended with your brand.",
              },
            ].map((feature, i) => (
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

      {/* Brand Consistency Section */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-20 sm:py-28">
        <div className="grid md:grid-cols-2 gap-10 sm:gap-16 items-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="space-y-5"
          >
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-serif tracking-tight">
              Every post, perfectly on brand
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground leading-relaxed">
              Your Brand Centre stores everything — colours, fonts, tone, personality. Brandie uses this DNA to ensure every graphic feels unmistakably yours.
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
            <img
              src={brandConsistency}
              alt="Brand consistent social media designs"
              className="w-full rounded-2xl border border-border shadow-lg"
              loading="lazy"
            />
          </motion.div>
        </div>
      </section>

      {/* AI Intelligence Section */}
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
              <img
                src={aiIntelligence}
                alt="AI creative intelligence powering Brandie"
                className="w-full rounded-2xl border border-primary-foreground/10 shadow-lg"
                loading="lazy"
              />
            </motion.div>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              className="space-y-5 order-1 md:order-2"
            >
              <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-serif tracking-tight">
                Smarter with every design
              </motion.h2>
              <motion.p variants={fadeUp} custom={1} className="text-primary-foreground/70 leading-relaxed">
                Brandie's Visual Style Genome learns what works. Upvote your favourites and the system adapts — refining tone, layout, and styling to match your taste.
              </motion.p>
              <motion.div variants={fadeUp} custom={2} className="flex flex-wrap gap-3">
                {["Genome Scoring", "Mutation Engine", "Brand Memory", "Trend Adaptation"].map((tag) => (
                  <span key={tag} className="text-xs px-3 py-1.5 rounded-full border border-primary-foreground/20 text-primary-foreground/80">
                    {tag}
                  </span>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-20 sm:py-28 text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="space-y-16"
        >
          <div className="space-y-3">
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-serif tracking-tight">
              Three steps to stunning graphics
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground">
              Your first design in under 3 minutes.
            </motion.p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Set up your brand", desc: "Add your colours, logo, fonts, and tone of voice." },
              { step: "02", title: "Describe your design", desc: "Tell Brandie what you need in plain language." },
              { step: "03", title: "Refine and download", desc: "Edit via chat. Download when it's perfect." },
            ].map((item, i) => (
              <motion.div key={item.step} variants={fadeUp} custom={i + 2} className="space-y-3">
                <span className="text-4xl font-serif text-muted-foreground/30">{item.step}</span>
                <h3 className="text-lg font-serif">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* CTA */}
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
            Start free. 10 generations per month. No credit card required.
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

      {/* Footer */}
      <footer className="border-t border-border px-4 sm:px-8 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={brandieLogo} alt="Brandie" className="h-5 w-5" />
            <span className="text-sm font-serif">Brandie</span>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Brandie. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
