import { motion } from "framer-motion";
import { Star } from "lucide-react";
import aminaPortrait from "@/assets/testimonial-amina.jpg";
import tundePortrait from "@/assets/testimonial-tunde.jpg";
import chiomaPortrait from "@/assets/testimonial-chioma.jpg";

const testimonials = [
  {
    quote:
      "It feels like an entire agency is working in the background while I focus on running my boutique. I haven't missed a posting day in three months.",
    name: "Amina O.",
    role: "Founder, Kinfolk Studio",
    location: "Lagos",
    photo: aminaPortrait,
  },
  {
    quote:
      "I used to spend Sunday nights stressing about what to post. Now my whole week is queued by Monday morning and it actually sounds like me.",
    name: "Tunde A.",
    role: "Owner, Lumen Kitchen",
    location: "Abuja",
    photo: tundePortrait,
  },
  {
    quote:
      "The designs are honestly better than anything my old freelancer made, and I get a fresh week of them every Monday without lifting a finger.",
    name: "Chioma E.",
    role: "Founder, Soft Beauty Studio",
    location: "Port Harcourt",
    photo: chiomaPortrait,
  },
];

const LandingTestimonials = () => (
  <section className="border-y border-border bg-secondary/30">
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-20 sm:py-28">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-14 space-y-3"
      >
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-background text-muted-foreground border border-border">
          <Star className="h-3 w-3 fill-current" />
          Loved by founders
        </span>
        <h2 className="text-3xl sm:text-4xl font-serif tracking-tight">
          The marketing room you never had to hire.
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Real founders, real boutiques, real Mondays handed back.
        </p>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
        {testimonials.map((t, i) => (
          <motion.figure
            key={t.name}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: i * 0.1 }}
            className="group relative rounded-2xl border border-border bg-card overflow-hidden flex flex-col"
          >
            <div className="relative aspect-[4/5] overflow-hidden bg-secondary/50">
              <img
                src={t.photo}
                alt={`${t.name}, ${t.role}`}
                loading="lazy"
                width={768}
                height={960}
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card/95 via-card/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star key={idx} className="h-3.5 w-3.5 fill-primary text-primary" />
                  ))}
                </div>
                <blockquote className="font-serif text-base sm:text-lg leading-snug text-foreground">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
              </div>
            </div>
            <figcaption className="px-5 sm:px-6 py-4 border-t border-border flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {t.location}
              </span>
            </figcaption>
          </motion.figure>
        ))}
      </div>
    </div>
  </section>
);

export default LandingTestimonials;
