import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, AlertTriangle, ChevronRight, CheckCircle2, Lightbulb, Loader2 } from "lucide-react";

type Severity = "critical" | "warn" | "info" | "good";
type CtaAction =
  | "open_pillars"
  | "open_campaigns"
  | "open_series"
  | "generate_weekly_ideas"
  | "open_studio"
  | "enable_autopilot"
  | "topup_credits"
  | "review_failed";

interface Recommendation {
  severity: Severity;
  headline: string;
  reason: string;
  cta_label: string;
  cta_action: CtaAction;
  cta_payload?: Record<string, unknown>;
}

interface NextBestActionCardProps {
  brandId: string;
  onAction: (action: CtaAction) => void;
}

const SEVERITY_STYLES: Record<Severity, { ring: string; bg: string; icon: JSX.Element; label: string }> = {
  critical: {
    ring: "border-destructive/40",
    bg: "bg-destructive/[0.04]",
    icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
    label: "Action needed",
  },
  warn: {
    ring: "border-amber-500/40",
    bg: "bg-amber-500/[0.04]",
    icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
    label: "Recommended",
  },
  info: {
    ring: "border-primary/30",
    bg: "bg-primary/[0.03]",
    icon: <Lightbulb className="h-4 w-4 text-primary" />,
    label: "Suggestion",
  },
  good: {
    ring: "border-emerald-500/30",
    bg: "bg-emerald-500/[0.04]",
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
    label: "On track",
  },
};

export default function NextBestActionCard({ brandId, onAction }: NextBestActionCardProps) {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["next-best-action", brandId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("brand-engine", {
        body: { action: "recommend_next_action", brand_id: brandId },
      });
      if (error) throw error;
      return data as { recommendation: Recommendation; signals: Record<string, unknown> };
    },
    enabled: !!brandId,
    staleTime: 60_000, // refresh every minute on remount
  });

  if (isLoading || !data?.recommendation) {
    return (
      <Card className="border-border/40">
        <CardContent className="p-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Reading your brand pulse…
        </CardContent>
      </Card>
    );
  }

  const rec = data.recommendation;
  const style = SEVERITY_STYLES[rec.severity];

  const handleClick = () => {
    if (rec.cta_action === "topup_credits") {
      navigate("/plans");
      return;
    }
    if (rec.cta_action === "open_studio") {
      navigate("/studio");
      return;
    }
    onAction(rec.cta_action);
  };

  return (
    <Card className={`section-accent-rail ${style.ring} ${style.bg}`}>
      <CardContent className="p-4 space-y-2.5">
        <div className="flex items-center gap-2">
          {style.icon}
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 uppercase tracking-wide">
            {style.label}
          </Badge>
          <span className="text-[10px] text-muted-foreground ml-auto inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Next best action
          </span>
        </div>

        <h3 className="text-sm font-semibold leading-snug">{rec.headline}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{rec.reason}</p>

        <div className="pt-1">
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={handleClick}>
            {rec.cta_label}
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export type { CtaAction };
