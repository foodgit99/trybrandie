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

function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = x.getDay(); // 0 sun
  const diff = (day + 6) % 7; // monday=0
  x.setDate(x.getDate() - diff);
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
        .select("id, title, status, approval_status, content_category, scheduled_for, design_id, designs:design_id(image_url, caption, user_vote)")
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

  const stats = useMemo(() => {
    const list = data ?? [];
    const planned = list.length;
    const shipped = list.filter((i: any) => i.status === "published" || i.status === "posted").length;
    const ready = list.filter((i: any) => i.design_id).length;
    const approved = list.filter((i: any) => i.approval_status === "approved").length;
    const ups = list.filter((i: any) => i.designs?.user_vote === 1).length;
    const downs = list.filter((i: any) => i.designs?.user_vote === -1).length;
    const byCat: Record<string, number> = {};
    list.forEach((i: any) => {
      const k = i.content_category || "uncategorised";
      byCat[k] = (byCat[k] ?? 0) + 1;
    });
    return { planned, shipped, ready, approved, ups, downs, byCat };
  }, [data]);

  const approvalRate = stats.planned ? Math.round((stats.approved / stats.planned) * 100) : 0;
  const shipRate = stats.planned ? Math.round((stats.shipped / stats.planned) * 100) : 0;

  return (
    <main className="min-h-screen bg-background text-foreground lg:pl-20 pb-28 lg:pb-12">
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
                  .sort((a, b) => b[1] - a[1])
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
                <Link key={i.id} to={`/v2/post/${i.id}`} className="group">
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
                        {i.designs?.user_vote === 1 && <ThumbsUp className="h-3 w-3 text-emerald-600" />}
                        {i.designs?.user_vote === -1 && <ThumbsDown className="h-3 w-3 text-rose-600" />}
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
                  Last push: {profile?.last_daily_push_at ? new Date(profile.last_daily_push_at).toLocaleString() : "—"}
                </p>
                <p className="text-muted-foreground">Hourly sweep. No double-sends per day.</p>
              </div>
            </div>
            <div className="pt-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/v2/settings">
                  Adjust delivery <ArrowUpRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          </Card>
        </section>

        <div className="pt-4 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/v2/cockpit">Plan this week →</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/v2/blueprint">Open blueprint</Link>
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
