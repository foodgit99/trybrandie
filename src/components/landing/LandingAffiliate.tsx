import { Link } from "react-router-dom";
import { TrendingUp, Users, Banknote, ArrowRight } from "lucide-react";

const LandingAffiliate = () => (
  <section className="px-4 sm:px-8 py-16 sm:py-24">
    <div className="max-w-5xl mx-auto">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-10">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="affiliate-dots" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#affiliate-dots)" />
          </svg>
        </div>

        <div className="relative flex flex-col lg:flex-row items-start lg:items-center gap-8">
          {/* Text content */}
          <div className="flex-1 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary)/0.1)] px-3 py-1 text-xs font-medium text-primary">
              <TrendingUp className="h-3.5 w-3.5" />
              Earn with Brandie
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Turn your audience into income
            </h2>
            <p className="text-muted-foreground text-base max-w-lg leading-relaxed">
              Join the Brandie Affiliate Program and earn up to 20% lifetime commissions — plus
              5% from every affiliate you recruit. Perfect for creators, agencies, and influencers.
            </p>
            <Link
              to="/affiliates"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Become an affiliate
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Stats row */}
          <div className="flex flex-row sm:flex-col gap-6 sm:gap-4 lg:min-w-[200px]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--primary)/0.1)] text-primary">
                <Banknote className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground leading-none">20%</p>
                <p className="text-xs text-muted-foreground mt-0.5">Direct commission</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--primary)/0.1)] text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground leading-none">5%</p>
                <p className="text-xs text-muted-foreground mt-0.5">Network commission</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default LandingAffiliate;
