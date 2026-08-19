import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Brain,
  Check,
  Layers,
  MessageSquare,
  Palette,
  Power,
  Star,
  Target,
  TrendingUp,
} from "lucide-react";
import brandieLogo from "@/assets/brandie-logo.png";
import heroPremium from "@/assets/landing-hero-premium.jpg";
import featureBrandCentre from "@/assets/feature-brand-centre.jpg";
import featureContentHub from "@/assets/feature-content-hub.jpg";
import featureDesignStudio from "@/assets/feature-design-studio.jpg";
import featureCarousel from "@/assets/feature-carousel.jpg";
import featureAudience from "@/assets/feature-audience.jpg";
import featureTrendLab from "@/assets/feature-trend-lab.jpg";
import showcaseImage from "@/assets/landing-brand.jpg";
import step1 from "@/assets/landing-step-1.jpg";
import step2 from "@/assets/landing-step-2.jpg";
import step3 from "@/assets/landing-step-3.jpg";
import aminaPortrait from "@/assets/testimonial-amina.jpg";
import tundePortrait from "@/assets/testimonial-tunde.jpg";
import chiomaPortrait from "@/assets/testimonial-chioma.jpg";
import LandingPricing from "@/components/landing/LandingPricing";
import LandingFooter from "@/components/landing/LandingFooter";
import type { CampaignCopy, CampaignSectionKey } from "@/lib/campaignSections";

const FEATURE_VISUALS = [
  { icon: Palette, image: featureBrandCentre },
  { icon: Layers, image: featureContentHub },
  { icon: Brain, image: featureDesignStudio },
  { icon: MessageSquare, image: featureCarousel },
  { icon: Target, image: featureAudience },
  { icon: TrendingUp, image: featureTrendLab },
];

const STEP_IMAGES = [step1, step2, step3];
const PORTRAITS = [aminaPortrait, tundePortrait, chiomaPortrait];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.08, ease: "easeOut" as const },
  }),
};

type Props = {
  copy: CampaignCopy;
  sections: CampaignSectionKey[];
  /** Fires when a section scrolls into view. */
  onSectionView?: (key: CampaignSectionKey) => void;
  /** Fires when a signup CTA is clicked. */
  onCtaClick?: (key: CampaignSectionKey) => void;
  signupHref: string;
  /** Preview mode disables tracking and navigation. */
  preview?: boolean;
};

function useSectionView(key: CampaignSectionKey, onView?: (k: CampaignSectionKey) => void) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!onView || !ref.current) return;
    let fired = false;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !fired) {
            fired = true;
            onView(key);
            obs.disconnect();
          }
        }
      },
      { threshold: 0.35 },
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [key, onView]);
  return ref;
}

const Section = ({
  sectionKey,
  onView,
  className,
  children,
}: {
  sectionKey: CampaignSectionKey;
  onView?: (k: CampaignSectionKey) => void;
  className?: string;
  children: React.ReactNode;
}) => {
  const ref = useSectionView(sectionKey, onView);
  return (
    <section ref={ref as React.Ref<HTMLElement>} className={className}>
      {children}
    </section>
  );
};

const CampaignLanding = ({ copy, sections, onSectionView, onCtaClick, signupHref, preview }: Props) => {
  const navigate = useNavigate();

  const go = (key: CampaignSectionKey) => {
    onCtaClick?.(key);
    if (preview) return;
    navigate(signupHref);
  };

  const renderers: Record<CampaignSectionKey, () => JSX.Element | null> = {
    hero: () => {
      const c = copy.hero || {};
      return (
        <Section sectionKey="hero" onView={onSectionView} className="relative overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 sm:px-8 pt-16 sm:pt-24 pb-12 text-center space-y-6">
            {c.badge && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-secondary text-muted-foreground border border-border">
                  <Power className="h-3 w-3" />
                  {c.badge}
                </span>
              </motion.div>
            )}
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl font-serif tracking-tight leading-[1.05]"
            >
              {c.headline || "Stop posting. Start running an engine."}
            </motion.h1>
            {c.subheadline && (
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto"
              >
                {c.subheadline}
              </motion.p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center pt-2">
              <Button size="lg" className="h-12 px-7 rounded-xl gap-2" onClick={() => go("hero")}>
                <Power className="h-4 w-4" />
                {c.cta_label || "Start your engine"}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="h-12 px-5 rounded-xl text-muted-foreground"
                onClick={() => (preview ? undefined : navigate("/auth"))}
              >
                {c.secondary_label || "Sign in"}
              </Button>
            </div>
            {c.footnote && <p className="text-xs text-muted-foreground">{c.footnote}</p>}
          </div>

          <div className="relative max-w-5xl mx-auto px-4 sm:px-8 pb-16">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-b from-primary/15 via-primary/5 to-transparent blur-2xl pointer-events-none" />
            <div className="relative rounded-2xl border border-border bg-card/95 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-4 border-b border-border bg-card">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Power className="h-4 w-4 text-primary" />
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary border-2 border-card animate-pulse" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">Your engine is running.</p>
                    <p className="text-[11px] text-muted-foreground">7 posts queued · next post Tuesday 9:00 am</p>
                  </div>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Live
                </span>
              </div>
              <div className="relative aspect-[16/9] sm:aspect-[2/1] overflow-hidden">
                <img
                  src={heroPremium}
                  alt="A founder reviewing a Brandie post on her phone in a sunlit boutique"
                  className="w-full h-full object-cover"
                  fetchPriority="high"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card/40 via-transparent to-transparent" />
              </div>
            </div>
          </div>
        </Section>
      );
    },

    features: () => {
      const c = copy.features || {};
      const items = (c.items || []).slice(0, 6);
      if (items.length === 0) return null;
      return (
        <Section sectionKey="features" onView={onSectionView} className="bg-secondary/30 border-y border-border">
          <div className="max-w-5xl mx-auto px-4 sm:px-8 py-20 sm:py-28">
            <div className="text-center mb-16 space-y-3">
              <h2 className="text-3xl sm:text-4xl font-serif tracking-tight">{c.heading || "An engine, not a tool."}</h2>
              {c.subheading && <p className="text-muted-foreground max-w-lg mx-auto">{c.subheading}</p>}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item, i) => {
                const visual = FEATURE_VISUALS[i % FEATURE_VISUALS.length];
                const Icon = visual.icon;
                return (
                  <motion.div
                    key={`${item.title}-${i}`}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-60px" }}
                    variants={fadeUp}
                    custom={i}
                    className="group rounded-2xl border border-border bg-card overflow-hidden hover:shadow-lg transition-shadow duration-300"
                  >
                    <div className="relative h-40 sm:h-44 overflow-hidden bg-secondary/50">
                      <img
                        src={visual.image}
                        alt={item.title || "Brandie feature"}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
                      <div className="absolute bottom-3 left-4">
                        <div className="h-9 w-9 rounded-xl bg-background/90 flex items-center justify-center shadow-sm">
                          <Icon className="h-4 w-4 text-foreground" />
                        </div>
                      </div>
                    </div>
                    <div className="p-5 sm:p-6 space-y-2">
                      <h3 className="text-lg font-serif">{item.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </Section>
      );
    },

    showcase: () => {
      const c = copy.showcase || {};
      if (!c.heading && !c.body) return null;
      return (
        <Section sectionKey="showcase" onView={onSectionView} className="max-w-5xl mx-auto px-4 sm:px-8 py-20 sm:py-28">
          <div className="grid md:grid-cols-2 gap-10 sm:gap-16 items-center">
            <div className="space-y-5">
              <h2 className="text-3xl sm:text-4xl font-serif tracking-tight">{c.heading}</h2>
              <p className="text-muted-foreground leading-relaxed">{c.body}</p>
              {!!c.tags?.length && (
                <div className="flex flex-wrap gap-3">
                  {c.tags.slice(0, 5).map((tag) => (
                    <span key={tag} className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <Button variant="outline" className="rounded-xl gap-2" onClick={() => go("showcase")}>
                Start free <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative">
              <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent blur-xl pointer-events-none" />
              <img
                src={showcaseImage}
                alt="Brand Centre with colours, typography and tone settings"
                className="relative w-full rounded-2xl border border-border shadow-lg"
                loading="lazy"
              />
            </div>
          </div>
        </Section>
      );
    },

    how_it_works: () => {
      const c = copy.how_it_works || {};
      const steps = (c.steps || []).slice(0, 3);
      if (steps.length === 0) return null;
      return (
        <Section sectionKey="how_it_works" onView={onSectionView} className="bg-secondary/30 border-y border-border">
          <div className="max-w-5xl mx-auto px-4 sm:px-8 py-20 sm:py-28">
            <div className="text-center mb-14 space-y-3">
              <h2 className="text-3xl sm:text-4xl font-serif tracking-tight">{c.heading || "How it works"}</h2>
              {c.subheading && <p className="text-muted-foreground max-w-lg mx-auto">{c.subheading}</p>}
            </div>
            <div className="grid sm:grid-cols-3 gap-6">
              {steps.map((step, i) => (
                <motion.div
                  key={`${step.title}-${i}`}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-60px" }}
                  variants={fadeUp}
                  custom={i}
                  className="rounded-2xl border border-border bg-card overflow-hidden"
                >
                  <img src={STEP_IMAGES[i % 3]} alt={step.title || ""} loading="lazy" className="w-full h-40 object-cover" />
                  <div className="p-5 space-y-2">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Step {i + 1}</span>
                    <h3 className="text-lg font-serif">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </Section>
      );
    },

    testimonials: () => {
      const c = copy.testimonials || {};
      const items = (c.items || []).slice(0, 3);
      if (items.length === 0) return null;
      return (
        <Section sectionKey="testimonials" onView={onSectionView} className="max-w-5xl mx-auto px-4 sm:px-8 py-20 sm:py-28">
          <h2 className="text-3xl sm:text-4xl font-serif tracking-tight text-center mb-14">
            {c.heading || "Founders who stopped posting manually."}
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {items.map((t, i) => (
              <motion.figure
                key={`${t.name}-${i}`}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                variants={fadeUp}
                custom={i}
                className="rounded-2xl border border-border bg-card p-6 space-y-4"
              >
                <div className="flex gap-0.5 text-primary">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </div>
                <blockquote className="text-sm leading-relaxed text-muted-foreground">“{t.quote}”</blockquote>
                <figcaption className="flex items-center gap-3 pt-2 border-t border-border">
                  <img src={PORTRAITS[i % 3]} alt="" className="h-9 w-9 rounded-full object-cover" loading="lazy" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{t.role}</p>
                  </div>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </Section>
      );
    },

    pricing: () => {
      const c = copy.pricing || {};
      return (
        <Section sectionKey="pricing" onView={onSectionView} className="border-y border-border">
          {(c.heading || c.subheading) && (
            <div className="max-w-3xl mx-auto px-4 sm:px-8 pt-20 text-center space-y-3">
              {c.heading && <h2 className="text-3xl sm:text-4xl font-serif tracking-tight">{c.heading}</h2>}
              {c.subheading && <p className="text-muted-foreground">{c.subheading}</p>}
            </div>
          )}
          <LandingPricing />
        </Section>
      );
    },

    faq: () => {
      const c = copy.faq || {};
      const items = (c.items || []).slice(0, 6);
      if (items.length === 0) return null;
      return (
        <Section sectionKey="faq" onView={onSectionView} className="max-w-3xl mx-auto px-4 sm:px-8 py-20 sm:py-28">
          <h2 className="text-3xl sm:text-4xl font-serif tracking-tight text-center mb-12">
            {c.heading || "Questions, answered."}
          </h2>
          <div className="space-y-4">
            {items.map((f, i) => (
              <div key={`${f.q}-${i}`} className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-2">
                <h3 className="font-medium">{f.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </Section>
      );
    },

    cta: () => {
      const c = copy.cta || {};
      return (
        <Section sectionKey="cta" onView={onSectionView} className="border-t border-border bg-secondary/30">
          <div className="max-w-3xl mx-auto px-4 sm:px-8 py-20 sm:py-28 text-center space-y-6">
            <h2 className="text-3xl sm:text-4xl font-serif tracking-tight">
              {c.heading || "Switch on your content engine."}
            </h2>
            {c.body && <p className="text-muted-foreground">{c.body}</p>}
            <Button size="lg" className="h-12 px-8 rounded-xl gap-2" onClick={() => go("cta")}>
              <Power className="h-4 w-4" />
              {c.cta_label || "Start your engine"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Section>
      );
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={brandieLogo} alt="Brandie" className="h-7 w-7" />
            <span className="font-serif text-xl tracking-tight">Brandie</span>
          </Link>
          <Button size="sm" className="rounded-full px-4 h-9 gap-1.5" onClick={() => go("hero")}>
            {copy.hero?.cta_label || "Start free"} <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      <main>
        {sections.map((key) => (
          <div key={key}>{renderers[key]?.()}</div>
        ))}
        <div className="sr-only">
          <Check className="h-3 w-3" />
        </div>
      </main>

      <LandingFooter />
    </div>
  );
};

export default CampaignLanding;
