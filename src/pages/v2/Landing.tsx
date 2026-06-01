import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Calendar, Wand2, MessageSquare, BarChart3 } from "lucide-react";
import SEO from "@/components/SEO";
import brandieLogo from "@/assets/brandie-logo.png";

const pillars = [
  { icon: Sparkles, title: "Autonomous research", body: "Trends, holidays, payday cycles — picked for your industry. You never hunt for inspiration again." },
  { icon: Wand2, title: "Strategic arc, not status spam", body: "Each week is a 5-day narrative — hook, proof, scarcity, CTA. Designed to convert, not to fill a feed." },
  { icon: Calendar, title: "Pre-filled weekly blueprint", body: "Your calendar arrives already done. Review once, approve once. Brandie handles the rest." },
  { icon: MessageSquare, title: "Conversational edits", body: "“Swap Thursday for a restock post.” Brandie reworks just that one. Nothing else breaks." },
  { icon: BarChart3, title: "CEO briefing", body: "A weekly summary that prioritises link clicks and DMs over likes. Then it teaches itself." },
];

const Landing = () => (
  <div className="min-h-dvh bg-background text-foreground">
    <SEO
      title="Brandie — your marketing department, on autopilot"
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
        <div className="flex items-center gap-1 sm:gap-3">
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground hidden sm:inline-block px-3 py-2">Sign in</Link>
          <Button asChild size="sm" className="rounded-full px-4 h-9">
            <Link to="/v2/onboarding">Start free <ArrowRight className="h-3.5 w-3.5" /></Link>
          </Button>
        </div>
      </div>
    </header>

    <main>
      {/* HERO */}
      <section className="px-5 sm:px-8 pt-16 sm:pt-28 pb-20 sm:pb-32 max-w-6xl mx-auto">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.18em] uppercase text-muted-foreground border border-border rounded-full px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-foreground" /> Autonomous Content System · v1.0
          </span>
          <h1 className="mt-6 font-serif tracking-tight text-5xl sm:text-7xl leading-[0.95]">
            Your marketing<br />
            department,<br />
            <em className="text-muted-foreground">on autopilot.</em>
          </h1>
          <p className="mt-8 text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl">
            Pick your playbook. Brandie researches, writes, designs and sequences a full week of on-brand posts.
            You review in ten minutes on Monday. Done.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <Button asChild size="lg" className="rounded-full h-12 px-7 text-base">
              <Link to="/v2/onboarding">Start my engine <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="rounded-full h-12 px-6 text-base text-muted-foreground">
              <a href="#how">How it works</a>
            </Button>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">No card required · First week free · Cancel anytime</p>
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
            <div key={p.title} className="bg-background p-7 sm:p-9 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p.icon className="h-5 w-5 text-foreground" />
                <span className="text-[11px] tracking-[0.2em] text-muted-foreground">0{i + 1}</span>
              </div>
              <h3 className="font-serif text-2xl tracking-tight">{p.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
            </div>
          ))}
          <div className="bg-foreground text-background p-7 sm:p-9 flex flex-col justify-between gap-6">
            <h3 className="font-serif text-2xl tracking-tight">Ready to stop posting like it's your second job?</h3>
            <Button asChild variant="secondary" className="rounded-full self-start h-10 px-5">
              <Link to="/v2/onboarding">Start free <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* RITUAL */}
      <section className="border-t border-border bg-secondary/30">
        <div className="px-5 sm:px-8 py-20 sm:py-28 max-w-5xl mx-auto">
          <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground">The Monday ritual</p>
          <h2 className="mt-3 font-serif text-4xl sm:text-5xl tracking-tight">Ten minutes. Once a week.</h2>
          <ol className="mt-12 space-y-8 sm:space-y-10">
            {[
              { t: "08:00 — Notification", b: "Your weekly strategy is ready for approval." },
              { t: "08:02 — Review the Blueprint", b: "Five days. One narrative. Read it like a story." },
              { t: "08:06 — Edit conversationally", b: "“Swap Thursday for a restock post.” Brandie reworks just that one." },
              { t: "08:09 — Approve", b: "One tap. The engine handles the rest of the week." },
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

      {/* PRICE */}
      <section className="px-5 sm:px-8 py-20 sm:py-28 max-w-3xl mx-auto text-center">
        <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground">One plan, one price</p>
        <h2 className="mt-3 font-serif text-5xl sm:text-6xl tracking-tight">₦18,500 / month</h2>
        <p className="mt-4 text-muted-foreground">That's ₦600 a day. Cheaper than a plate of rice — runs your entire marketing department.</p>
        <Button asChild size="lg" className="rounded-full mt-10 h-12 px-7 text-base">
          <Link to="/v2/onboarding">Start free <ArrowRight className="h-4 w-4" /></Link>
        </Button>
        <p className="mt-4 text-xs text-muted-foreground">First week on us. Cancel in one click.</p>
      </section>
    </main>

    <footer className="border-t border-border">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <img src={brandieLogo} alt="" className="h-5 w-5" />
          <span>© {new Date().getFullYear()} Brandie</span>
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
