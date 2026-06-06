import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Users, ArrowRight, Sparkles, ChevronDown, Target, MessageSquareQuote, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface AudienceContextBannerProps {
  brandId: string | undefined;
}

interface AudienceRow {
  id: string;
  label: string | null;
  jtbd_profile: unknown | null;
}

const AudienceContextBanner = ({ brandId }: AudienceContextBannerProps) => {
  const navigate = useNavigate();
  const [whyOpen, setWhyOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["content-hub-audiences", brandId],
    queryFn: async () => {
      if (!brandId) return [] as AudienceRow[];
      const { data, error } = await supabase
        .from("target_audiences" as any)
        .select("id, label, jtbd_profile")
        .eq("brand_id", brandId)
        .limit(4);
      if (error) throw error;
      return (data || []) as unknown as AudienceRow[];
    },
    enabled: !!brandId,
  });

  const goToAudience = () => navigate("/brand?section=audience#audience");
  const startAudience = () => navigate("/brand?section=audience&startAudience=1#audience");

  if (isLoading) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-4 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-44" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-8 w-24 rounded-md" />
        </CardContent>
      </Card>
    );
  }

  const audiences = data || [];
  // Engine uses up to 3
  const driving = audiences.slice(0, 3);
  const extra = Math.max(0, audiences.length, 3);
  const hasAny = audiences.length > 0;
  const generatedCount = driving.filter((a) => !!a.jtbd_profile).length;
  const noneGenerated = hasAny && generatedCount === 0;

  // Empty state
  if (!hasAny) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border-amber-500/20 bg-amber-500/[0.04]">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">No target audience set</p>
                <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                  Add an audience so suggestions speak to the right people.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 rounded-lg shrink-0"
                onClick={goToAudience}
              >
                Set up audience
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
            <Collapsible open={whyOpen} onOpenChange={setWhyOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300 hover:underline focus:outline-none"
                >
                  Why is this important?
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${whyOpen ? "rotate-180" : ""}`}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <AnimatePresence initial={false}>
                  {whyOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                      className="mt-3 grid gap-2.5 sm:grid-cols-3 rounded-lg border border-amber-500/20 bg-background/60 p-3"
                    >
                      <div className="flex gap-2">
                        <Target className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium">Sharper targeting</p>
                          <p className="text-[11px] text-muted-foreground leading-snug">
                            Suggestions speak to the specific people most likely to buy.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <MessageSquareQuote className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium">Persuasive copy</p>
                          <p className="text-[11px] text-muted-foreground leading-snug">
                            Copy taps real struggles, desires, and language patterns from a JTBD profile.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium">Higher conversion</p>
                          <p className="text-[11px] text-muted-foreground leading-snug">
                            Audience-aware designs consistently outperform generic posts.
                          </p>
                        </div>
                      </div>
                      <div className="sm:col-span-3 flex justify-end pt-1">
                        <Button
                          size="sm"
                          className="h-8 text-xs gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-600/90 text-white"
                          onClick={startAudience}
                        >
                          Create audience profile now
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Drafts only, no JTBD generated yet
  if (noneGenerated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border-amber-500/20 bg-amber-500/[0.04]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Audience drafts saved</p>
              <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                Generate the JTBD profile to power smarter suggestions.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 rounded-lg shrink-0"
              onClick={goToAudience}
            >
              Finish setup
              <ArrowRight className="h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Healthy state
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardContent className="p-4 flex items-start sm:items-center gap-3 flex-col sm:flex-row">
          <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0 w-full">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                Suggestions tuned for {driving.length} audience{driving.length === 1 ? "" : "s"}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {driving.map((a) => {
                  const isDraft = !a.jtbd_profile;
                  return (
                    <Badge
                      key={a.id}
                      variant="outline"
                      className={
                        isDraft
                          ? "text-[10px] font-normal border-dashed text-muted-foreground"
                          : "text-[10px] font-normal bg-background"
                      }
                    >
                      {a.label || "Audience"}
                      {isDraft && <span className="ml-1 opacity-70">· draft</span>}
                    </Badge>
                  );
                })}
                {extra > 0 && (
                  <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                    +{extra} more
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs gap-1.5 rounded-lg shrink-0 self-end sm:self-auto"
            onClick={goToAudience}
          >
            Edit audience
            <ArrowRight className="h-3 w-3" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default AudienceContextBanner;
