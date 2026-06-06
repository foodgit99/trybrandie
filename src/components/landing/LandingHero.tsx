import { motion } from "framer-motion";
import { Power, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import heroPremium from "@/assets/landing-hero-premium.jpg";

const LandingHero = () => {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-8 pt-16 sm:pt-24 pb-12 text-center space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-secondary text-muted-foreground border border-border">
            <Power className="h-3 w-3" />
            Autonomous Content System
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-5xl md:text-6xl font-serif tracking-tight leading-[1.05]"
        >
          Stop posting.
          <br />
          <span className="text-muted-foreground">Start running an engine.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto"
        >
          Brandie is an autonomous content system for small businesses. Pick a playbook, hit start, and a full week of on-brand posts is generated, sequenced, and waiting for you, every week, on its own.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-3 items-center justify-center pt-2"
        >
          <Button
            size="lg"
            className="h-12 px-7 rounded-xl gap-2"
            onClick={() => navigate("/auth?mode=signup")}
          >
            <Power className="h-4 w-4" />
            Start your engine
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="h-12 px-5 rounded-xl text-muted-foreground"
            onClick={() => navigate("/auth")}
          >
            Sign in
          </Button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-xs text-muted-foreground"
        >
          Free to start · No credit card · First week of content generated in under 60 seconds
        </motion.p>
      </div>

      {/* Engine status preview card, premium signature visual */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.5 }}
        className="relative max-w-5xl mx-auto px-4 sm:px-8 pb-16"
      >
        <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-b from-primary/15 via-primary/5 to-transparent blur-2xl pointer-events-none" />

        <div className="relative rounded-2xl border border-border bg-card/95 backdrop-blur-sm shadow-2xl overflow-hidden">
          {/* Engine status bar */}
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
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Live
            </span>
          </div>

          {/* This week's plan */}
          <div className="grid sm:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-border">
            {[
              { day: "Mon", label: "Motivation", state: "done" },
              { day: "Tue", label: "Class promo", state: "next" },
              { day: "Wed", label: "Form check", state: "queued" },
              { day: "Thu", label: "Transformation", state: "queued" },
              { day: "Fri", label: "Weekend hype", state: "queued" },
              { day: "Sat", label: "Recovery tip", state: "queued" },
              { day: "Sun", label: "Member story", state: "queued" },
            ].map((d) => (
              <div key={d.day} className="px-3 py-3 sm:py-4 flex sm:flex-col sm:items-start gap-2 sm:gap-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground w-10 sm:w-auto">{d.day}</p>
                <p className="text-xs font-medium truncate flex-1">{d.label}</p>
                {d.state === "done" && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                {d.state === "next" && (
                  <span className="text-[10px] font-medium text-primary bg-primary/10 rounded-full px-1.5 py-0.5 shrink-0">Next</span>
                )}
                {d.state === "queued" && (
                  <Loader2 className="h-3 w-3 text-muted-foreground/40 shrink-0 sm:opacity-0" />
                )}
              </div>
            ))}
          </div>

          {/* Generated designs preview */}
          <div className="relative h-48 sm:h-72 overflow-hidden">
            <img
              src={heroDesigns}
              alt="A week of on-brand designs auto-generated by Brandie"
              className="w-full h-full object-cover"
              width={1408}
              height={768}
              fetchPriority="high"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default LandingHero;
