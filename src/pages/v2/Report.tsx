import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useBrand } from "@/hooks/useBrand";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, CheckCircle2, ThumbsUp, ThumbsDown, Clock, Send } from "lucide-react";
import SEO from "@/components/SEO";
import NewAppHeader from "@/components/v2/NewAppHeader";

function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = x.getDay(); // 0 sun
  const diff = (day + 6) % 7; // monday=0
  x.setDate(x.getDate(), diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const Report = () => {
  const { user } = useAuth();
  const { brand } = useBrand(user);

  const range = useMemo(() => {
    const thisMonday = startOfWeek();
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday);
    lastSunday.setDate(thisMonday.getDate() - 1);
    return {
      lastMondayISO: isoDate(lastMonday),
      lastSundayISO: isoDate(lastSunday),
      thisMondayISO: isoDate(thisMonday),
      label: `${lastMonday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${lastSunday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    };
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["v2-report", brand?.id, range.lastMondayISO],
    enabled: !!brand?.id,
    queryFn: async () => {
      const { data: ideas } = await supabase
        .from("content_ideas")
        .select("id, title, status, approval_status, content_category, scheduled_for, design_id, designs:design_id(image_url, caption, vote)")
        .eq("brand_id", brand!.id)
        .gte("scheduled_for", range.lastMondayISO)
        .lte("scheduled_for", range.lastSundayISO)
        .order("scheduled_for", { ascending: true });
      return ideas ?? [];
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["v2-report-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("daily_push_hour, posting_timezone, last_daily_push_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  // Genome drift: last 4 weeks of designs for this brand, grouped by preset_id per week
  const { data: drift } = useQuery({
    queryKey: ["v2-report-drift", brand?.id],
    enabled: !!brand?.id,
    queryFn: async () => {
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      const { data } = await supabase
        .from("designs")
        .select("id, created_at, genome")
        .eq("brand_id", brand!.id)
        .gte("created_at", fourWeeksAgo.toISOString())
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const list = data ?? [];
    const planned = list.length;
    const shipped = list.filter((i: any) => i.status === "published" || i.status === "posted").length;
    const ready = list.filter((i: any) => i.design_id).length;
    const approved = list.filter((i: any) => i.approval_status === "approved").length;
    const ups = list.filter((i: any) => i.designs?.vote === 1).length;
    const downs = list.filter((i: any) => i.designs?.vote === -1).length;
    const byCat: Record<string, number> = {};
    list.forEach((i: any) => {
      const k = i.content_category || "uncategorised";
      byCat[k] = (byCat[k] ?? 0) + 1;
    });
    return { planned, shipped, ready, approved, ups, downs, byCat };
  }, [data]);

  // Build weekly preset distribution for drift chart
  const driftWeeks = useMemo(() => {
    const list = drift ?? [];
    const weeks: Array<{ label: string; start: Date; counts: Record<string, number>; total: number }> = [];
    const thisMonday = startOfWeek();
    for (let i = 3; i >= 0; i--) {
      const start = new Date(thisMonday);
      start.setDate(thisMonday.getDate(), i * 7);
      weeks.push({
        label: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        start,
        counts: {},
        total: 0,
      });
    }
    list.forEach((d: any) => {
      const preset = (d.genome as any)?.preset_id;
      if (!preset) return;
      const dt = new Date(d.created_at);
      for (let i = weeks.length - 1; i >= 0; i--) {
        if (dt >= weeks[i].start) {
          weeks[i].counts[preset] = (weeks[i].counts[preset] ?? 0) + 1;
          weeks[i].total += 1;
          break;
        }
      }
    });
    const allPresets = Array.from(
      new Set(weeks.flatMap((w) => Object.keys(w.counts))),
    );
    return { weeks, allPresets };
  }, [drift]);


  const approvalRate = stats.planned ? Math.round((stats.approved / stats.planned) * 100) : 0;
  const shipRate = stats.planned ? Math.round((stats.shipped / stats.planned) * 100) : 0;

  return (
    <main className="min-h-dvh bg-background text-foreground lg:pl-20 pb-28 lg:pb-12">
      <SEO title="CEO Briefing, Brandie" description="Last week, in numbers." path="/report" noindex />
      <NewAppHeader />
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-10">

        <header className="space-y-3">
          <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground">CEO Briefing</p>
          <h1 className="font-serif text-4xl sm:text-5xl leading-tight">Last week, in numbers.</h1>
          <p className="text-muted-foreground">{range.label} · {brand?.name ?? "Your brand"}</p>
        </header>

        {/* Headline stats */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Posts planned" value={stats.planned} />
          <StatCard label="Approved" value={stats.approved} suffix={stats.planned ? `${approvalRate}%` : undefined} />
          <StatCard label="Designs ready" value={stats.ready} />
          <StatCard label="Shipped" value={stats.shipped} suffix={stats.planned ? `${shipRate}%` : undefined} />
        </section>

        {/* Coverage */}
        <section>
          <h2 className="font-serif text-2xl mb-4">Pillar coverage</h2>
          <Card className="p-6">
            {Object.keys(stats.byCat).length === 0 ? (
              <p className="text-sm text-muted-foreground">No content scheduled last week.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.byCat)
                  .sort((a, b) => b[1], a[1])
                  .map(([cat, n]) => (
                    <Badge key={cat} variant="secondary" className="px-3 py-1 text-xs capitalize">
                      {cat.replace(/_/g, " ")} · {n}
                    </Badge>
                  ))}
              </div>
            )}
          </Card>
        </section>

        {/* Training signal */}
        <section>
          <h2 className="font-serif text-2xl mb-4">Brandie is learning</h2>
          <Card className="p-6 flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm">
              <ThumbsUp className="h-4 w-4 text-emerald-600" />
              <span className="font-medium">{stats.ups}</span>
              <span className="text-muted-foreground">upvotes</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <ThumbsDown className="h-4 w-4 text-rose-600" />
              <span className="font-medium">{stats.downs}</span>
              <span className="text-muted-foreground">downvotes</span>
            </div>
            <p className="text-xs text-muted-foreground ml-auto max-w-xs hidden sm:block">
              Every vote nudges the genome. Future weeks lean toward what you loved.
            </p>
          </Card>
        </section>

        {/* Genome drift */}
        <section>
          <h2 className="font-serif text-2xl mb-4">Genome drift</h2>
          <Card className="p-6">
            {driftWeeks.allPresets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Not enough renders yet. Once Brandie ships a few weeks of posts, you'll see how your visual genome shifts here.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-3">
                  {driftWeeks.weeks.map((w) => (
                    <div key={w.label} className="space-y-2">
                      <p className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                        Wk · {w.label}
                      </p>
                      <div className="flex h-24 w-full overflow-hidden rounded-md bg-muted">
                        {w.total === 0 ? (
                          <div className="w-full grid place-items-center text-[10px] text-muted-foreground">
                            -
                          </div>
                        ) : (
                          <div className="flex flex-col w-full">
                            {driftWeeks.allPresets.map((p, idx) => {
                              const n = w.counts[p] ?? 0;
                              if (n === 0) return null;
                              const pct = (n / w.total) * 100;
                              return (
                                <div
                                  key={p}
                                  className="w-full"
                                  style={{
                                    height: `${pct}%`,
                                    background: `hsl(var(--foreground) / ${0.25 + (idx % 5) * 0.15})`,
                                  }}
                                  title={`${p.replace(/-/g, " ")} · ${n}`}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">{w.total} renders</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  {driftWeeks.allPresets.map((p, idx) => (
                    <div key={p} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span
                        className="h-2 w-2 rounded-sm"
                        style={{ background: `hsl(var(--foreground) / ${0.25 + (idx % 5) * 0.15})` }}
                      />
                      <span className="capitalize">{p.replace(/-/g, " ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </section>



        {/* Best of */}
        <section>
          <h2 className="font-serif text-2xl mb-4">This week's drops</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (data ?? []).length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Nothing scheduled last week. Your first full briefing arrives after a full week of content.
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(data ?? []).map((i: any) => (
                <Link key={i.id} to={`/post/${i.id}`} className="group">
                  <Card className="overflow-hidden hover:border-foreground/30 transition-colors">
                    <div className="aspect-square bg-muted">
                      {i.designs?.image_url ? (
                        <img src={i.designs.image_url} alt={i.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-xs text-muted-foreground">
                          Not generated
                        </div>
                      )}
                    </div>
                    <div className="p-3 space-y-1">
                      <p className="text-xs text-muted-foreground">{i.scheduled_for}</p>
                      <p className="text-sm line-clamp-2">{i.title}</p>
                      <div className="flex items-center gap-2 pt-1">
                        {i.status === "published" || i.status === "posted" ? (
                          <Badge variant="secondary" className="text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Shipped</Badge>
                        ) : i.design_id ? (
                          <Badge variant="outline" className="text-[10px]">Ready</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Pending</Badge>
                        )}
                        {i.designs?.vote === 1 && <ThumbsUp className="h-3 w-3 text-emerald-600" />}
                        {i.designs?.vote === -1 && <ThumbsDown className="h-3 w-3 text-rose-600" />}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Notification schedule */}
        <section>
          <h2 className="font-serif text-2xl mb-4">Delivery schedule</h2>
          <Card className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 mt-0.5 text-muted-foreground" />
              <div className="text-sm">
                <p className="font-medium">
                  Daily push at {profile?.daily_push_hour ?? 8}:00 ({profile?.posting_timezone || "Africa/Lagos"})
                </p>
                <p className="text-muted-foreground">
                  Brandie emails (and pings WhatsApp if set) when your day's drop is ready to post.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Send className="h-5 w-5 mt-0.5 text-muted-foreground" />
              <div className="text-sm">
                <p className="font-medium">
                  Last push: {profile?.last_daily_push_at ? new Date(profile.last_daily_push_at).toLocaleString() : "-"}
                </p>
                <p className="text-muted-foreground">Hourly sweep. No double-sends per day.</p>
              </div>
            </div>
            <div className="pt-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/settings">
                  Adjust delivery <ArrowUpRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          </Card>
        </section>

        <div className="pt-4 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/cockpit">Plan this week →</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/blueprint">Open blueprint</Link>
          </Button>
        </div>
      </div>
    </main>
  );
};

function StatCard({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs tracking-wider uppercase text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-serif text-3xl">{value}</span>
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </Card>
  );
}

export default Report;
