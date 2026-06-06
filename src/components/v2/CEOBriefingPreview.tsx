import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowUpRight, CheckCircle2, ThumbsUp, ThumbsDown, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Props = { brandId?: string | null; brandName?: string | null };

function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day + 6) % 7; // monday=0
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const CEOBriefingPreview = ({ brandId, brandName }: Props) => {
  const range = useMemo(() => {
    const thisMonday = startOfWeek();
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday);
    lastSunday.setDate(thisMonday.getDate() - 1);
    return {
      lastMondayISO: isoDate(lastMonday),
      lastSundayISO: isoDate(lastSunday),
      label: `${lastMonday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${lastSunday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    };
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["cockpit-briefing-preview", brandId, range.lastMondayISO],
    enabled: !!brandId,
    queryFn: async () => {
      const { data: ideas } = await supabase
        .from("content_ideas")
        .select(
          "id, title, status, approval_status, content_category, scheduled_for, design_id, designs:design_id(image_url, vote)",
        )
        .eq("brand_id", brandId!)
        .gte("scheduled_for", range.lastMondayISO)
        .lte("scheduled_for", range.lastSundayISO)
        .order("scheduled_for", { ascending: true });
      return ideas ?? [];
    },
  });

  const stats = useMemo(() => {
    const list = (data ?? []) as any[];
    const planned = list.length;
    const shipped = list.filter((i) => i.status === "published" || i.status === "posted").length;
    const approved = list.filter((i) => i.approval_status === "approved").length;
    const ups = list.filter((i) => i.designs?.vote === 1).length;
    const downs = list.filter((i) => i.designs?.vote === -1).length;
    const byCat: Record<string, number> = {};
    list.forEach((i) => {
      const k = i.content_category || "uncategorised";
      byCat[k] = (byCat[k] ?? 0) + 1;
    });
    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const thumbs = list
      .map((i) => i.designs?.image_url)
      .filter(Boolean)
      .slice(0, 4);
    return { planned, shipped, approved, ups, downs, topCat, thumbs };
  }, [data]);

  const shipRate = stats.planned ? Math.round((stats.shipped / stats.planned) * 100) : 0;
  const empty = !isLoading && stats.planned === 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-4"
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground">
            CEO Briefing
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl tracking-tight mt-1">
            Last week, in numbers.
          </h2>
        </div>
        <Link
          to="/report"
          className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
        >
          Open full report <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <Link
        to="/report"
        aria-label="Open CEO Briefing"
        className="group block rounded-3xl border border-border bg-card hover:border-foreground/40 hover:shadow-sm transition-all overflow-hidden"
      >
        <div className="p-6 sm:p-7 space-y-5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {range.label}
              {brandName ? ` · ${brandName}` : ""}
            </span>
            {!empty && (
              <span className="hidden sm:inline">
                {stats.shipped} of {stats.planned} shipped
              </span>
            )}
          </div>

          {empty ? (
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-muted grid place-items-center shrink-0">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-medium leading-snug">
                  Your first briefing is brewing.
                </p>
                <p className="text-sm text-muted-foreground max-w-md">
                  Plan and ship a full week, then Brandie will show you what
                  worked, pillar mix, training signal, and what to repeat.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3">
                <Stat label="Planned" value={stats.planned} />
                <Stat label="Approved" value={stats.approved} />
                <Stat label="Shipped" value={stats.shipped} suffix={`${shipRate}%`} />
                <Stat
                  label="Signal"
                  value={stats.ups - stats.downs}
                  suffix={`${stats.ups + stats.downs} votes`}
                  positive={stats.ups >= stats.downs}
                />
              </div>

              {stats.thumbs.length > 0 && (
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex -space-x-2">
                    {stats.thumbs.map((url, i) => (
                      <div
                        key={i}
                        className="h-12 w-12 rounded-xl overflow-hidden border-2 border-card bg-muted shrink-0"
                        style={{ zIndex: 10 - i }}
                      >
                        <img
                          src={url as string}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {stats.topCat && (
                      <p className="capitalize">
                        Most-aired pillar:{" "}
                        <span className="text-foreground">
                          {stats.topCat.replace(/_/g, " ")}
                        </span>
                      </p>
                    )}
                    <p className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        {stats.shipped} shipped
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3 text-emerald-600" />
                        {stats.ups}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ThumbsDown className="h-3 w-3 text-rose-600" />
                        {stats.downs}
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 sm:px-7 py-3 border-t border-border bg-muted/30 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {empty ? "Come back after shipping a week." : "Tap to read the full briefing."}
          </span>
          <span className="inline-flex items-center gap-1 text-foreground/80 group-hover:text-foreground transition-colors">
            Open report <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </Link>
    </motion.section>
  );
};

function Stat({
  label,
  value,
  suffix,
  positive,
}: {
  label: string;
  value: number;
  suffix?: string;
  positive?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
        {label}
      </p>
      <div className="flex items-baseline gap-1.5">
        <span
          className={`font-serif text-2xl sm:text-3xl tracking-tight ${
            positive === false ? "text-rose-600" : ""
          }`}
        >
          {positive !== undefined && value > 0 ? "+" : ""}
          {value}
        </span>
        {suffix && (
          <span className="text-[10px] text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  );
}

export default CEOBriefingPreview;
