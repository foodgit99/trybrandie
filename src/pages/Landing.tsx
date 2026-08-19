import LandingNav from "@/components/landing/LandingNav";
import LandingHero from "@/components/landing/LandingHero";
import LandingFeatures from "@/components/landing/LandingFeatures";
import LandingShowcase from "@/components/landing/LandingShowcase";
import LandingTestimonials from "@/components/landing/LandingTestimonials";
import LandingHowItWorks from "@/components/landing/LandingHowItWorks";
import LandingPricing from "@/components/landing/LandingPricing";
import LandingFAQ from "@/components/landing/LandingFAQ";
import LandingAffiliate from "@/components/landing/LandingAffiliate";
import LandingCTA from "@/components/landing/LandingCTA";
import LandingFooter from "@/components/landing/LandingFooter";
import SEO from "@/components/SEO";
import TawkToWidget from "@/components/TawkToWidget";
import CampaignBanner from "@/components/campaign/CampaignBanner";


const faqs = [
  { q: "What exactly is Brandie?", a: "Brandie is an autonomous content system for small businesses. You pick a playbook for your industry, hit start, and Brandie generates a full week of on-brand social posts for you, every week, on its own." },
  { q: "Do I need design or marketing skills?", a: "No. If you can pick your industry and upload a logo, you're done. Brandie handles the strategy, copy, and design. You just approve what you like." },
  { q: "How long does it take to set up?", a: "Under 60 seconds. You choose a playbook, add your brand name, drop in a logo, and your engine starts generating your first week of content immediately." },
  { q: "Will the posts actually look like my brand?", a: "Yes. Brandie locks your colours, fonts, logo, and tone into every post. The more you use it and react to designs, the sharper it gets at sounding and looking like you." },
  { q: "Can I edit or approve posts before they go out?", a: "Always. Nothing leaves your queue without you. You can tweak copy, swap visuals, reschedule, or delete any post in one click, or let the engine handle everything end to end." },
  { q: "What if I run out of ideas?", a: "You won't. Your engine refills the queue automatically based on your industry playbook, trending formats, and the calendar (holidays, seasons, launches). The blank page is gone." },
  { q: "Is it free to try?", a: "Yes. You can start free, no credit card required, and generate your first week of content right away. Upgrade only when you want more volume or more brands." },
  { q: "Can I use it for more than one brand?", a: "Yes, on the Creator and Agency plans. Each brand gets its own playbook, memory, and queue, fully separated." },
  { q: "Where does the content get published?", a: "Today, Brandie generates and queues your content for you to download or copy across to Instagram, Facebook, LinkedIn, and X. Direct auto-publishing is on the roadmap." },
  { q: "Can I cancel anytime?", a: "Yes. No contracts, no lock-in. Cancel from your settings in one click and keep everything you've created." },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const Landing = () => (
  <div className="min-h-screen bg-background">
    <SEO
      title="Brandie, Autonomous content system for small businesses"
      description="Pick a playbook, hit start, and a full week of on-brand social posts is generated, sequenced, and waiting for you, every week, on its own."
      path="/"
      jsonLd={faqJsonLd}
    />
    <CampaignBanner />
    <LandingNav />

    <main>
      <LandingHero />
      <LandingFeatures />
      <LandingShowcase />
      <LandingTestimonials />
      <LandingHowItWorks />
      <LandingPricing />
      <LandingFAQ />
      <LandingCTA />
      <LandingAffiliate />
    </main>
    <LandingFooter />
    <TawkToWidget />
  </div>
);

export default Landing;
