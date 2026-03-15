import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  Sparkles,
  RefreshCw,
  ArrowRight,
  Calendar,
  Loader2,
  Layers,
  Repeat,
  Megaphone,
  Lightbulb,
  Check,
  SkipForward,
} from "lucide-react";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
};

const ContentHub = () => {
  const { user } = useAuth();
  const { brand } = useBrand();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [generating, setGenerating] = useState<string | null>(null);
  const [initialSetupDone, setInitialSetupDone] = useState(false);

  const brandId = brand?.id;

  // --- Queries ---
  const { data: pillars, isLoading: pillarsLoading } = useQuery({
    queryKey: ["content-pillars", brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_pillars")
        .select("*")
        .eq("brand_id", brandId!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!brandId,
  });

  const { data: series, isLoading: seriesLoading } = useQuery({
    queryKey: ["post-series", brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_series")
        .select("*")
        .eq("brand_id", brandId!);
      if (error) throw error;
      return data;
    },
    enabled: !!brandId,
  });

  const { data: campaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ["campaigns", brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("brand_id", brandId!);
      if (error) throw error;
      return data;
    },
    enabled: !!brandId,
  });

  const { data: weeklyIdeas, isLoading: ideasLoading } = useQuery({
    queryKey: ["weekly-ideas", brandId],
    queryFn: async () => {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const { data, error } = await supabase
        .from("content_ideas")
        .select("*")
        .eq("brand_id", brandId!)
        .gte("scheduled_for", monday.toISOString().split("T")[0])
        .lte("scheduled_for", sunday.toISOString().split("T")[0])
        .order("scheduled_for");
      if (error) throw error;
      return data;
    },
    enabled: !!brandId,
  });

  // Auto-generate on first visit if no pillars exist
  useEffect(() => {
    if (brandId && !pillarsLoading && pillars && pillars.length === 0 && !initialSetupDone && !generating) {
      setInitialSetupDone(true);
      handleFullGenerate();
    }
  }, [brandId, pillarsLoading, pillars, initialSetupDone, generating]);

  // --- Actions ---
  const callEngine = async (action: string, extra: Record<string, any> = {}) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error("Not authenticated");

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/brand-engine`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, brand_id: brandId, ...extra }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Request failed" }));
      if (res.status === 429) {
        toast({ title: "Rate limited", description: "Please try again in a moment.", variant: "destructive" });
        throw new Error("Rate limited");
      }
      if (res.status === 402) {
        toast({ title: "Credits exhausted", description: "Please top up your AI credits.", variant: "destructive" });
        throw new Error("Credits exhausted");
      }
      throw new Error(err.error || "Failed");
    }
    return res.json();
  };

  const handleGenerate = async (action: string) => {
    setGenerating(action);
    try {
      await callEngine(action);
      queryClient.invalidateQueries({ queryKey: ["content-pillars", brandId] });
      queryClient.invalidateQueries({ queryKey: ["post-series", brandId] });
      queryClient.invalidateQueries({ queryKey: ["campaigns", brandId] });
      queryClient.invalidateQueries({ queryKey: ["weekly-ideas", brandId] });
      toast({ title: "Generated!", description: `${action.replace("generate_", "").replace("_", " ")} created successfully.` });
    } catch (e: any) {
      if (!["Rate limited", "Credits exhausted"].includes(e.message)) {
        toast({ title: "Generation failed", description: e.message, variant: "destructive" });
      }
    } finally {
      setGenerating(null);
    }
  };

  const handleFullGenerate = async () => {
    setGenerating("full");
    try {
      await callEngine("generate_pillars");
      queryClient.invalidateQueries({ queryKey: ["content-pillars", brandId] });
      await callEngine("generate_series");
      queryClient.invalidateQueries({ queryKey: ["post-series", brandId] });
      await callEngine("generate_campaigns");
      queryClient.invalidateQueries({ queryKey: ["campaigns", brandId] });
      await callEngine("generate_weekly_ideas");
      queryClient.invalidateQueries({ queryKey: ["weekly-ideas", brandId] });
      toast({ title: "Brand Engine ready!", description: "Your content strategy has been generated." });
    } catch (e: any) {
      if (!["Rate limited", "Credits exhausted"].includes(e.message)) {
        toast({ title: "Setup failed", description: e.message, variant: "destructive" });
      }
    } finally {
      setGenerating(null);
    }
  };

  const handleIdeaAction = (idea: any) => {
    const params = new URLSearchParams({ prompt: idea.prompt, content_idea_id: idea.id });
    navigate(`/studio?${params.toString()}`);
  };

  const isLoading = pillarsLoading || seriesLoading || campaignsLoading || ideasLoading;
  const hasPillars = pillars && pillars.length > 0;

  // Build weekly calendar
  const ideasByDay = DAYS.reduce((acc, day) => {
    acc[day] = (weeklyIdeas || []).filter((i: any) => {
      if (!i.scheduled_for) return false;
      const d = new Date(i.scheduled_for);
      const dayIndex = (d.getDay() + 6) % 7; // Mon=0
      return DAYS[dayIndex] === day;
    });
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-serif tracking-tight">Content Hub</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Your content strategy, powered by AI
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-2"
              onClick={handleFullGenerate}
              disabled={!!generating}
            >
              {generating === "full" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Regenerate All
            </Button>
          </div>

          {/* Loading / Empty state */}
          {generating === "full" && !hasPillars && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">
                  Analyzing your brand and building your content strategy…
                </p>
                <p className="text-xs text-muted-foreground/60">
                  This may take up to 30 seconds
                </p>
              </CardContent>
            </Card>
          )}

          {/* Pillars */}
          {hasPillars && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-base font-semibold">Content Pillars</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => handleGenerate("generate_pillars")}
                  disabled={!!generating}
                >
                  {generating === "generate_pillars" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Refresh
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {pillars!.map((p: any, i: number) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="h-full hover:border-primary/30 transition-colors">
                      <CardContent className="p-3 text-center space-y-1">
                        <span className="text-2xl">{p.icon_emoji}</span>
                        <p className="text-xs font-medium leading-tight">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{p.description}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* This Week */}
          {hasPillars && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-base font-semibold">This Week</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => handleGenerate("generate_weekly_ideas")}
                  disabled={!!generating}
                >
                  {generating === "generate_weekly_ideas" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Generate Ideas
                </Button>
              </div>
              <Card>
                <CardContent className="p-0 divide-y divide-border">
                  {DAYS.map((day) => {
                    const dayIdeas = ideasByDay[day] || [];
                    return (
                      <div key={day} className="flex items-center gap-3 px-4 py-3">
                        <span className="text-xs font-medium text-muted-foreground w-8 shrink-0">
                          {DAY_LABELS[day]}
                        </span>
                        <div className="flex-1 min-w-0">
                          {dayIdeas.length === 0 ? (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          ) : (
                            <div className="space-y-1.5">
                              {dayIdeas.map((idea: any) => (
                                <div key={idea.id} className="flex items-center gap-2">
                                  {idea.status === "created" ? (
                                    <Check className="h-3 w-3 text-green-500 shrink-0" />
                                  ) : (
                                    <Lightbulb className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                                  )}
                                  <span className={`text-xs truncate ${idea.status === "created" ? "text-muted-foreground line-through" : "text-foreground"}`}>
                                    {idea.title}
                                  </span>
                                  {idea.idea_type === "series_post" && (
                                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">series</Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 flex gap-1">
                          {dayIdeas.filter((i: any) => i.status !== "created").map((idea: any) => (
                            <Button
                              key={idea.id}
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleIdeaAction(idea)}
                              title="Create this design"
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </section>
          )}

          {/* Series */}
          {series && series.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-base font-semibold">Recurring Series</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => handleGenerate("generate_series")}
                  disabled={!!generating}
                >
                  {generating === "generate_series" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Refresh
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {series.map((s: any, i: number) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="hover:border-primary/30 transition-colors">
                      <CardContent className="p-4 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold">{s.name}</h3>
                          <Badge variant="secondary" className="text-[10px]">
                            {s.recurrence}{s.preferred_day ? ` · ${DAY_LABELS[s.preferred_day] || s.preferred_day}` : ""}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* Campaigns */}
          {campaigns && campaigns.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-base font-semibold">Campaigns</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => handleGenerate("generate_campaigns")}
                  disabled={!!generating}
                >
                  {generating === "generate_campaigns" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Refresh
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {campaigns.map((c: any, i: number) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="hover:border-primary/30 transition-colors">
                      <CardContent className="p-4 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold">{c.name}</h3>
                          <Badge variant="outline" className="text-[10px]">{c.post_count} posts</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </section>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default ContentHub;
