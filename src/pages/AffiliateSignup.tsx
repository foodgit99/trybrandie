import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import brandieLogo from "@/assets/brandie-logo.png";
import { Users, DollarSign, Link2, ArrowRight } from "lucide-react";

const AffiliateSignup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // For non-logged-in users
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let userId = user?.id;

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

      // Create affiliate record
      const { error } = await supabase.from("affiliates").insert({
        user_id: userId,
        status: "pending",
      });

      if (error) throw error;

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
            Become a Brandie Affiliate
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Earn <span className="font-semibold text-foreground">20% commission</span> on every payment from users you refer. Share your link, grow your income.
          </p>
        </motion.div>

        {/* Benefits */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-12"
        >
          {[
            { icon: DollarSign, title: "20% Commission", desc: "Earn on every payment your referrals make — recurring." },
            { icon: Users, title: "Real-time Tracking", desc: "See signups, conversions and earnings in your dashboard." },
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

export default AffiliateSignup;
