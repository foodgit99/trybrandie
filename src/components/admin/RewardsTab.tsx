import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAccessToken } from "@/lib/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import {
  Gift,
  Plus,
  Search,
  Pencil,
  Trash2,
  CalendarIcon,
  X,
  Users as UsersIcon,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

async function adminAction(payload: Record<string, unknown>) {
  const token = await getAccessToken();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-action`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

type RewardRow = {
  id: string;
  user_id: string;
  amount: number;
  remaining: number;
  reason: string;
  granted_by: string;
  expires_at: string;
  created_at: string;
};

type RewardWithMeta = RewardRow & {
  recipient_name?: string | null;
  recipient_email?: string | null;
  granter_email?: string | null;
};

const PAGE_SIZE = 50;
const TIERS = ["free", "entrepreneur", "creator", "agency"];

function getRewardStatus(r: RewardRow): "active" | "expired" | "depleted" {
  if (new Date(r.expires_at) <= new Date()) return "expired";
  if ((r.remaining ?? 0) <= 0) return "depleted";
  return "active";
}

function ExpiryBadge({ expiresAt, status }: { expiresAt: string; status: string }) {
  if (status === "expired") {
    return <Badge variant="destructive">Expired</Badge>;
  }
  if (status === "depleted") {
    return <Badge variant="secondary">Depleted</Badge>;
  }
  const days = Math.ceil(
    (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  let cls = "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  if (days <= 3) cls = "bg-destructive/15 text-destructive border-destructive/30";
  else if (days <= 14) cls = "bg-amber-500/15 text-amber-700 border-amber-500/30";
  return (
    <Badge variant="outline" className={cn("border", cls)}>
      {days}d left
    </Badge>
  );
}

export default function RewardsTab() {
  const qc = useQueryClient();
  const [grantOpen, setGrantOpen] = useState(false);
  const [editing, setEditing] = useState<RewardWithMeta | null>(null);
  const [deleting, setDeleting] = useState<RewardWithMeta | null>(null);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired" | "depleted">("all");
  const [search, setSearch] = useState("");

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["reward-stats"],
    queryFn: () => adminAction({ operation: "reward_stats" }),
  });

  const { data: rewardsData, isLoading: rewardsLoading } = useQuery({
    queryKey: ["rewards-list", page],
    queryFn: () =>
      adminAction({
        operation: "list",
        table: "credit_rewards",
        offset: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      }),
  });

  const rawRows: RewardRow[] = rewardsData?.rows || [];
  const totalCount: number = rewardsData?.count || 0;

  // Enrich with recipient info
  const userIds = useMemo(() => {
    const ids = new Set<string>();
    rawRows.forEach((r) => {
      ids.add(r.user_id);
      ids.add(r.granted_by);
    });
    return Array.from(ids);
  }, [rawRows]);

  const { data: profileMap } = useQuery({
    queryKey: ["rewards-profiles", userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      const map: Record<string, { full_name: string | null }> = {};
      (data || []).forEach((p) => {
        map[p.user_id] = { full_name: p.full_name };
      });
      return map;
    },
    enabled: userIds.length > 0,
  });

  const enriched: RewardWithMeta[] = useMemo(() => {
    return rawRows.map((r) => ({
      ...r,
      recipient_name: profileMap?.[r.user_id]?.full_name || null,
    }));
  }, [rawRows, profileMap]);

  const filtered = useMemo(() => {
    return enriched.filter((r) => {
      if (statusFilter !== "all" && getRewardStatus(r) !== statusFilter) return false;
      if (search.trim()) {
        const term = search.toLowerCase();
        const hay = `${r.recipient_name || ""} ${r.reason || ""} ${r.user_id}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [enriched, statusFilter, search]);

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      adminAction({ operation: "delete", table: "credit_rewards", id }),
    onSuccess: () => {
      toast.success("Reward deleted");
      qc.invalidateQueries({ queryKey: ["rewards-list"] });
      qc.invalidateQueries({ queryKey: ["reward-stats"] });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Rewards"
          value={stats?.stats?.totalRewards ?? 0}
          loading={statsLoading}
        />
        <StatCard
          label="Outstanding Credits"
          value={stats?.stats?.outstanding ?? 0}
          loading={statsLoading}
          accent
        />
        <StatCard
          label="Expired/Unused"
          value={stats?.stats?.expiredUnused ?? 0}
          loading={statsLoading}
        />
        <StatCard
          label="Active Recipients"
          value={stats?.stats?.activeRecipients ?? 0}
          loading={statsLoading}
        />
      </div>

      {/* Toolbar */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" /> Reward Credits
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                qc.invalidateQueries({ queryKey: ["rewards-list"] });
                qc.invalidateQueries({ queryKey: ["reward-stats"] });
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button onClick={() => setGrantOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" /> Grant Rewards
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by recipient, reason, or user ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="depleted">Depleted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {rewardsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Gift className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No rewards match your filters</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="px-4 py-3 font-medium">Recipient</th>
                      <th className="px-4 py-3 font-medium">Amount</th>
                      <th className="px-4 py-3 font-medium">Remaining</th>
                      <th className="px-4 py-3 font-medium">Reason</th>
                      <th className="px-4 py-3 font-medium">Granted</th>
                      <th className="px-4 py-3 font-medium">Expires</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const status = getRewardStatus(r);
                      return (
                        <tr key={r.id} className="border-t hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="font-medium">
                              {r.recipient_name || "-"}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {r.user_id.slice(0, 8)}…
                            </div>
                          </td>
                          <td className="px-4 py-3">{r.amount}</td>
                          <td className="px-4 py-3">
                            <span className={cn(r.remaining === 0 && "text-muted-foreground")}>
                              {r.remaining}
                            </span>
                          </td>
                          <td className="px-4 py-3 max-w-[200px] truncate" title={r.reason}>
                            {r.reason || <span className="text-muted-foreground">-</span>}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                          </td>
                          <td className="px-4 py-3">
                            <ExpiryBadge expiresAt={r.expires_at} status={status} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setEditing(r)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => setDeleting(r)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {totalCount > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                Page {page + 1} of {Math.ceil(totalCount / PAGE_SIZE)} · {totalCount} total
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p, 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(page + 1) * PAGE_SIZE >= totalCount}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <GrantRewardsDialog
        open={grantOpen}
        onOpenChange={setGrantOpen}
        onGranted={() => {
          qc.invalidateQueries({ queryKey: ["rewards-list"] });
          qc.invalidateQueries({ queryKey: ["reward-stats"] });
        }}
      />

      <EditRewardDialog
        reward={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["rewards-list"] });
          qc.invalidateQueries({ queryKey: ["reward-stats"] });
          setEditing(null);
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this reward?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && deleting.remaining < deleting.amount
                ? `This reward has been partially used (${deleting.amount - deleting.remaining}/${deleting.amount} consumed). Already-used credits will not be refunded. Continue?`
                : "This will permanently remove the reward. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleting && deleteMut.mutate(deleting.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
  accent,
}: {
  label: string;
  value: number;
  loading?: boolean;
  accent?: boolean;
}) {
  return (
    <Card className={cn("rounded-2xl", accent && "border-primary/40 bg-primary/5")}>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        {loading ? (
          <Skeleton className="h-8 w-16 mt-2" />
        ) : (
          <p className="text-2xl font-bold mt-1">{value.toLocaleString()}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Grant dialog ──────────────────────────────────────────────────────────

function GrantRewardsDialog({
  open,
  onOpenChange,
  onGranted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onGranted: () => void;
}) {
  const [mode, setMode] = useState<"specific" | "tier" | "all">("specific");
  const [selectedUsers, setSelectedUsers] = useState<
    Array<{ user_id: string; label: string }>
  >([]);
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ user_id: string; full_name: string | null; email: string | null; subscription_tier: string }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [selectedTiers, setSelectedTiers] = useState<string[]>([]);
  const [confirmAll, setConfirmAll] = useState(false);
  const [amount, setAmount] = useState(10);
  const [reason, setReason] = useState("");
  const [expiryMode, setExpiryMode] = useState("30");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  // Tier counts
  const { data: tierCounts } = useQuery({
    queryKey: ["tier-counts"],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      for (const t of TIERS) {
        const { count } = await supabase
          .from("profiles")
          .select("user_id", { count: "exact", head: true })
          .eq("subscription_tier", t);
        counts[t] = count || 0;
      }
      const { count: total } = await supabase
        .from("profiles")
        .select("user_id", { count: "exact", head: true });
      counts.__total = total || 0;
      return counts;
    },
    enabled: open,
  });

  const recipientCount = useMemo(() => {
    if (mode === "specific") return selectedUsers.length;
    if (mode === "tier") {
      return selectedTiers.reduce((sum, t) => sum + (tierCounts?.[t] || 0), 0);
    }
    if (mode === "all" && confirmAll) return tierCounts?.__total || 0;
    return 0;
  }, [mode, selectedUsers, selectedTiers, confirmAll, tierCounts]);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await adminAction({
        operation: "search_users",
        data: { query: q, limit: 15 },
      });
      setSearchResults(res.users || []);
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSubmit = async () => {
    if (recipientCount === 0) {
      toast.error("Select at least one recipient");
      return;
    }
    if (amount < 1) {
      toast.error("Amount must be at least 1");
      return;
    }

    const payload: Record<string, unknown> = {
      operation: "bulk_grant_reward",
      data: {
        recipients: mode,
        amount,
        reason,
      },
    };
    const dataObj = payload.data as Record<string, unknown>;

    if (mode === "specific") {
      dataObj.user_ids = selectedUsers.map((u) => u.user_id);
    } else if (mode === "tier") {
      dataObj.tiers = selectedTiers;
    }

    if (expiryMode === "custom" && customDate) {
      dataObj.expires_at = customDate.toISOString();
    } else {
      dataObj.expires_in_days = parseInt(expiryMode, 10);
    }

    setSubmitting(true);
    try {
      const res = await adminAction(payload);
      toast.success(`Granted ${res.granted} reward(s) to ${res.user_count} user(s)`);
      onGranted();
      // reset
      setSelectedUsers([]);
      setSelectedTiers([]);
      setConfirmAll(false);
      setReason("");
      setAmount(10);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" /> Grant Reward Credits
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Recipients */}
          <div className="space-y-3">
            <Label>Recipients</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="specific" id="r-specific" />
                <Label htmlFor="r-specific" className="font-normal cursor-pointer">
                  Specific users
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="tier" id="r-tier" />
                <Label htmlFor="r-tier" className="font-normal cursor-pointer">
                  All users on tier(s)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="all" id="r-all" />
                <Label htmlFor="r-all" className="font-normal cursor-pointer">
                  All users
                </Label>
              </div>
            </RadioGroup>

            {mode === "specific" && (
              <div className="space-y-2">
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map((u) => (
                      <Badge key={u.user_id} variant="secondary" className="gap-1">
                        {u.label}
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedUsers((prev) =>
                              prev.filter((x) => x.user_id !== u.user_id)
                            )
                          }
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or referral code…"
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      runSearch(e.target.value);
                    }}
                    className="pl-9"
                  />
                </div>
                {userSearch.length >= 2 && (
                  <ScrollArea className="max-h-48 border rounded-xl">
                    {searching ? (
                      <div className="p-3 text-sm text-muted-foreground">Searching…</div>
                    ) : searchResults.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground">No matches</div>
                    ) : (
                      <div className="divide-y">
                        {searchResults.map((u) => {
                          const already = selectedUsers.some((s) => s.user_id === u.user_id);
                          const label = u.full_name || u.email || u.user_id.slice(0, 8);
                          return (
                            <button
                              key={u.user_id}
                              type="button"
                              disabled={already}
                              onClick={() => {
                                setSelectedUsers((prev) => [
                                  ...prev,
                                  { user_id: u.user_id, label },
                                ]);
                                setUserSearch("");
                                setSearchResults([]);
                              }}
                              className={cn(
                                "w-full text-left p-3 hover:bg-muted/50 transition flex items-center justify-between",
                                already && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <div>
                                <div className="font-medium text-sm">{label}</div>
                                <div className="text-xs text-muted-foreground">
                                  {u.email} · {u.subscription_tier}
                                </div>
                              </div>
                              {already && <Badge variant="outline">Added</Badge>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                )}
              </div>
            )}

            {mode === "tier" && (
              <div className="space-y-2 pl-1">
                {TIERS.map((t) => (
                  <div key={t} className="flex items-center gap-2">
                    <Checkbox
                      id={`tier-${t}`}
                      checked={selectedTiers.includes(t)}
                      onCheckedChange={(c) =>
                        setSelectedTiers((prev) =>
                          c ? [...prev, t] : prev.filter((x) => x !== t)
                        )
                      }
                    />
                    <Label htmlFor={`tier-${t}`} className="font-normal cursor-pointer capitalize">
                      {t} <span className="text-muted-foreground">({tierCounts?.[t] ?? 0})</span>
                    </Label>
                  </div>
                ))}
              </div>
            )}

            {mode === "all" && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <Checkbox
                  id="confirm-all"
                  checked={confirmAll}
                  onCheckedChange={(c) => setConfirmAll(c === true)}
                />
                <Label htmlFor="confirm-all" className="font-normal cursor-pointer text-sm">
                  Yes, grant to <strong>all {tierCounts?.__total ?? 0} users</strong> on the platform.
                </Label>
              </div>
            )}
          </div>

          {/* Amount + reason */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Credits per user</Label>
              <Input
                id="amount"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Expires in</Label>
              <Select value={expiryMode} onValueChange={setExpiryMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="custom">Custom date</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {expiryMode === "custom" && (
            <div className="space-y-2">
              <Label>Expiry date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {customDate ? format(customDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={customDate}
                    onSelect={setCustomDate}
                    disabled={(d) => d <= new Date()}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Contest winner, Apology, Promotion"
            />
          </div>

          {/* Live count */}
          <div className="rounded-xl bg-muted/50 p-3 flex items-center gap-2 text-sm">
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
            This will grant <strong>{(recipientCount * amount).toLocaleString()}</strong> credit(s)
            to <strong>{recipientCount.toLocaleString()}</strong> user(s).
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || recipientCount === 0 || amount < 1}
          >
            {submitting ? "Granting…" : `Grant to ${recipientCount} user(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit dialog ───────────────────────────────────────────────────────────

function EditRewardDialog({
  reward,
  onClose,
  onSaved,
}: {
  reward: RewardWithMeta | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  // Initialize when opened
  useEffect(() => {
    if (reward) {
      setAmount(reward.amount);
      setReason(reward.reason || "");
      setExpiresAt(new Date(reward.expires_at));
    }
  }, [reward]);

  if (!reward) return null;

  const consumed = reward.amount - reward.remaining;

  const handleSave = async () => {
    if (amount < consumed) {
      toast.error(`Amount cannot be less than already consumed (${consumed})`);
      return;
    }
    setSubmitting(true);
    try {
      await adminAction({
        operation: "update_reward",
        data: {
          id: reward.id,
          amount,
          reason,
          expires_at: expiresAt?.toISOString(),
        },
      });
      toast.success("Reward updated");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!reward} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Reward</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="text-sm text-muted-foreground">
            Recipient: <strong>{reward.recipient_name || reward.user_id.slice(0, 8) + "…"}</strong>
            <br />
            Consumed: <strong>{consumed}</strong> / {reward.amount}
          </div>
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input
              type="number"
              min={Math.max(1, consumed)}
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
            />
            {consumed > 0 && (
              <p className="text-xs text-muted-foreground">
                Minimum: {consumed} (already consumed)
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Expires at</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start font-normal">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {expiresAt ? format(expiresAt, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={expiresAt}
                  onSelect={setExpiresAt}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
