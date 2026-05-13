import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useBrand } from "@/hooks/useBrand";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { ArrowLeft, User, Palette, CreditCard, LogOut, Sun, Moon, Monitor, Gift, Copy, Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import AppHeader from "@/components/AppHeader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  const { user, signOut } = useAuth();
  const { brand } = useBrand(user);
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile-settings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("referral_code, bonus_credits, subscription_tier")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: referralCount = 0 } = useQuery({
    queryKey: ["referral-count", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("referral_rewards" as any)
        .select("*", { count: "exact", head: true })
        .eq("referrer_user_id", user!.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  const referralLink = profile?.referral_code
    ? `https://trybrandie.com/auth?ref=${(profile as any).referral_code}`
    : "";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({ title: "Referral link copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Settings — Brandie" description="Manage your account, preferences, and notifications." path="/settings" noindex />
      <AppHeader />

      <main className="max-w-2xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-8"
        >
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-xl">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-2xl sm:text-3xl font-serif tracking-tight">Settings</h2>
          </div>

          {/* Account */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Account</h3>
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{user?.user_metadata?.full_name || "User"}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* Brand */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Brand</h3>
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {brand?.logo_url ? (
                    <img src={brand.logo_url} alt="Logo" className="h-10 w-10 rounded-lg object-contain bg-secondary" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Palette className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium">{brand?.name || "No brand"}</p>
                    <p className="text-xs text-muted-foreground">{brand?.tagline || "Set up your brand"}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate("/brand")}>
                  Edit
                </Button>
              </div>
            </div>
          </section>

          <Separator />

          {/* Plan */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Plan</h3>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium capitalize">{profile?.subscription_tier ?? "Free"} Plan</p>
                    <p className="text-xs text-muted-foreground">
                      5 free credits renew monthly
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate("/plans")}>
                  Upgrade
                </Button>
              </div>
            </div>
          </section>

          <Separator />

          {/* Appearance */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Appearance</h3>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Theme</p>
                  <p className="text-xs text-muted-foreground">Choose your preferred look</p>
                </div>
                <div className="flex items-center gap-1 rounded-xl bg-secondary p-1">
                  {[
                    { value: "light", icon: Sun, label: "Light" },
                    { value: "dark", icon: Moon, label: "Dark" },
                    { value: "system", icon: Monitor, label: "System" },
                  ].map(({ value, icon: Icon, label }) => (
                    <Button
                      key={value}
                      variant={theme === value ? "default" : "ghost"}
                      size="sm"
                      className="h-8 px-3 rounded-lg gap-1.5 text-xs"
                      onClick={() => setTheme(value)}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* Refer a Friend */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Refer a Friend</h3>
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Gift className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Earn 5 free credits per referral</p>
                  <p className="text-xs text-muted-foreground">Share your link — when they sign up, you get rewarded.</p>
                </div>
              </div>

              {referralLink && (
                <>
                  <div className="flex items-center gap-2">
                    <Input
                      value={referralLink}
                      readOnly
                      className="text-xs font-mono bg-secondary"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0 rounded-xl"
                      onClick={handleCopyLink}
                    >
                      {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs gap-1.5"
                      onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent("Hey! I've been using Brandie to create AI-powered branded graphics. Sign up with my link and we both get 5 bonus credits: " + referralLink)}`, "_blank")}
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      WhatsApp
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs gap-1.5"
                      onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent("I've been using Brandie to create stunning branded graphics with AI — try it out and we both get 5 bonus credits! " + referralLink)}`, "_blank")}
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      X / Twitter
                    </Button>
                  </div>
                </>
              )}

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span><strong className="text-foreground">{referralCount}</strong> referral{referralCount !== 1 ? "s" : ""}</span>
                <span><strong className="text-foreground">{(profile as any)?.bonus_credits ?? 0}</strong> bonus credits earned</span>
              </div>
            </div>
          </section>

          <Separator />

          {/* Sign out */}
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </motion.div>
      </main>
    </div>
  );
};

export default Settings;
