import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import brandieLogo from "@/assets/brandie-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

type Mode = "login" | "signup" | "forgot";

const Auth = () => {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [affiliateCode, setAffiliateCode] = useState<string | null>(null);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      setReferralCode(ref);
      setMode("signup");
    }
    const aff = searchParams.get("aff");
    if (aff) {
      setAffiliateCode(aff);
      setMode("signup");
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    } else {
      navigate("/");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          ...(referralCode && { referred_by: referralCode }),
          ...(affiliateCode && { affiliate_code: affiliateCode }),
        },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Check your email", description: "We sent you a confirmation link." });
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Check your email", description: "We sent you a password reset link." });
    }
  };

  const onSubmit = mode === "login" ? handleLogin : mode === "signup" ? handleSignup : handleForgotPassword;

  return (
    <div className="flex min-h-screen">
      {/* Left — branding */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-secondary">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="max-w-md px-12 text-center"
        >
          <img src={brandieLogo} alt="Brandie" className="h-16 w-16 mx-auto mb-4" />
          <h1 className="text-5xl font-serif tracking-tight text-foreground mb-4">Brandie</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Your AI creative director. Beautiful, on-brand social graphics — every time.
          </p>
        </motion.div>
      </div>

      {/* Right — form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-sm space-y-8"
        >
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-serif tracking-tight mb-2">
              {mode === "login" && "Welcome back"}
              {mode === "signup" && "Create your account"}
              {mode === "forgot" && "Reset password"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {mode === "login" && "Sign in to continue designing."}
              {mode === "signup" && "Start building your brand in minutes."}
              {mode === "forgot" && "Enter your email and we'll send a reset link."}
            </p>
          </div>

          <AnimatePresence mode="wait">
            <motion.form
              key={mode}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25 }}
              onSubmit={onSubmit}
              className="space-y-5"
            >
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Smith"
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>

              {mode !== "forgot" && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
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
              )}

              <Button type="submit" className="w-full h-11 rounded-xl" disabled={loading}>
                {loading
                  ? "Please wait…"
                  : mode === "login"
                  ? "Sign in"
                  : mode === "signup"
                  ? "Create account"
                  : "Send reset link"}
              </Button>
            </motion.form>
          </AnimatePresence>

          <div className="text-center text-sm text-muted-foreground space-y-2">
            {mode === "login" && (
              <>
                <button onClick={() => setMode("forgot")} className="underline underline-offset-4 hover:text-foreground transition-colors">
                  Forgot password?
                </button>
                <p>
                  Don't have an account?{" "}
                  <button onClick={() => setMode("signup")} className="underline underline-offset-4 hover:text-foreground transition-colors">
                    Sign up
                  </button>
                </p>
              </>
            )}
            {(mode === "signup" || mode === "forgot") && (
              <p>
                Back to{" "}
                <button onClick={() => setMode("login")} className="underline underline-offset-4 hover:text-foreground transition-colors">
                  Sign in
                </button>
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
