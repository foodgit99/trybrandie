import { useState } from "react";
import { Link } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { useBrandUsage, type UsageRange } from "@/hooks/useBrandUsage";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ArrowUpRight, Sparkles, Users, Zap, Image as ImageIcon } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface Props {
  brandId: string;
  ownerUserId: string;
  ownerName: string;
  isOwner: boolean;
}

const RANGES: { value: UsageRange; label: string }[] = [
  { value: 7, label: "7d" },
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
];

export default function BrandUsagePanel({ brandId, ownerUserId, ownerName, isOwner }: Props) {
  const { data: sub } = useSubscription();
  const [range, setRange] = useState<UsageRange>(30);
  const hasFeature = !!sub?.features?.team; // Creator + Agency
  const { data, isLoading } = useBrandUsage(brandId, ownerUserId, ownerName, isOwner && hasFeature, range);

  if (!isOwner) return null;

  if (!hasFeature) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="font-medium text-base">Usage analytics</h3>
          <p className="text-sm text-muted-foreground mt-1">
            See designs, credits, and team activity per brand. Available on Creator & Agency plans.
          </p>
        </div>
        <Button asChild className="rounded-full shrink-0">
          <Link to="/pricing">Upgrade <ArrowUpRight className="h-4 w-4 ml-1" /></Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Activity for the last {range} days.</p>
        <div className="inline-flex rounded-full border border-border p-0.5 bg-card">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1 text-xs rounded-full transition ${
                range === r.value ? "bg-foreground text-background" : "text-muted-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={ImageIcon}
          label="Designs"
          value={isLoading ? null : data?.designs ?? 0}
        />
        <StatCard
          icon={Sparkles}
          label="Credits used"
          value={isLoading ? null : data?.credits ?? data?.designs ?? 0}
          hint="≈ 1 credit per design"
        />
        <StatCard
          icon={Zap}
          label="Autopilot posts"
          value={isLoading ? null : data?.autopilotPosts ?? 0}
        />
        <StatCard
          icon={Users}
          label="Active members"
          value={isLoading ? null : data?.activeMembers ?? 0}
        />
      </div>

      {/* Daily sparkline */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <p className="text-xs tracking-wider uppercase text-muted-foreground mb-3">
          Daily designs
        </p>
        <div className="h-32">
          {isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : (data?.dailyDesigns?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data!.dailyDesigns}>
                <defs>
                  <linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => format(new Date(d), "d MMM")}
                  tick={{ fontSize: 10 }}
                  stroke="hsl(var(--muted-foreground))"
                  interval="preserveStartEnd"
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  labelFormatter={(d) => format(new Date(d as string), "EEE, d MMM")}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#usageFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Member leaderboard */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <p className="text-xs tracking-wider uppercase text-muted-foreground mb-3">
          Team activity
        </p>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (data?.members?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Designs</TableHead>
                <TableHead className="text-right">Last active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.members.map((m) => (
                <TableRow key={m.user_id}>
                  <TableCell className="font-medium truncate max-w-[180px]">{m.name}</TableCell>
                  <TableCell>
                    <Badge variant={m.role === "Owner" ? "default" : "secondary"} className="rounded-md">
                      {m.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{m.designs}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {m.lastActive ? formatDistanceToNow(new Date(m.lastActive), { addSuffix: true }) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Breakdown */}
      <div className="grid sm:grid-cols-2 gap-3">
        <BreakdownCard title="By category" rows={data?.byCategory} loading={isLoading} />
        <BreakdownCard title="By format" rows={data?.byFormat} loading={isLoading} />
      </div>

      {/* Recent activity */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <p className="text-xs tracking-wider uppercase text-muted-foreground mb-3">
          Recent activity
        </p>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (data?.activity?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet for this window.</p>
        ) : (
          <ul className="divide-y divide-border -my-2">
            {data!.activity.map((a) => (
              <li key={a.id} className="py-2.5 flex items-center gap-3 text-sm">
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-muted-foreground shrink-0">
                  {a.kind}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate">
                    <span className="font-medium">{a.actorName}</span>{" "}
                    <span className="text-muted-foreground">·</span> {a.title}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(a.at), { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string | null;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] tracking-wider uppercase">{label}</span>
      </div>
      {value === null ? (
        <Skeleton className="h-7 w-12" />
      ) : (
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      )}
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
  loading,
}: {
  title: string;
  rows?: { key: string; count: number }[];
  loading: boolean;
}) {
  const total = (rows ?? []).reduce((s, r) => s + r.count, 0);
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <p className="text-xs tracking-wider uppercase text-muted-foreground mb-3">{title}</p>
      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : (rows?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">No data.</p>
      ) : (
        <ul className="space-y-2">
          {rows!.slice(0, 6).map((r) => {
            const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
            return (
              <li key={r.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="capitalize truncate">{r.key.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {r.count} · {pct}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
