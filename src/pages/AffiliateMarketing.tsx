import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import SEO from "@/components/SEO";
import LandingNav from "@/components/landing/LandingNav";
import LandingFooter from "@/components/landing/LandingFooter";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AFFILIATE_RATES,
  AVG_REFERRAL_MONTHLY_NGN,
  PLAN_ARPU_OPTIONS,
  MILESTONES,
  MIN_PAYOUT_NGN,
  PAYOUT_PROCESSING_DAYS,
  formatNgn,
  projectEarnings,
} from "@/lib/affiliateConfig";
import { SWIPE_POSTS } from "@/lib/affiliateAssets";
import {
  ArrowRight,
  Sparkles,
  Wallet,
  Network,
  TrendingUp,
  Users,
  Megaphone,
  Building2,
  Calculator,
  Calendar,
  CheckCircle2,
} from "lucide-react";

const FAQS = [
  {
    q: "Who can join the Brandie Affiliate Program?",
    a: "Anyone with an audience, creators, influencers, agencies, freelancers, small business advisors. You don't have to be a Brandie customer to apply, though it helps to have used the product so you can speak to it honestly.",
  },
  {
    q: "How much can I earn?",
    a: `You earn ${AFFILIATE_RATES.tier1FirstPct}% on every new user's first payment, then ${AFFILIATE_RATES.tier1RecurringPct}% on every payment they make after that, for life. On the Creator plan (${formatNgn(37000)}/mo) that's ${formatNgn(37000 * 0.2)} the first month, then ${formatNgn(37000 * 0.05)} every month after. If you also recruit other affiliates, you earn ${AFFILIATE_RATES.tier2FirstPct}% first and ${AFFILIATE_RATES.tier2RecurringPct}% recurring on their referrals too. There is no earnings cap.`,
  },
  {
    q: "When and how do I get paid?",
    a: `Payouts are processed monthly in Nigerian Naira (₦) directly to your bank account. The minimum payout is ${formatNgn(MIN_PAYOUT_NGN)}, and we process requests within ${PAYOUT_PROCESSING_DAYS}.`,
  },
  {
    q: "What counts as a referral?",
    a: "Any new user who clicks your unique affiliate link and signs up. Once they make a paid subscription or one-time payment, you earn commission automatically, no need to claim it.",
  },
  {
    q: "How long do referral cookies last?",
    a: "Your link is attributed at signup, so as long as a visitor signs up after clicking through (even days later, in the same browser), they're credited to you.",
  },
  {
    q: "What about international payouts?",
    a: "Payouts are currently in Naira to Nigerian bank accounts. International payouts are on the roadmap, for now, international affiliates can apply and we'll work with you case-by-case.",
  },
  {
    q: "Do I need to handle tax?",
    a: "Yes, affiliate income is your responsibility to declare in your jurisdiction. We provide a clear earnings statement in your dashboard for your records.",
  },
  {
    q: "Where do I get help or marketing materials?",
    a: "Approved affiliates get a Marketing Kit inside the dashboard: ready-to-use banners, swipe copy, and disclosure snippets. For anything else, our team is one email away.",
  },
];

const AffiliateMarketing = () => {
  const navigate = useNavigate();

  const [refsPerMonth, setRefsPerMonth] = useState(5);
  const [recruits, setRecruits] = useState(2);
  const [recruitRefs, setRecruitRefs] = useState(3);

  const projection = useMemo(() => {
    const m1 = projectEarnings({
      newReferralsPerMonth: refsPerMonth,
      recruitedAffiliates: recruits,
      recruitReferralsPerMonth: recruitRefs,
      horizonMonths: 1,
    });
    const m6 = projectEarnings({
      newReferralsPerMonth: refsPerMonth,
      recruitedAffiliates: recruits,
      recruitReferralsPerMonth: recruitRefs,
      horizonMonths: 6,
    });
    const y1 = projectEarnings({
      newReferralsPerMonth: refsPerMonth,
      recruitedAffiliates: recruits,
      recruitReferralsPerMonth: recruitRefs,
      horizonMonths: 12,
    });
    return { m1, m6, y1 };
  }, [refsPerMonth, recruits, recruitRefs]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Brandie Affiliate Program, Earn 20% + Lifetime Commissions"
        description="Turn your audience into recurring income. Earn 20% first-payment + 5% lifetime on every referral, plus 2nd-tier network commissions. Open to creators, influencers and agencies."
        path="/affiliates"
        jsonLd={faqJsonLd}
      />
      <LandingNav />

      <main>
        {/* Hero */}
        <section className="px-4 sm:px-8 pt-12 sm:pt-20 pb-16">
          <div className="max-w-5xl mx-auto text-center space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Brandie Affiliate Program
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="text-4xl sm:text-6xl font-serif tracking-tight leading-tight"
            >
              Turn your audience into <span className="text-primary">recurring income</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto"
            >
              Earn {AFFILIATE_RATES.tier1FirstPct}% on every first payment, {AFFILIATE_RATES.tier1RecurringPct}% lifetime
              after that, plus 2nd-tier commissions from affiliates you recruit. No cap. Monthly payouts.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex flex-wrap items-center justify-center gap-3 pt-2"
            >
              <Button size="lg" className="rounded-xl gap-2" onClick={() => navigate("/affiliate/signup")}>
                Apply now <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="rounded-xl gap-2" onClick={() => scrollTo("calculator")}>
                <Calculator className="h-4 w-4" /> Try the calculator
              </Button>
            </motion.div>

            {/* Trust strip */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-6 text-xs text-muted-foreground">
              {[
                { icon: Wallet, label: "Monthly payouts" },
                { icon: TrendingUp, label: "No earnings cap" },
                { icon: Network, label: "2-tier commissions" },
                { icon: CheckCircle2, label: "Free to join" },
              ].map((t) => (
                <div key={t.label} className="flex items-center gap-1.5">
                  <t.icon className="h-3.5 w-3.5 text-primary" /> {t.label}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why Brandie */}
        <section className="px-4 sm:px-8 py-16 border-t border-border bg-muted/20">
          <div className="max-w-5xl mx-auto space-y-10">
            <div className="text-center space-y-3">
              <h2 className="text-3xl sm:text-4xl font-serif tracking-tight">A program built like a partnership</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Brandie is a product creators actually love, and we share the upside generously.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  icon: Sparkles,
                  title: "A product people stick with",
                  body: "Brandie is an AI Brand Studio used by founders, creators and agencies for daily on-brand content. High retention = high lifetime commissions for you.",
                },
                {
                  icon: TrendingUp,
                  title: "Recurring, not one-off",
                  body: `${AFFILIATE_RATES.tier1FirstPct}% on the first payment and ${AFFILIATE_RATES.tier1RecurringPct}% on every payment after. Refer once, earn for as long as they stay.`,
                },
                {
                  icon: Network,
                  title: "2nd-tier network earnings",
                  body: `Recruit other affiliates and earn ${AFFILIATE_RATES.tier2FirstPct}% first + ${AFFILIATE_RATES.tier2RecurringPct}% lifetime on their referrals. Build a real income stream.`,
                },
              ].map((card) => (
                <div key={card.title} className="rounded-2xl border border-border p-6 space-y-3 bg-background">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <card.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-serif text-lg">{card.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{card.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="px-4 sm:px-8 py-16 border-t border-border">
          <div className="max-w-5xl mx-auto space-y-10">
            <div className="text-center space-y-3">
              <h2 className="text-3xl sm:text-4xl font-serif tracking-tight">How it works</h2>
              <p className="text-muted-foreground">Four steps. About two minutes to get started.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { n: "01", t: "Apply", d: "Tell us about your audience and how you'd promote Brandie." },
                { n: "02", t: "Get approved", d: "Most applications are reviewed within 24–48 hours." },
                { n: "03", t: "Share your link", d: "Drop your unique link in posts, newsletters, or DMs." },
                { n: "04", t: "Earn monthly", d: "Track every conversion in your dashboard. Get paid monthly." },
              ].map((s) => (
                <div key={s.n} className="rounded-2xl border border-border p-5 space-y-2">
                  <p className="text-xs font-mono text-primary">{s.n}</p>
                  <h3 className="font-medium">{s.t}</h3>
                  <p className="text-sm text-muted-foreground">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Commission breakdown */}
        <section className="px-4 sm:px-8 py-16 border-t border-border bg-muted/20">
          <div className="max-w-5xl mx-auto space-y-10">
            <div className="text-center space-y-3">
              <h2 className="text-3xl sm:text-4xl font-serif tracking-tight">How commissions work</h2>
              <p className="text-muted-foreground">Two tiers. Both pay recurring. Worked examples below.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Tier 1 */}
              <div className="rounded-2xl border-2 border-primary/40 p-6 space-y-4 bg-background">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-xl">Tier 1 · Direct</h3>
                  <span className="text-xs uppercase tracking-wider rounded-full bg-primary/10 text-primary px-2 py-0.5">
                    Most popular
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between border-b border-border/60 pb-2">
                    <span className="text-sm text-muted-foreground">First payment</span>
                    <span className="font-serif text-2xl text-primary">{AFFILIATE_RATES.tier1FirstPct}%</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">Every recurring payment</span>
                    <span className="font-serif text-2xl text-primary">{AFFILIATE_RATES.tier1RecurringPct}%</span>
                  </div>
                </div>
                <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Worked example</p>
                  <p>
                    Refer 10 users on the Creator plan ({formatNgn(AVG_REFERRAL_MONTHLY_NGN)}/mo).
                  </p>
                  <p>
                    Month 1: {formatNgn(10 * AVG_REFERRAL_MONTHLY_NGN * 0.2)} ·{" "}
                    Month 2+: {formatNgn(10 * AVG_REFERRAL_MONTHLY_NGN * 0.05)}/mo
                  </p>
                  <p>
                    Year 1 total: <span className="text-foreground font-semibold">
                      {formatNgn(10 * AVG_REFERRAL_MONTHLY_NGN * 0.2 + 10 * AVG_REFERRAL_MONTHLY_NGN * 0.05 * 11)}
                    </span>
                  </p>
                </div>
              </div>

              {/* Tier 2 */}
              <div className="rounded-2xl border border-border p-6 space-y-4 bg-background">
                <h3 className="font-serif text-xl">Tier 2 · Network</h3>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between border-b border-border/60 pb-2">
                    <span className="text-sm text-muted-foreground">First payment (their referrals)</span>
                    <span className="font-serif text-2xl text-primary">{AFFILIATE_RATES.tier2FirstPct}%</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">Recurring (their referrals)</span>
                    <span className="font-serif text-2xl text-primary">{AFFILIATE_RATES.tier2RecurringPct}%</span>
                  </div>
                </div>
                <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Worked example</p>
                  <p>Recruit 3 affiliates. Each brings 5 referrals/month.</p>
                  <p>That's 15 new referrals/month flowing through your network.</p>
                  <p>
                    Year 1 passive add-on: <span className="text-foreground font-semibold">
                      {formatNgn(projectEarnings({ newReferralsPerMonth: 0, recruitedAffiliates: 3, recruitReferralsPerMonth: 5, horizonMonths: 12 }).networkEarnings)}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Calculator */}
        <section id="calculator" className="px-4 sm:px-8 py-16 border-t border-border">
          <div className="max-w-5xl mx-auto space-y-10">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 text-xs text-primary">
                <Calculator className="h-3.5 w-3.5" /> Live calculator
              </div>
              <h2 className="text-3xl sm:text-4xl font-serif tracking-tight">What could you earn?</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Move the sliders. Numbers update instantly. Assumes an average referral pays{" "}
                {formatNgn(AVG_REFERRAL_MONTHLY_NGN)}/month.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Inputs */}
              <div className="rounded-2xl border border-border p-6 space-y-6 bg-background">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">New referrals per month</label>
                    <span className="font-serif text-xl text-primary">{refsPerMonth}</span>
                  </div>
                  <Slider
                    value={[refsPerMonth]}
                    onValueChange={(v) => setRefsPerMonth(v[0])}
                    min={0}
                    max={50}
                    step={1}
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Affiliates you recruit</label>
                    <span className="font-serif text-xl text-primary">{recruits}</span>
                  </div>
                  <Slider
                    value={[recruits]}
                    onValueChange={(v) => setRecruits(v[0])}
                    min={0}
                    max={20}
                    step={1}
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Referrals each recruit brings/month</label>
                    <span className="font-serif text-xl text-primary">{recruitRefs}</span>
                  </div>
                  <Slider
                    value={[recruitRefs]}
                    onValueChange={(v) => setRecruitRefs(v[0])}
                    min={0}
                    max={20}
                    step={1}
                  />
                </div>
              </div>

              {/* Outputs */}
              <div className="rounded-2xl border-2 border-primary/40 p-6 space-y-5 bg-gradient-to-br from-primary/5 via-background to-background">
                <h3 className="font-serif text-lg">Projected earnings</h3>
                {[
                  { label: "Month 1", value: projection.m1.total, sub: `${formatNgn(projection.m1.directEarnings)} direct + ${formatNgn(projection.m1.networkEarnings)} network` },
                  { label: "First 6 months", value: projection.m6.total, sub: `${formatNgn(projection.m6.directEarnings)} direct + ${formatNgn(projection.m6.networkEarnings)} network` },
                  { label: "Year 1", value: projection.y1.total, sub: `${formatNgn(projection.y1.directEarnings)} direct + ${formatNgn(projection.y1.networkEarnings)} network` },
                ].map((row) => (
                  <div key={row.label} className="border-b border-border/60 pb-3 last:border-0 last:pb-0">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{row.label}</p>
                    <p className="text-3xl font-serif tracking-tight text-primary">{formatNgn(row.value)}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{row.sub}</p>
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground italic">
                  Indicative only, your actual earnings depend on conversion and retention.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section className="px-4 sm:px-8 py-16 border-t border-border bg-muted/20">
          <div className="max-w-5xl mx-auto space-y-10">
            <div className="text-center space-y-3">
              <h2 className="text-3xl sm:text-4xl font-serif tracking-tight">Built for people with reach</h2>
              <p className="text-muted-foreground">If your audience makes things, runs things, or builds things, Brandie is for them.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  icon: Megaphone,
                  title: "Creators",
                  bullets: ["Newsletter writers", "YouTube / TikTok educators", "Course creators"],
                },
                {
                  icon: Users,
                  title: "Influencers",
                  bullets: ["Business & marketing", "Solopreneurs", "Productivity / no-code"],
                },
                {
                  icon: Building2,
                  title: "Agencies & consultants",
                  bullets: ["Brand consultants", "Marketing agencies", "Small-business coaches"],
                },
              ].map((p) => (
                <div key={p.title} className="rounded-2xl border border-border p-6 space-y-4 bg-background">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <p.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-serif text-lg">{p.title}</h3>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {p.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" /> {b}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Marketing kit preview */}
        <section className="px-4 sm:px-8 py-16 border-t border-border">
          <div className="max-w-5xl mx-auto space-y-10">
            <div className="text-center space-y-3">
              <h2 className="text-3xl sm:text-4xl font-serif tracking-tight">A real marketing kit, not a link dump</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Approved affiliates get branded banners, ready-to-use swipe copy, and FTC disclosure snippets, all in the dashboard.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SWIPE_POSTS.slice(0, 2).map((p) => (
                <div key={p.id} className="rounded-2xl border border-border p-5 space-y-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium">{p.label}</p>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.channel}</span>
                  </div>
                  <p className="text-sm whitespace-pre-line text-foreground/85">
                    {p.body.split("{LINK}").join("yourlink.brandie.com")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Milestones teaser */}
        <section className="px-4 sm:px-8 py-16 border-t border-border bg-muted/20">
          <div className="max-w-5xl mx-auto space-y-10">
            <div className="text-center space-y-3">
              <h2 className="text-3xl sm:text-4xl font-serif tracking-tight">Climb the ranks</h2>
              <p className="text-muted-foreground">Earn badges as you grow, from Rising Star to Legend.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {MILESTONES.map((m) => (
                <div key={m.amount} className="rounded-2xl border border-border p-4 text-center space-y-1 bg-background">
                  <p className="text-3xl">{m.emoji}</p>
                  <p className="text-xs font-semibold text-primary">{m.label}</p>
                  <p className="text-[10px] text-muted-foreground">{m.title}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-4 sm:px-8 py-16 border-t border-border">
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="text-center space-y-3">
              <h2 className="text-3xl sm:text-4xl font-serif tracking-tight">Questions, answered</h2>
            </div>
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((f, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-left text-base">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 sm:px-8 py-20 border-t border-border bg-gradient-to-br from-primary/10 via-background to-background">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <Calendar className="h-10 w-10 text-primary mx-auto" />
            <h2 className="text-3xl sm:text-5xl font-serif tracking-tight">Apply in 2 minutes</h2>
            <p className="text-muted-foreground">
              Approval is usually within 24–48 hours. Your dashboard, link and marketing kit are ready
              the moment you're in.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" className="rounded-xl gap-2" onClick={() => navigate("/affiliate/signup")}>
                Apply now <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="ghost" className="rounded-xl" onClick={() => scrollTo("calculator")}>
                Try the calculator again
              </Button>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
};

export default AffiliateMarketing;
