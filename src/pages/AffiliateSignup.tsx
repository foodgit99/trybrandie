import SEO from "@/components/SEO";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import brandieLogo from "@/assets/brandie-logo.png";
import affiliateHero from "@/assets/affiliate-hero.jpg";
import {
  Users2,
  DollarSign,
  Link2,
  ArrowRight,
  Clock,
  TrendingUp,
  Shield,
  BarChart3,
  Zap,
  CheckCircle2,
  MapPin,
  Phone,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: "easeOut" as const },
  }),
};

const BENEFITS = [
  { icon: DollarSign, title: "20% First Payment", desc: "Earn 20% on every referral's first purchase — paid instantly." },
  { icon: Clock, title: "5% Lifetime Revenue", desc: "Keep earning 5% on all future payments for as long as your referral stays." },
  { icon: Users2, title: "2nd-Tier Commissions", desc: "Recruit affiliates and earn 5% first + 3% lifetime from their referrals." },
  { icon: BarChart3, title: "Real-Time Dashboard", desc: "Track referrals, conversions, and earnings with live performance data." },
  { icon: Link2, title: "Unique Links", desc: "Get personal referral and recruitment links to share anywhere." },
  { icon: Shield, title: "Monthly Payouts", desc: "Reliable monthly payout cycle directly to your bank account." },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Apply", desc: "Fill out the form below — approval takes less than 24 hours." },
  { step: "02", title: "Share", desc: "Get your unique link and share it across your channels." },
  { step: "03", title: "Earn", desc: "Earn commissions on every payment your referrals make." },
];

const IDEAL_FOR = [
  "Content Creators", "Social Media Managers", "Freelancers",
  "Agency Owners", "Community Leaders", "Tech Enthusiasts",
];

const AffiliateSignup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);

  const refCode = searchParams.get("ref") || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [location, setLocation] = useState("");

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let userId = user?.id;
      let userEmail = user?.email;

      if (!userId) {
        if (!fullName.trim() || !email.trim() || !password.trim()) {
          toast({ title: "Please fill in all required fields", variant: "destructive" });
          setLoading(false);
          return;
        }

        const { data: signupData, error: signupError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim(), whatsapp_number: whatsappNumber.trim() },
            emailRedirectTo: window.location.origin + "/affiliate",
          },
        });
        if (signupError) throw signupError;
        userId = signupData.user?.id;
        userEmail = email.trim();
        if (!userId) {
          toast({
            title: "Check your email",
            description: "Please confirm your email, then come back to apply.",
          });
          setLoading(false);
          return;
        }
      }

      const { data: existing } = await supabase
        .from("affiliates")
        .select("id, status")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        toast({
          title: existing.status === "approved" ? "Already approved!" : "Application pending",
          description:
            existing.status === "approved"
              ? "Redirecting to your dashboard…"
              : "Your application is being reviewed.",
        });
        if (existing.status === "approved") navigate("/affiliate");
        setLoading(false);
        return;
      }

      let recruitedBy: string | null = null;
      if (refCode) {
        const { data: recruiter } = await supabase
          .from("affiliates")
          .select("id")
          .eq("affiliate_code", refCode)
          .eq("status", "approved")
          .maybeSingle();
        if (recruiter) recruitedBy = recruiter.id;
      }

      const insertData: Record<string, unknown> = {
        user_id: userId,
        status: "pending",
        whatsapp_number: whatsappNumber.trim() || null,
        location: location.trim() || null,
      };
      if (recruitedBy) insertData.recruited_by = recruitedBy;

      const { error } = await supabase.from("affiliates").insert(insertData as any);
      if (error) throw error;

      // Send application received email to the new affiliate
      if (userEmail) {
        try {
          await supabase.functions.invoke("send-email", {
            body: {
              type: "affiliate_application_received",
              to: userEmail,
              data: { name: fullName.trim() || user?.user_metadata?.full_name || "" },
            },
          });
        } catch (emailErr) {
          console.error("Failed to send application email:", emailErr);
        }
      }

      // Notify admin(s) about the new application
      try {
        await supabase.functions.invoke("send-email", {
          body: {
            type: "affiliate_application_admin_notify",
            to: "__admins__",
            data: {
              name: fullName.trim() || user?.user_metadata?.full_name || "",
              email: userEmail || "",
              whatsapp: whatsappNumber.trim() || "",
              location: location.trim() || "",
              recruited_by: refCode || "",
            },
          },
        });
      } catch (emailErr) {
        console.error("Failed to send admin notification:", emailErr);
      }

      // Notify the recruiting affiliate that a new partner joined via their link
      if (recruitedBy) {
        try {
          // We can't look up the recruiter's email client-side (auth.users is private),
          // so we invoke send-email with the recruiter's user_id and let the edge function
          // resolve it. But since send-email expects a "to" email, we use a server-side
          // approach: invoke from the webhook context. Instead, we fire a lightweight
          // notification via the existing send-email by passing data and using the
          // recruiter's profile to find their email.
          // For now, we'll look up the recruiter's user_id and use it in a workaround:
          const { data: recruiterData } = await supabase
            .from("affiliates")
            .select("user_id")
            .eq("id", recruitedBy)
            .single();

          if (recruiterData?.user_id) {
            // We need the recruiter's email - use profiles or auth metadata
            // Since we can't access auth.users, we check if the current session has info
            // The safest approach: call send-email edge function which can resolve this server-side
            await supabase.functions.invoke("send-email", {
              body: {
                type: "affiliate_new_recruit",
                to: "__resolve_user__:" + recruiterData.user_id,
                data: {
                  recruit_name: fullName.trim() || email.trim(),
                  recruit_code: "",
                },
              },
            });
          }
        } catch (emailErr) {
          console.error("Failed to send recruit notification email:", emailErr);
        }
      }

      toast({
        title: "Application submitted! 🎉",
        description: "We'll review and get back to you within 24 hours.",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Friends of Brandie — Affiliate Program" description="Earn 20% first-month and 5% lifetime commission referring small businesses to Brandie." path="/affiliate/signup" />
      {/* ─── Nav ─── */}
      <nav className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 h-14">
          <button onClick={() => navigate("/")} className="flex items-center gap-2">
            <img src={brandieLogo} alt="Brandie" className="h-7 w-7" />
            <span className="font-serif text-lg tracking-tight">Brandie</span>
          </button>
          <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => navigate("/auth")}>
            Sign in
          </Button>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12 sm:pb-20">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <motion.div
              initial="hidden"
              animate="visible"
              className="space-y-6"
            >
              <motion.div variants={fadeUp} custom={0}>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  <Zap className="h-3 w-3" /> Friends of Brandie
                </span>
              </motion.div>
              <motion.h1
                variants={fadeUp}
                custom={1}
                className="text-4xl sm:text-5xl lg:text-[3.5rem] font-serif tracking-tight leading-[1.1]"
              >
                Earn while you{" "}
                <span className="italic text-primary/70">share</span>
              </motion.h1>
              <motion.p
                variants={fadeUp}
                custom={2}
                className="text-muted-foreground text-base sm:text-lg max-w-md leading-relaxed"
              >
                Join the Friends of Brandie affiliate program. Earn{" "}
                <strong className="text-foreground">20% on first payments</strong>,{" "}
                <strong className="text-foreground">5% lifetime revenue</strong>, and unlock
                second-tier commissions by recruiting other affiliates.
              </motion.p>
              <motion.div variants={fadeUp} custom={3} className="flex flex-wrap gap-4 pt-2">
                <a href="#apply" className="inline-flex">
                  <Button className="h-12 px-7 rounded-xl gap-2 text-sm">
                    Apply Now <ArrowRight className="h-4 w-4" />
                  </Button>
                </a>
                <a href="#how-it-works" className="inline-flex">
                  <Button variant="outline" className="h-12 px-7 rounded-xl text-sm">
                    How It Works
                  </Button>
                </a>
              </motion.div>
              <motion.div variants={fadeUp} custom={4} className="flex items-center gap-6 pt-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Free to join</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> No minimum sales</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Monthly payouts</span>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="relative hidden lg:block"
            >
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-primary/8 via-primary/4 to-transparent blur-2xl pointer-events-none" />
              <img
                src={affiliateHero}
                alt="Friends of Brandie affiliate program"
                width={1280}
                height={720}
                className="relative rounded-2xl border border-border shadow-xl"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Commission Breakdown ─── */}
      <section className="border-y border-border bg-secondary/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="text-center mb-12 space-y-3"
          >
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-serif tracking-tight">
              Two tiers. Maximum earnings.
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground max-w-lg mx-auto">
              A sustainable, performance-based model that rewards both direct referrals and network growth.
            </motion.p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Tier 1 */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={2}
              className="rounded-2xl border-2 border-primary/20 bg-card p-6 sm:p-8 space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-serif text-lg">Tier 1 — Direct</h3>
                  <p className="text-xs text-muted-foreground">Your personal referrals</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/60">
                  <span className="text-sm">First payment</span>
                  <span className="text-lg font-serif font-semibold">20%</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/60">
                  <span className="text-sm">Recurring payments</span>
                  <span className="text-lg font-serif font-semibold">5%</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Example: A ₦30,000 referral earns you ₦6,000 upfront + ₦1,500/month ongoing.
              </p>
            </motion.div>

            {/* Tier 2 */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={3}
              className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center">
                  <Users2 className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <h3 className="font-serif text-lg">Tier 2 — Network</h3>
                  <p className="text-xs text-muted-foreground">Affiliates you recruit</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/60">
                  <span className="text-sm">First payment</span>
                  <span className="text-lg font-serif font-semibold">5%</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/60">
                  <span className="text-sm">Recurring payments</span>
                  <span className="text-lg font-serif font-semibold">3%</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Earn passively from every sale made by affiliates in your network.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Benefits Grid ─── */}
      <section className="py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="text-center mb-12 space-y-3"
          >
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-serif tracking-tight">
              Why partners love Brandie
            </motion.h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {BENEFITS.map((b, i) => (
              <motion.div
                key={b.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-40px" }}
                variants={fadeUp}
                custom={i + 1}
                className="rounded-2xl border border-border bg-card p-6 space-y-3"
              >
                <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center">
                  <b.icon className="h-5 w-5 text-foreground" />
                </div>
                <h3 className="font-medium">{b.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="border-y border-border bg-secondary/30 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="text-center mb-12 space-y-3"
          >
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-serif tracking-tight">
              Three steps to start earning
            </motion.h2>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((s, i) => (
              <motion.div
                key={s.step}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i + 1}
                className="text-center space-y-3"
              >
                <div className="text-4xl font-serif text-primary/20">{s.step}</div>
                <h3 className="text-lg font-serif">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Ideal For ─── */}
      <section className="py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-3xl sm:text-4xl font-serif tracking-tight mb-8"
          >
            Perfect for
          </motion.h2>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="flex flex-wrap justify-center gap-3"
          >
            {IDEAL_FOR.map((tag, i) => (
              <motion.span
                key={tag}
                variants={fadeUp}
                custom={i + 1}
                className="px-4 py-2 rounded-full border border-border bg-card text-sm font-medium"
              >
                {tag}
              </motion.span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── Application Form ─── */}
      <section id="apply" className="border-t border-border bg-secondary/30 py-16 sm:py-20">
        <div className="max-w-lg mx-auto px-4 sm:px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="space-y-8"
          >
            <motion.div variants={fadeUp} custom={0} className="text-center space-y-3">
              <h2 className="text-3xl sm:text-4xl font-serif tracking-tight">
                {user ? "Apply as Affiliate" : "Join the program"}
              </h2>
              <p className="text-muted-foreground text-sm">
                Fill in your details — we'll review and approve within 24 hours.
              </p>
            </motion.div>

            <motion.div variants={fadeUp} custom={1}>
              <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-6">
                {refCode && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary rounded-xl px-4 py-2.5">
                    <Users2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Invited by affiliate: <span className="font-mono font-medium text-foreground">{refCode}</span></span>
                  </div>
                )}

                <form onSubmit={handleApply} className="space-y-4">
                  {!user && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full name <span className="text-destructive">*</span></Label>
                        <Input
                          id="fullName"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Jane Smith"
                          required
                          maxLength={100}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          required
                          maxLength={255}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password <span className="text-destructive">*</span></Label>
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          minLength={6}
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="whatsapp" className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> WhatsApp Number
                    </Label>
                    <Input
                      id="whatsapp"
                      type="tel"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="+234 801 234 5678"
                      maxLength={20}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location" className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> Location
                    </Label>
                    <Input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Lagos, Nigeria"
                      maxLength={100}
                    />
                  </div>

                  <Button type="submit" className="w-full h-12 rounded-xl gap-2 text-sm" disabled={loading}>
                    {loading ? "Submitting…" : "Submit Application"}
                    {!loading && <ArrowRight className="h-4 w-4" />}
                  </Button>
                </form>

                {!user && (
                  <p className="text-center text-xs text-muted-foreground">
                    Already have an account?{" "}
                    <button
                      onClick={() => navigate("/auth")}
                      className="underline underline-offset-4 hover:text-foreground transition-colors"
                    >
                      Sign in
                    </button>{" "}
                    then come back here.
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Brandie. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default AffiliateSignup;
