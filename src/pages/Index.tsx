import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Plus, Palette, Gift, Copy, Check, X, Twitter, MessageCircle, Layers, ArrowRight, CalendarDays, Clock, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppHeader from "@/components/AppHeader";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useBrand } from "@/hooks/useBrand";
import { Badge } from "@/components/ui/badge";

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { brand } = useBrand();
  const [copied, setCopied] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(() => sessionStorage.getItem("referral-banner-dismissed") === "true");

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
        .select("referral_code, bonus_credits, full_name")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const todayISO = new Date().toISOString().split("T")[0];

  const { data: todaysContent } = useQuery({
    queryKey: ["todays-content", brand?.id, todayISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_ideas")
        .select("id, title, prompt, idea_type, status")
        .eq("brand_id", brand!.id)
        .eq("scheduled_for", todayISO)
        .in("status", ["suggested", "scheduled"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!brand,
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

  const todayFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const quickActions = [
    { label: "New Design", icon: Plus, path: "/studio", description: "Start creating" },
    { label: "Content Hub", icon: Layers, path: "/content", description: "Plan your posts" },
    { label: "Brand Centre", icon: Palette, path: "/brand", description: "Manage identity" },
    { label: "Design History", icon: Clock, path: "/history", description: "Past creations" },
  ];

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
            <p className="text-sm text-muted-foreground">
              {(() => {
                const hour = new Date().getHours();
                const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
                const firstName = profile?.full_name?.split(" ")[0];
                return firstName ? `${greeting}, ${firstName} 👋` : `${greeting} 👋`;
              })()}
            </p>
            <h2 className="text-3xl sm:text-4xl font-serif tracking-tight">What will you design today?</h2>
            <p className="text-muted-foreground max-w-md mx-auto text-sm sm:text-base">
              Describe what you need and your AI creative director will bring it to life — always on brand.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-4">
              <Button size="lg" className="h-12 px-8 rounded-xl gap-2 w-full sm:w-auto" onClick={() => navigate("/studio")}>
                <Plus className="h-4 w-4" />
                Create New Design
              </Button>
              <Button variant="outline" size="lg" className="h-12 px-6 rounded-xl gap-2 w-full sm:w-auto" onClick={() => navigate("/content")}>
                <Layers className="h-4 w-4" />
                Content Hub
              </Button>
              <Button variant="outline" size="lg" className="h-12 px-6 rounded-xl gap-2 w-full sm:w-auto" onClick={() => navigate("/brand")}>
                <Palette className="h-4 w-4" />
                Brand Centre
              </Button>
            </div>
          </section>

          {/* Today's Content */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                  <CalendarDays className="h-4.5 w-4.5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Today's Content</h3>
                  <p className="text-xs text-muted-foreground">{todayFormatted}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={() => navigate("/content")}>
                Content Hub
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>

            {(!todaysContent || todaysContent.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                <Sparkles className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No content scheduled for today</p>
                <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => navigate("/content")}>
                  Plan content in Hub
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {todaysContent.map((idea) => (
                  <div
                    key={idea.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/30 px-4 py-3 group hover:bg-secondary/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant="secondary" className="shrink-0 text-[10px] uppercase tracking-wider font-medium">
                        {idea.idea_type}
                      </Badge>
                      <span className="text-sm font-medium text-foreground truncate">{idea.title}</span>
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0 rounded-lg gap-1.5 h-8 text-xs"
                      onClick={() => navigate(`/studio?prompt=${encodeURIComponent(idea.prompt)}`)}
                    >
                      <Sparkles className="h-3 w-3" />
                      Create
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </motion.section>

          {/* Referral Banner */}
          {profile?.referral_code && !bannerDismissed && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-6"
            >
              <button
                onClick={() => {
                  setBannerDismissed(true);
                  sessionStorage.setItem("referral-banner-dismissed", "true");
                }}
                className="absolute top-3 right-3 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pr-6">
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
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 rounded-lg gap-1.5 h-9"
                    onClick={handleCopy}
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy Link"}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-lg"
                    onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent("I've been using Brandie to create stunning branded graphics with AI — try it out and we both get 5 bonus credits! " + referralLink)}`, "_blank")}
                    aria-label="Share on X"
                  >
                    <Twitter className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-lg"
                    onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent("Hey! I've been using Brandie to create AI-powered branded graphics. Sign up with my link and we both get 5 bonus credits: " + referralLink)}`, "_blank")}
                    aria-label="Share on WhatsApp"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </Button>
                </div>
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
            {designs && designs.length > 0 && (
              <div className="flex justify-center pt-1">
                <Button
                  variant="outline"
                  className="rounded-xl gap-2 text-sm"
                  onClick={() => navigate("/history")}
                >
                  View All Designs
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </section>

          {/* Quick Actions */}
          <section className="space-y-4">
            <h3 className="text-lg font-medium text-foreground">Quick actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {quickActions.map((action) => (
                <button
                  key={action.path}
                  onClick={() => navigate(action.path)}
                  className="group flex flex-col items-center gap-2.5 rounded-2xl border border-border bg-card p-5 hover:bg-secondary/60 hover:border-primary/30 transition-all text-center"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                    <action.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{action.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{action.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </motion.div>
      </main>
    </div>
  );
};

export default Index;
