import LandingNav from "@/components/landing/LandingNav";
import LandingHero from "@/components/landing/LandingHero";
import LandingFeatures from "@/components/landing/LandingFeatures";
import LandingShowcase from "@/components/landing/LandingShowcase";
import LandingHowItWorks from "@/components/landing/LandingHowItWorks";
import LandingPricing from "@/components/landing/LandingPricing";
import LandingFAQ from "@/components/landing/LandingFAQ";
import LandingCTA from "@/components/landing/LandingCTA";
import LandingFooter from "@/components/landing/LandingFooter";

const Landing = () => (
  <div className="min-h-screen bg-background">
    <LandingNav />
    <LandingHero />
    <LandingFeatures />
    <LandingShowcase />
    <LandingHowItWorks />
    <LandingPricing />
    <LandingFAQ />
    <LandingCTA />
    <LandingFooter />
  </div>
);

export default Landing;
