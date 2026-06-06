import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Calendar, Wand2, MessageSquare, BarChart3, Star } from "lucide-react";
import SEO from "@/components/SEO";
import brandieLogo from "@/assets/brandie-logo.png";
import heroAsset from "@/assets/landing-hero-ng.jpg.asset.json";
import atelierAsset from "@/assets/landing-atelier-ng.jpg.asset.json";
import tundeAsset from "@/assets/testimonial-ng-tunde.jpg.asset.json";
import chiomaAsset from "@/assets/testimonial-ng-chioma.jpg.asset.json";
import aminaAsset from "@/assets/testimonial-ng-amina.jpg.asset.json";
import pillar1Asset from "@/assets/landing-pillar-1.jpg.asset.json";
import pillar2Asset from "@/assets/landing-pillar-2.jpg.asset.json";
import pillar3Asset from "@/assets/landing-pillar-3.jpg.asset.json";
import pillar4Asset from "@/assets/landing-pillar-4.jpg.asset.json";
import pillar5Asset from "@/assets/landing-pillar-5.jpg.asset.json";

const pillars = [
  { icon: Sparkles, title: "Autonomous research", body: "Trends, holidays, payday cycles, picked for your industry. You never hunt for inspiration again.", image: pillar1Asset.url, alt: "Hand-illustrated research cards on linen with ankara motif" },
  { icon: Wand2, title: "Strategic arc, not status spam", body: "Each week is a 5-day narrative, hook, proof, scarcity, CTA. Designed to convert, not to fill a feed.", image: pillar2Asset.url, alt: "Five charcoal dots connected by a rising gold thread on beige paper" },
  { icon: Calendar, title: "Pre-filled weekly blueprint", body: "Your calendar arrives already done. Review once, approve once. Brandie handles the rest.", image: pillar3Asset.url, alt: "Hand-drawn weekly calendar with brass paperclip and ankara strip" },
  { icon: MessageSquare, title: "Conversational edits", body: "“Swap Thursday for a restock post.” Brandie reworks just that one. Nothing else breaks.", image: pillar4Asset.url, alt: "Calendar with a gold brushstroke swap and a fountain pen" },
  { icon: BarChart3, title: "CEO briefing", body: "A weekly summary that prioritises link clicks and DMs over likes. Then it teaches itself.", image: pillar5Asset.url, alt: "Editorial chart on cream paper beside a leather notebook and espresso" },
];

const testimonials = [
  {
    name: "Amina O.",
    role: "Founder, leather atelier · Lagos",
    quote: "Monday used to be panic. Now it's ten minutes with coffee. My feed finally looks like the brand I always described.",
    img: aminaAsset.url,
  },
  {
    name: "Tunde A.",
    role: "Co-founder, SaaS · Lekki",
    quote: "Brandie writes like someone who actually sells in Nigeria. The strategic arc is the part no freelancer ever gave me.",
    img: tundeAsset.url,
  },
  {
    name: "Chioma E.",
    role: "Owner, beauty studio · Abuja",
    quote: "Five posts a week, fully on brand, with WhatsApp ready captions. I cancelled my social media manager.",
    img: chiomaAsset.url,
  },
];

const Landing = () => (
  <div className="min-h-dvh bg-background text-foreground">
    <SEO
      title="Brandie, your marketing department, on autopilot"
      description="Pick your playbook. Brandie generates a strategic 5-day campaign every week. You approve in ten minutes. Done."
      path="/v2"
    />

    {/* NAV */}
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link to="/v2" className="flex items-center gap-2">
          <img src={brandieLogo} alt="Brandie" className="h-7 w-7" />
          <span className="font-serif text-xl tracking-tight">Brandie</span>
          <span className="ml-2 text-[10px] tracking-[0.2em] uppercase text-muted-foreground border border-border rounded-full px-1.5 py-0.5">v1</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button asChild variant="outline" size="sm" className="rounded-full px-4 h-9">
            <Link to="/auth">Log in</Link>
          </Button>
          <Button asChild size="sm" className="rounded-full px-4 h-9">
            <Link to="/auth?mode=signup">Start free <ArrowRight className="h-3.5 w-3.5" /></Link>
          </Button>
        </div>
      </div>
    </header>

    <main>
      {/* HERO — split editorial */}
      <section className="px-5 sm:px-8 pt-12 sm:pt-20 pb-16 sm:pb-24 max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-16 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.18em] uppercase text-muted-foreground border border-border rounded-full px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground" /> Autonomous Content System · v1.0
            </span>
            <h1 className="mt-6 font-serif tracking-tight text-5xl sm:text-7xl leading-[0.95]">
              Your marketing<br />
              department,<br />
              <em className="text-muted-foreground">on autopilot.</em>
            </h1>
            <p className="mt-7 text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl">
              Pick your playbook. Brandie researches, writes, designs and sequences a full week of on-brand posts.
              You review in ten minutes on Monday. Done.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="rounded-full h-12 px-7 text-base">
                <Link to="/auth?mode=signup">Start my engine <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="rounded-full h-12 px-6 text-base text-muted-foreground">
                <a href="#how">How it works</a>
              </Button>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">No card required · First week free · Cancel anytime</p>

            {/* Trust strip */}
            <div className="mt-10 flex items-center gap-4">
              <div className="flex -space-x-2">
                <img src={aminaAsset.url} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-background" />
                <img src={chiomaAsset.url} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-background" />
                <img src={tundeAsset.url} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-background" />
              </div>
              <div className="text-xs text-muted-foreground">
                <div className="flex items-center gap-0.5 text-foreground">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-current" />
                  ))}
                </div>
                Trusted by Nigerian founders building real brands.
              </div>
            </div>
          </div>

          {/* Hero portrait */}
          <div className="relative">
            <div className="absolute -inset-6 bg-gradient-to-br from-secondary/60 via-transparent to-accent/10 rounded-[2rem] blur-2xl -z-10" />
            <div className="relative aspect-[4/5] rounded-[1.75rem] overflow-hidden border border-border bg-secondary/40 shadow-[0_30px_80px_-30px_hsl(var(--foreground)/0.25)]">
              <img
                src={heroAsset.url}
                alt="A Nigerian founder, calm and in control of her brand"
                className="h-full w-full object-cover"
                width={1080}
                height={1350}
              />
              {/* Floating spec card */}
              <div className="absolute left-4 right-4 bottom-4 sm:left-5 sm:right-5 sm:bottom-5 rounded-2xl bg-background/90 backdrop-blur border border-border p-4 sm:p-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">This week's blueprint</p>
                  <p className="font-serif text-base sm:text-lg mt-0.5">5 posts · 1 narrative · 0 hustle</p>
                </div>
                <div className="text-right">
                  <p className="font-serif text-2xl leading-none">10<span className="text-muted-foreground text-sm">min</span></p>
                  <p className="text-[10px] tracking-wider uppercase text-muted-foreground mt-1">Mon review</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* QUOTE STRIP */}
      <section className="border-y border-border bg-secondary/40">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
          <p className="font-serif text-2xl sm:text-3xl leading-snug">
            “It feels like an entire agency is working in the background while I focus on operations.”
          </p>
          <p className="mt-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">Amina · Founder, Lagos</p>
        </div>
      </section>

      {/* SIX PILLARS */}
      <section id="how" className="px-5 sm:px-8 py-20 sm:py-28 max-w-6xl mx-auto">
        <div className="max-w-2xl">
          <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground">The system</p>
          <h2 className="mt-3 font-serif text-4xl sm:text-5xl tracking-tight">Six things working for you, every week.</h2>
        </div>
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border rounded-2xl overflow-hidden">
          {pillars.map((p, i) => (
            <div key={p.title} className="bg-background p-7 sm:p-9 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <p.icon className="h-5 w-5 text-foreground" />
                <span className="text-[11px] tracking-[0.2em] text-muted-foreground">0{i + 1}</span>
              </div>
              <div className="aspect-[4/3] -mx-1 rounded-xl overflow-hidden bg-secondary/40 border border-border/60">
                <img
                  src={p.image}
                  alt={p.alt}
                  className="h-full w-full object-cover"
                  width={1024}
                  height={768}
                  loading="lazy"
                />
              </div>
              <h3 className="font-serif text-2xl tracking-tight">{p.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
            </div>
          ))}
          <div className="bg-foreground text-background p-7 sm:p-9 flex flex-col justify-between gap-6">
            <h3 className="font-serif text-2xl tracking-tight">Ready to stop posting like it's your second job?</h3>
            <Button asChild variant="secondary" className="rounded-full self-start h-10 px-5">
              <Link to="/auth?mode=signup">Start free <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* BUILT FOR NIGERIA — image + copy */}
      <section className="border-y border-border bg-secondary/30">
        <div className="px-5 sm:px-8 py-20 sm:py-28 max-w-6xl mx-auto grid lg:grid-cols-[0.95fr_1.05fr] gap-12 lg:gap-16 items-center">
          <div className="relative order-2 lg:order-1">
            <div className="aspect-[16/10] rounded-[1.75rem] overflow-hidden border border-border shadow-[0_20px_60px_-25px_hsl(var(--foreground)/0.25)]">
              <img
                src={atelierAsset.url}
                alt="A Lagos atelier with leather bags, ankara fabric and a phone showing the Brandie calendar"
                className="h-full w-full object-cover"
                width={1920}
                height={1080}
                loading="lazy"
              />
            </div>
            <div className="absolute -bottom-5 -right-3 sm:-right-5 rounded-2xl bg-background border border-border px-4 py-3 shadow-md hidden sm:block">
              <p className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Built for</p>
              <p className="font-serif text-lg">Lagos · Abuja · PH</p>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground">Built for Nigeria</p>
            <h2 className="mt-3 font-serif text-4xl sm:text-5xl tracking-tight">It speaks like your customer.</h2>
            <p className="mt-6 text-muted-foreground text-lg leading-relaxed">
              Brandie understands the payday rhythm, the WhatsApp DM, the “abeg send price”, the Sallah rush, the December bridal season.
              Your captions read like a Lagosian, not a SaaS template.
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              {[
                "Naira pricing and WhatsApp-ready captions",
                "Sallah, Christmas, Independence and payday cadence",
                "Pidgin, English or both, your tone, locked in",
                "Designs that hold up next to the best on your timeline",
              ].map((s) => (
                <li key={s} className="flex items-start gap-3">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-foreground shrink-0" />
                  <span className="text-foreground/90">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* RITUAL */}
      <section className="border-b border-border">
        <div className="px-5 sm:px-8 py-20 sm:py-28 max-w-5xl mx-auto">
          <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground">The Monday ritual</p>
          <h2 className="mt-3 font-serif text-4xl sm:text-5xl tracking-tight">Ten minutes. Once a week.</h2>
          <ol className="mt-12 space-y-8 sm:space-y-10">
            {[
              { t: "08:00, Notification", b: "Your weekly strategy is ready for approval." },
              { t: "08:02, Review the Blueprint", b: "Five days. One narrative. Read it like a story." },
              { t: "08:06, Edit conversationally", b: "“Swap Thursday for a restock post.” Brandie reworks just that one." },
              { t: "08:09, Approve", b: "One tap. The engine handles the rest of the week." },
            ].map((s, i) => (
              <li key={s.t} className="grid grid-cols-[3rem_1fr] gap-5 sm:gap-8 items-baseline border-b border-border/60 pb-8 last:border-0">
                <span className="font-serif text-3xl text-muted-foreground">0{i + 1}</span>
                <div>
                  <p className="font-medium">{s.t}</p>
                  <p className="text-muted-foreground mt-1">{s.b}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="px-5 sm:px-8 py-20 sm:py-28 max-w-6xl mx-auto">
        <div className="max-w-2xl">
          <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground">Founders running it now</p>
          <h2 className="mt-3 font-serif text-4xl sm:text-5xl tracking-tight">Quiet weeks. Loud results.</h2>
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-5">
          {testimonials.map((t) => (
            <figure key={t.name} className="rounded-2xl border border-border bg-background p-6 sm:p-7 flex flex-col gap-5">
              <div className="flex items-center gap-0.5 text-foreground">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" />
                ))}
              </div>
              <blockquote className="font-serif text-xl leading-snug">“{t.quote}”</blockquote>
              <figcaption className="mt-auto flex items-center gap-3 pt-3 border-t border-border/60">
                <img src={t.img} alt={t.name} className="h-11 w-11 rounded-full object-cover" loading="lazy" width={88} height={88} />
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* PRICE */}
      <section className="border-t border-border bg-secondary/40">
        <div className="px-5 sm:px-8 py-20 sm:py-28 max-w-3xl mx-auto text-center">
          <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground">Pay only for what you create</p>
          <h2 className="mt-3 font-serif text-5xl sm:text-6xl tracking-tight">₦5,000 / 20 credits</h2>
          <p className="mt-4 text-muted-foreground">That's ₦250 a post. No subscriptions, no expiry. Start with 5 free credits every month, top up only when you need more.</p>
          <Button asChild size="lg" className="rounded-full mt-10 h-12 px-7 text-base">
            <Link to="/auth?mode=signup">Start free <ArrowRight className="h-4 w-4" /></Link>
          </Button>
          <p className="mt-4 text-xs text-muted-foreground">5 free credits every month. No card required.</p>
        </div>
      </section>
    </main>

    <footer className="border-t border-border">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <img src={brandieLogo} alt="" className="h-5 w-5" />
          <span>© {new Date().getFullYear()} Brandie · Made in Lagos</span>
        </div>
        <div className="flex items-center gap-5">
          <Link to="/legacy" className="hover:text-foreground">Legacy app</Link>
          <Link to="/auth" className="hover:text-foreground">Sign in</Link>
        </div>
      </div>
    </footer>
  </div>
);

export default Landing;
