import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Plus, Palette, Gift, Copy, Check, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppHeader from "@/components/AppHeader";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: designs } = useQuery({
    queryKey: ["recent-designs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile-referral", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("referral_code, bonus_credits")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const referralLink = profile?.referral_code
    ? `https://trybrandie.com/auth?ref=${profile.referral_code}`
    : "";

  const handleCopy = async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({ title: "Link copied!", description: "Share it with friends to earn 5 bonus credits each." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-10 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-10 sm:space-y-12"
        >
          {/* Hero CTA */}
          <section className="text-center space-y-4">
            <h2 className="text-3xl sm:text-4xl font-serif tracking-tight">What will you design today?</h2>
            <p className="text-muted-foreground max-w-md mx-auto text-sm sm:text-base">
              Describe what you need and your AI creative director will bring it to life — always on brand.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-4">
              <Button size="lg" className="h-12 px-8 rounded-xl gap-2 w-full sm:w-auto" onClick={() => navigate("/studio")}>
                <Plus className="h-4 w-4" />
                Create New Design
              </Button>
              <Button variant="outline" size="lg" className="h-12 px-6 rounded-xl gap-2 w-full sm:w-auto" onClick={() => navigate("/brand")}>
                <Palette className="h-4 w-4" />
                Brand Centre
              </Button>
            </div>
          </section>

          {/* Referral Banner */}
          {profile?.referral_code && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-6"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Gift className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Earn 5 bonus credits per friend</h3>
                  <p className="text-xs text-muted-foreground">
                    Share your link — when they sign up, you both win.
                    {(profile.bonus_credits ?? 0) > 0 && (
                      <span className="ml-1 font-medium text-primary">
                        You've earned {profile.bonus_credits} bonus credits so far!
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-lg gap-1.5 h-9"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy Link"}
                </Button>
              </div>
            </motion.section>
          )}

          {/* Recent Designs */}
          <section className="space-y-4">
            <h3 className="text-lg font-medium text-foreground">Recent designs</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {(!designs || designs.length === 0) ? (
                [1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-xl bg-secondary/60 border border-border flex items-center justify-center"
                  >
                    <span className="text-sm text-muted-foreground">No designs yet</span>
                  </div>
                ))
              ) : (
                designs.map((design) => (
                  <div
                    key={design.id}
                    className="aspect-square rounded-xl border border-border overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all"
                    onClick={() => navigate(`/studio?design=${design.id}`)}
                  >
                    <img
                      src={design.image_url}
                      alt={design.title || design.prompt}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))
              )}
            </div>
          </section>
        </motion.div>
      </main>
    </div>
  );
};

export default Index;
