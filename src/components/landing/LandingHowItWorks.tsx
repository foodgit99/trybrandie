import { motion } from "framer-motion";
import step1 from "@/assets/landing-step-1.jpg";
import step2 from "@/assets/landing-step-2.jpg";
import step3 from "@/assets/landing-step-3.jpg";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: "easeOut" as const },
  }),
};

const steps = [
  { step: "01", title: "Set up your brand", desc: "Add your colours, logo, fonts, tone of voice, and target audience.", image: step1 },
  { step: "02", title: "Describe your design", desc: "Tell Brandie what you need in plain language — single posts or carousels.", image: step2 },
  { step: "03", title: "Refine and download", desc: "Edit via chat, upvote your favourites, and download in HD.", image: step3 },
];

const LandingHowItWorks = () => (
  <section className="max-w-5xl mx-auto px-4 sm:px-8 py-20 sm:py-28 text-center">
    <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} className="space-y-16">
      <div className="space-y-3">
        <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-serif tracking-tight">
          Three steps to stunning graphics
        </motion.h2>
        <motion.p variants={fadeUp} custom={1} className="text-muted-foreground">
          Your first design in under 3 minutes.
        </motion.p>
      </div>

      <div className="grid sm:grid-cols-3 gap-8">
        {steps.map((item, i) => (
          <motion.div key={item.step} variants={fadeUp} custom={i + 2} className="space-y-4">
            <div className="relative mx-auto w-32 h-32 sm:w-40 sm:h-40">
              <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent blur-lg pointer-events-none" />
              <img
                src={item.image}
                alt={item.title}
                className="relative w-full h-full object-cover rounded-2xl border border-border shadow-md"
                loading="lazy"
              />
            </div>
            <span className="text-4xl font-serif text-muted-foreground/30">{item.step}</span>
            <h3 className="text-lg font-serif">{item.title}</h3>
            <p className="text-sm text-muted-foreground">{item.desc}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  </section>
);

export default LandingHowItWorks;
