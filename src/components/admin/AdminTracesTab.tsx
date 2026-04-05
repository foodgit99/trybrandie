import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Activity,
  AlertTriangle,
  Clock,
  Zap,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { format, subDays, startOfDay, parseISO } from "date-fns";

interface TraceRow {
  id: string;
  run_id: string;
  user_id: string;
  spans: any[];
  total_latency_ms: number | null;
  total_input_tokens: number | null;
  total_output_tokens: number | null;
  error: string | null;
  created_at: string;
}

const PAGE_SIZE = 50;

const SPAN_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent-foreground))",
  "#6c5ce7",
  "#ff4d8d",
  "#c4a265",
  "#00b894",
  "#0984e3",
  "#e17055",
];

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const variantClasses = {
    default: "bg-primary/10 text-primary",
    success: "bg-green-500/10 text-green-600",
    warning: "bg-yellow-500/10 text-yellow-600",
    danger: "bg-destructive/10 text-destructive",
  };

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-xl ${variantClasses[variant]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground truncate">{title}</p>
            <p className="text-2xl font-semibold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SpanTimeline({ spans }: { spans: any[] }) {
  if (!spans?.length) return <p className="text-sm text-muted-foreground">No spans recorded</p>;

  const maxLatency = Math.max(...spans.map((s: any) => s.latency_ms || 0), 1);

  return (
    <div className="space-y-2">
      {spans.map((span: any, i: number) => {
        const pct = ((span.latency_ms || 0) / maxLatency) * 100;
        const isError = span.status === "error";
        return (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{span.agent}</span>
                {isError && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 rounded-md">
                    error
                  </Badge>
                )}
              </div>
              <span className="text-muted-foreground font-mono text-xs">
                {span.latency_ms != null ? `${(span.latency_ms / 1000).toFixed(1)}s` : "–"}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(pct, 2)}%`,
                  backgroundColor: isError ? "hsl(var(--destructive))" : SPAN_COLORS[i % SPAN_COLORS.length],
                }}
              />
            </div>
            {isError && span.error && (
              <p className="text-xs text-destructive truncate">{span.error}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AdminTracesTab() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedTrace, setSelectedTrace] = useState<TraceRow | null>(null);

  // Fetch traces
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-traces", page, search],
    queryFn: async () => {
      let query = supabase
        .from("design_traces")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (search.trim()) {
        query = query.or(`run_id.ilike.%${search}%,user_id.ilike.%${search}%`);
      }

      const { data: rows, error, count } = await query;
      if (error) throw error;
      return { rows: (rows || []) as TraceRow[], count: count || 0 };
    },
  });

  const traces = data?.rows || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Aggregated stats from loaded data (last 7 days for charts)
  const { data: chartData } = useQuery({
    queryKey: ["admin-traces-chart"],
    queryFn: async () => {
      const since = subDays(new Date(), 7).toISOString();
      const { data: rows, error } = await supabase
        .from("design_traces")
        .select("created_at, total_latency_ms, error, spans")
        .gte("created_at", since)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (rows || []) as TraceRow[];
    },
    staleTime: 60_000,
  });

  const allChartTraces = chartData || [];

  // Compute stats
  const stats = useMemo(() => {
    if (!allChartTraces.length) return { total: 0, errors: 0, avgLatency: 0, p95Latency: 0, errorRate: "0" };

    const total = allChartTraces.length;
    const errors = allChartTraces.filter((t) => t.error).length;
    const latencies = allChartTraces
      .map((t) => t.total_latency_ms)
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b);
    const avgLatency = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
    const p95Latency = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] : 0;
    const errorRate = total ? ((errors / total) * 100).toFixed(1) : "0";

    return { total, errors, avgLatency, p95Latency, errorRate };
  }, [allChartTraces]);

  // Daily latency chart data
  const dailyData = useMemo(() => {
    const byDay = new Map<string, { latencies: number[]; errors: number; total: number }>();

    for (let i = 6; i >= 0; i--) {
      const dayKey = format(subDays(new Date(), i), "MMM dd");
      byDay.set(dayKey, { latencies: [], errors: 0, total: 0 });
    }

    allChartTraces.forEach((t) => {
      const dayKey = format(parseISO(t.created_at), "MMM dd");
      const entry = byDay.get(dayKey);
      if (entry) {
        entry.total++;
        if (t.error) entry.errors++;
        if (t.total_latency_ms) entry.latencies.push(t.total_latency_ms);
      }
    });

    return Array.from(byDay.entries()).map(([day, v]) => ({
      day,
      avg_latency: v.latencies.length
        ? Math.round(v.latencies.reduce((a, b) => a + b, 0) / v.latencies.length / 1000)
        : 0,
      generations: v.total,
      errors: v.errors,
    }));
  }, [allChartTraces]);

  // Agent performance breakdown
  const agentData = useMemo(() => {
    const agents = new Map<string, { latencies: number[]; errors: number }>();

    allChartTraces.forEach((t) => {
      const spans = Array.isArray(t.spans) ? t.spans : [];
      spans.forEach((s: any) => {
        const name = s.agent || "unknown";
        if (!agents.has(name)) agents.set(name, { latencies: [], errors: 0 });
        const entry = agents.get(name)!;
        if (s.latency_ms) entry.latencies.push(s.latency_ms);
        if (s.status === "error") entry.errors++;
      });
    });

    return Array.from(agents.entries())
      .map(([agent, v]) => ({
        agent,
        avg_ms: v.latencies.length ? Math.round(v.latencies.reduce((a, b) => a + b, 0) / v.latencies.length) : 0,
        calls: v.latencies.length,
        errors: v.errors,
      }))
      .sort((a, b) => b.avg_ms - a.avg_ms);
  }, [allChartTraces]);

  // Error type breakdown for pie chart
  const errorPieData = useMemo(() => {
    const success = allChartTraces.filter((t) => !t.error).length;
    const errors = allChartTraces.filter((t) => t.error).length;
    if (!allChartTraces.length) return [];
    return [
      { name: "Success", value: success },
      ...(errors > 0 ? [{ name: "Error", value: errors }] : []),
    ];
  }, [allChartTraces]);

  const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))"];

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Generations (7d)" value={stats.total} icon={Activity} />
        <StatCard
          title="Avg Latency"
          value={`${(stats.avgLatency / 1000).toFixed(1)}s`}
          subtitle={`P95: ${(stats.p95Latency / 1000).toFixed(1)}s`}
          icon={Clock}
        />
        <StatCard
          title="Error Rate"
          value={`${stats.errorRate}%`}
          subtitle={`${stats.errors} total errors`}
          icon={AlertTriangle}
          variant={parseFloat(stats.errorRate) > 5 ? "danger" : parseFloat(stats.errorRate) > 2 ? "warning" : "success"}
        />
        <StatCard title="Total Traces" value={totalCount} icon={Zap} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Latency Trend */}
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Pipeline Performance (7 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="avg_latency"
                    name="Avg Latency (s)"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="generations"
                    name="Generations"
                    stroke="#c4a265"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="errors"
                    name="Errors"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Success / Error Pie */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Success Rate</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {errorPieData.length > 0 ? (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={errorPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" label>
                      {errorPieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-12">No data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agent Performance Breakdown */}
      {agentData.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Agent Latency Breakdown</CardTitle>
            <CardDescription>Average latency per pipeline stage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agentData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="agent" tick={{ fontSize: 11 }} width={160} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                    }}
                    formatter={(value: number) => [`${(value / 1000).toFixed(2)}s`, "Avg Latency"]}
                  />
                  <Bar dataKey="avg_ms" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Traces Table */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base">Recent Traces</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search run_id or user_id…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  className="pl-9 rounded-xl h-9 w-56"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="rounded-xl">
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : traces.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No traces found</p>
          ) : (
            <>
              <ScrollArea className="max-h-[500px]">
                <div className="space-y-1.5">
                  {traces.map((trace) => {
                    const spans = Array.isArray(trace.spans) ? trace.spans : [];
                    const spanCount = spans.length;
                    const hasError = !!trace.error || spans.some((s: any) => s.status === "error");

                    return (
                      <button
                        key={trace.id}
                        onClick={() => setSelectedTrace(trace)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${hasError ? "bg-destructive" : "bg-green-500"}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                              {trace.run_id}
                            </code>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-md">
                              {spanCount} spans
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(parseISO(trace.created_at), "MMM dd, HH:mm:ss")}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-mono font-medium">
                            {trace.total_latency_ms != null ? `${(trace.total_latency_ms / 1000).toFixed(1)}s` : "–"}
                          </p>
                          {hasError && (
                            <p className="text-[10px] text-destructive">error</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-4">
                <p className="text-xs text-muted-foreground">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="rounded-xl"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="rounded-xl"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Trace Detail Dialog */}
      <Dialog open={!!selectedTrace} onOpenChange={(open) => !open && setSelectedTrace(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">Trace Detail</DialogTitle>
          </DialogHeader>
          {selectedTrace && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Run ID</p>
                  <code className="text-xs font-mono break-all">{selectedTrace.run_id}</code>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">User ID</p>
                  <code className="text-xs font-mono break-all">{selectedTrace.user_id}</code>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Total Latency</p>
                  <p className="font-medium">
                    {selectedTrace.total_latency_ms != null
                      ? `${(selectedTrace.total_latency_ms / 1000).toFixed(2)}s`
                      : "–"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Created</p>
                  <p className="font-medium">{format(parseISO(selectedTrace.created_at), "MMM dd, HH:mm:ss")}</p>
                </div>
              </div>

              {selectedTrace.error && (
                <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
                  <p className="font-medium text-xs mb-1">Error</p>
                  <p className="text-xs">{selectedTrace.error}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-3">Pipeline Spans</p>
                <SpanTimeline spans={Array.isArray(selectedTrace.spans) ? selectedTrace.spans : []} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
