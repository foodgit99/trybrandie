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
import { Users, DollarSign, Link2, ArrowRight, Users2 } from "lucide-react";

const AffiliateSignup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);

  const refCode = searchParams.get("ref") || "";

  // For non-logged-in users
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let userId = user?.id;
      let userEmail = user?.email;

      // If not logged in, create account first
      if (!userId) {
        const { data: signupData, error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin + "/affiliate",
          },
        });
        if (signupError) throw signupError;
        userId = signupData.user?.id;
        userEmail = email;
        if (!userId) {
          toast({
            title: "Check your email",
            description: "Please confirm your email, then come back to apply.",
          });
          setLoading(false);
          return;
        }
      }

      // Check if already an affiliate
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

      // Look up recruiting affiliate if ref code provided
      let recruitedBy: string | null = null;
      if (refCode) {
        const { data: recruiter } = await supabase
          .from("affiliates")
          .select("id")
          .eq("affiliate_code", refCode)
          .eq("status", "approved")
          .maybeSingle();
        if (recruiter) {
          recruitedBy = recruiter.id;
        }
      }

      // Create affiliate record
      const insertData: any = {
        user_id: userId,
        status: "pending",
      };
      if (recruitedBy) {
        insertData.recruited_by = recruitedBy;
      }

      const { error } = await supabase.from("affiliates").insert(insertData);

      if (error) throw error;

      // Send application received email
      if (userEmail) {
        try {
          await supabase.functions.invoke("send-email", {
            body: {
              type: "affiliate_application_received",
              to: userEmail,
              data: { name: fullName || user?.user_metadata?.full_name || "" },
            },
          });
        } catch (emailErr) {
          console.error("Failed to send application email:", emailErr);
        }
      }

      toast({
        title: "Application submitted!",
        description: "We'll review your application and get back to you shortly.",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <img src={brandieLogo} alt="Brandie" className="h-12 w-12 mx-auto mb-4" />
          <h1 className="text-3xl sm:text-4xl font-serif tracking-tight mb-3">
            Become a Friend of Brandie
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Earn <span className="font-semibold text-foreground">20% on first payments</span> and{" "}
            <span className="font-semibold text-foreground">5% lifetime</span> on every user you refer.
            Plus, earn second-tier commissions by recruiting other affiliates.
          </p>
        </motion.div>

        {/* Benefits */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12"
        >
          {[
            { icon: DollarSign, title: "20% First Payment", desc: "Earn 20% commission on every referral's first payment." },
            { icon: Clock, title: "5% Lifetime", desc: "Keep earning 5% on all future payments your referrals make." },
            { icon: Users2, title: "Recruit & Earn More", desc: "Earn 5% first + 3% lifetime from affiliates you recruit." },
            { icon: Link2, title: "Unique Affiliate Link", desc: "Get a personal link to share across your channels." },
          ].map((b) => (
            <div key={b.title} className="rounded-2xl border border-border p-6 text-center space-y-2">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                <b.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-medium">{b.title}</h3>
              <p className="text-sm text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </motion.div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="max-w-md mx-auto"
        >
          <div className="rounded-2xl border border-border p-6 sm:p-8 space-y-6">
            <h2 className="text-xl font-serif tracking-tight text-center">
              {user ? "Apply as Affiliate" : "Create Affiliate Account"}
            </h2>

            {refCode && (
              <p className="text-center text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
                Referred by affiliate: <span className="font-mono font-medium">{refCode}</span>
              </p>
            )}

            <form onSubmit={handleApply} className="space-y-4">
              {!user && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Smith" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
                  </div>
                </>
              )}

              <Button type="submit" className="w-full h-11 rounded-xl gap-2" disabled={loading}>
                {loading ? "Submitting…" : "Apply Now"}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>

            {!user && (
              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{" "}
                <button onClick={() => navigate("/auth")} className="underline underline-offset-4 hover:text-foreground transition-colors">
                  Sign in
                </button>{" "}
                then come back here.
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

// Need Clock import
import { Clock } from "lucide-react";

export default AffiliateSignup;
