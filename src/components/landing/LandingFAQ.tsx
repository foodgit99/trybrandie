import { motion } from "framer-motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    q: "What exactly is Brandie?",
    a: "Brandie is an autonomous content system for small businesses. You pick a playbook for your industry, hit start, and Brandie generates a full week of on-brand social posts for you, every week, on its own.",
  },
  {
    q: "Do I need design or marketing skills?",
    a: "No. If you can pick your industry and upload a logo, you're done. Brandie handles the strategy, copy, and design. You just approve what you like.",
  },
  {
    q: "How long does it take to set up?",
    a: "Under 60 seconds. You choose a playbook, add your brand name, drop in a logo, and your engine starts generating your first week of content immediately.",
  },
  {
    q: "Will the posts actually look like my brand?",
    a: "Yes. Brandie locks your colours, fonts, logo, and tone into every post. The more you use it and react to designs, the sharper it gets at sounding and looking like you.",
  },
  {
    q: "Can I edit or approve posts before they go out?",
    a: "Always. Nothing leaves your queue without you. You can tweak copy, swap visuals, reschedule, or delete any post in one click, or let the engine handle everything end to end.",
  },
  {
    q: "What if I run out of ideas?",
    a: "You won't. Your engine refills the queue automatically based on your industry playbook, trending formats, and the calendar (holidays, seasons, launches). The blank page is gone.",
  },
  {
    q: "Is it free to try?",
    a: "Yes. You can start free, no credit card required, and generate your first week of content right away. Upgrade only when you want more volume or more brands.",
  },
  {
    q: "Can I use it for more than one brand?",
    a: "Yes, on the Creator and Agency plans. Each brand gets its own playbook, memory, and queue, fully separated.",
  },
  {
    q: "Where does the content get published?",
    a: "Today, Brandie generates and queues your content for you to download or copy across to Instagram, Facebook, LinkedIn, and X. Direct auto-publishing is on the roadmap.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. No contracts, no lock-in. Cancel from your settings in one click and keep everything you've created.",
  },
];

const LandingFAQ = () => (
  <section id="faq" className="py-20 sm:py-28 border-t border-border">
    <div className="max-w-3xl mx-auto px-4 sm:px-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-center space-y-3 mb-12"
      >
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-secondary text-muted-foreground border border-border">
          Questions
        </span>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif tracking-tight">
          Everything you're wondering, answered.
        </h2>
        <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
          Plain English. No jargon. If something's still unclear, just start the engine, it's free.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm px-2 sm:px-6"
      >
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border-border last:border-b-0">
              <AccordionTrigger className="text-left text-base sm:text-lg font-medium hover:no-underline py-5">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm sm:text-base leading-relaxed pb-5">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </motion.div>
    </div>
  </section>
);

export default LandingFAQ;
