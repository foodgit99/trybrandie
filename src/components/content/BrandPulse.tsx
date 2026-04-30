import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import FeatureInfoButton from "@/components/content/FeatureInfoButton";
import { CONTENT_CATEGORIES, parseCategoryIds } from "@/lib/contentCategories";

interface Idea {
  id: string;
  status?: string;
  scheduled_for?: string | null;
  content_category?: string | null;
  autopilot?: boolean;
  autopilot_status?: string | null;
}

interface BrandPulseProps {
  weeklyIdeas: Idea[];
  autopilotEnabled: boolean;
  nextRunAt: Date | null;
  timezone?: string;
  pillarsCount: number;
}

type Severity = "good" | "ok" | "warn" | "bad";

function dot(severity: Severity, filled: boolean) {
  const color =
    severity === "good"
      ? "bg-emerald-500"
      : severity === "ok"
      ? "bg-amber-500"
      : severity === "warn"
      ? "bg-orange-500"
      : "bg-destructive";
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${
        filled ? color : "bg-muted-foreground/25"
      }`}
    />
  );
}

export default function BrandPulse({
  weeklyIdeas,
  autopilotEnabled,
  nextRunAt,
  timezone,
  pillarsCount,
}: BrandPulseProps) {
  const total = weeklyIdeas.length;
  const created = weeklyIdeas.filter((i) => i.status === "created").length;
  const pending = weeklyIdeas.filter((i) => i.status !== "created").length;
  const failed = weeklyIdeas.filter(
    (i) => i.autopilot_status === "failed_no_credits" || i.autopilot_status === "failed_error",
  ).length;

  // --- Coverage score: how many of 10 categories appear in this week ---
  const seen = new Set<string>();
  weeklyIdeas.forEach((i) => {
    parseCategoryIds(i.content_category || "").forEach((c) => seen.add(c));
  });
  const coverageRatio = seen.size / Math.max(1, CONTENT_CATEGORIES.length);

  // --- Cadence score: ideas this week vs target (~7) ---
  const cadenceRatio = Math.min(1, total / 7);

  // --- Composite 0–4 score ---
  let score = 0;
  if (coverageRatio >= 0.4) score++;
  if (cadenceRatio >= 0.5) score++;
  if (pillarsCount >= 3) score++;
  if (failed === 0) score++;

  const severity: Severity =
    score >= 4 ? "good" : score === 3 ? "ok" : score === 2 ? "warn" : "bad";
  const label =
    severity === "good"
      ? "Healthy"
      : severity === "ok"
      ? "On track"
      : severity === "warn"
      ? "Needs attention"
      : "At risk";

  const nextRunLabel = nextRunAt
    ? nextRunAt.toLocaleString(undefined, {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <Card className="border-border/60">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Activity className="h-4 w-4 text-primary shrink-0" />
            <h2 className="text-sm font-semibold">Brand Pulse</h2>
            <FeatureInfoButton
              title="Brand Pulse"
              summary="A single read on your content health: coverage, cadence, structure, and delivery reliability."
              learnMore={
                "Consistent brands compound. Pulse turns four signals — category mix, posting cadence, pillar structure, and autopilot reliability — into one verdict so you know whether your brand is on track without inspecting every widget.\n\nIf the score drops, the recommendation card below tells you the single highest-leverage move to make this week."
              }
            />
            <span className="ml-1 inline-flex items-center gap-0.5">
              {dot(severity, score >= 1)}
              {dot(severity, score >= 2)}
              {dot(severity, score >= 3)}
              {dot(severity, score >= 4)}
            </span>
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-4 font-medium"
            >
              {label}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <Stat label="This week" value={`${total} ideas`} hint={`${created} created`} />
          <Stat label="Coverage" value={`${seen.size}/${CONTENT_CATEGORIES.length}`} hint="categories" />
          <Stat label="Backlog" value={`${pending}`} hint="awaiting design" />
          <Stat
            label="Issues"
            value={`${failed}`}
            hint={failed > 0 ? "needs review" : "all clear"}
            tone={failed > 0 ? "bad" : "good"}
          />
        </div>

        {autopilotEnabled && nextRunLabel && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground border-t border-border/40 pt-2">
            <Clock className="h-3 w-3" />
            <span>
              Autopilot ON · Next delivery: <span className="text-foreground font-medium">{nextRunLabel}</span>
              {timezone ? ` (${timezone})` : ""}
            </span>
          </div>
        )}
        {!autopilotEnabled && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground border-t border-border/40 pt-2">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            <span>Autopilot is off — your brand depends on you remembering to post.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "bad";
}) {
  const valueColor =
    tone === "bad" ? "text-destructive" : tone === "good" ? "text-emerald-600" : "text-foreground";
  return (
    <div className="rounded-md border border-border/40 bg-background/60 px-2.5 py-1.5">
      <div className="text-muted-foreground uppercase tracking-wide text-[9px]">{label}</div>
      <div className={`text-sm font-semibold ${valueColor}`}>{value}</div>
      {hint && <div className="text-[9px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
