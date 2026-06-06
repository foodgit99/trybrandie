import { motion } from "framer-motion";
import { Power, Sparkles, Coffee } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: "easeOut" as const },
  }),
};

const steps = [
  {
    step: "01",
    title: "Pick a playbook",
    desc: "Choose the industry that matches your business - Restaurants, Beauty, Fitness, Retail, Services. Brandie loads the right cadence and content mix instantly.",
    icon: Sparkles,
  },
  {
    step: "02",
    title: "Hit start",
    desc: "The engine boots, generates your first 7 posts, and sets a weekly rhythm - calibrated to your brand colours, voice, and audience.",
    icon: Power,
  },
  {
    step: "03",
    title: "Let it run",
    desc: "Every week, fresh on-brand content lands in your queue automatically. Review, tweak, post. Or sit back and let the engine handle it.",
    icon: Coffee,
  },
];

const LandingHowItWorks = () => (
  <section className="max-w-5xl mx-auto px-4 sm:px-8 py-20 sm:py-28">
    <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} className="space-y-16">
      <div className="space-y-3 text-center">
        <motion.span
          variants={fadeUp}
          custom={0}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-secondary text-muted-foreground border border-border"
        >
          <Power className="h-3 w-3" />
          How the engine works
        </motion.span>
        <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-serif tracking-tight">
          Three minutes to switch it on. Forever to switch it off.
        </motion.h2>
        <motion.p variants={fadeUp} custom={2} className="text-muted-foreground max-w-lg mx-auto">
          No briefs. No prompts. No blank canvas. Brandie runs in the background - like infrastructure for your marketing.
        </motion.p>
      </div>

      <div className="grid sm:grid-cols-3 gap-5">
        {steps.map((item, i) => (
          <motion.div
            key={item.step}
            variants={fadeUp}
            custom={i + 3}
            className="relative rounded-2xl border border-border bg-card p-6 sm:p-7 space-y-4 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <item.icon className="h-4.5 w-4.5 text-primary" />
              </div>
              <span className="text-3xl font-serif text-muted-foreground/20">{item.step}</span>
            </div>
            <h3 className="text-lg font-serif">{item.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  </section>
);

export default LandingHowItWorks;
