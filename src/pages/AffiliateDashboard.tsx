import SEO from "@/components/SEO";
import NewAppHeader from "@/components/v2/NewAppHeader";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import {
  Clock,
  Loader2,
  ArrowRight,
  Trophy,
  CheckCircle2,
  DollarSign,
  Users,
  Users2,
  Megaphone,
  Wallet,
  CalendarClock,
} from "lucide-react";
import AffiliateHeader from "@/components/affiliate/AffiliateHeader";
import ShareKitCard from "@/components/affiliate/ShareKitCard";
import MarketingKitTab from "@/components/affiliate/MarketingKitTab";
import NetworkTree from "@/components/affiliate/NetworkTree";
import PayoutTimeline from "@/components/affiliate/PayoutTimeline";
import EmptyState from "@/components/affiliate/EmptyState";
import { MILESTONES, MIN_PAYOUT_NGN, PAYOUT_PROCESSING_DAYS, formatNgn } from "@/lib/affiliateConfig";

interface Affiliate {
  id: string;
  affiliate_code: string;
  status: string;
  commission_rate: number;
  total_earned: number;
  total_paid: number;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  recruited_by: string | null;
  milestones_notified: number[];
}

interface Referral {
  id: string;
  referred_user_id: string;
  status: string;
  created_at: string;
  payment_count: number;
}

interface Commission {
  id: string;
  payment_amount: number;
  commission_amount: number;
  status: string;
  created_at: string;
  commission_type: string;
}

interface Payout {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  processed_at: string | null;
}

interface NetworkAffiliate {
  id: string;
  affiliate_code: string;
  status: string;
  created_at: string;
}

const COMMISSION_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  tier1_first: { label: "Direct · First", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  tier1_recurring: { label: "Direct · Recurring", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  tier2_first: { label: "Network · First", color: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300" },
  tier2_recurring: { label: "Network · Recurring", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
};

const MilestonesSection = ({ totalEarned }: { totalEarned: number }) => {
  const nextMilestone = MILESTONES.find((m) => totalEarned < m.amount);
  const progress = nextMilestone
    ? Math.min(100, (totalEarned / nextMilestone.amount) * 100)
    : 100;
  const [newlyUnlocked, setNewlyUnlocked] = useState<number | null>(null);
  const confettiFired = useRef(false);

  useEffect(() => {
    if (confettiFired.current) return;
    const storageKey = "brandie_milestones_seen";
    const seen: number[] = JSON.parse(localStorage.getItem(storageKey) || "[]");
    const earnedMilestones = MILESTONES.filter((m) => totalEarned >= m.amount).map((m) => m.amount);
    const newOnes = earnedMilestones.filter((a) => !seen.includes(a));

    if (newOnes.length > 0) {
      confettiFired.current = true;
      const highest = Math.max(...newOnes);
      setNewlyUnlocked(highest);
      localStorage.setItem(storageKey, JSON.stringify(earnedMilestones));

      import("canvas-confetti").then((mod) => {
        const confetti = mod.default;
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        setTimeout(() => {
          confetti({ particleCount: 50, spread: 100, origin: { y: 0.65 }, angle: 60 });
          confetti({ particleCount: 50, spread: 100, origin: { y: 0.65 }, angle: 120 });
        }, 300);
      });

      setTimeout(() => setNewlyUnlocked(null), 4000);
    } else {
      localStorage.setItem(storageKey, JSON.stringify(earnedMilestones));
    }
  }, [totalEarned]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" /> Milestones
        </h3>
        {nextMilestone && (
          <span className="text-xs text-muted-foreground">
            {formatNgn(nextMilestone.amount - totalEarned)} to {nextMilestone.title}
          </span>
        )}
      </div>

      {nextMilestone && (
        <div className="space-y-1.5">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{formatNgn(totalEarned)}</span>
            <span>{nextMilestone.label}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
        {MILESTONES.map((m) => {
          const earned = totalEarned >= m.amount;
          const isNext = nextMilestone?.amount === m.amount;
          const justUnlocked = newlyUnlocked === m.amount;
          return (
            <motion.div
              key={m.amount}
              animate={justUnlocked ? { scale: [1, 1.15, 1], transition: { duration: 0.6, repeat: 2 } } : {}}
              className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${
                earned
                  ? justUnlocked
                    ? "bg-primary/20 border-2 border-primary shadow-lg shadow-primary/20"
                    : "bg-primary/10 border border-primary/30"
                  : isNext
                  ? "bg-muted/80 border border-dashed border-primary/40"
                  : "bg-muted/40 border border-transparent opacity-50"
              }`}
            >
              <span className={`text-2xl ${earned ? "" : "grayscale opacity-60"}`}>{m.emoji}</span>
              <span className={`text-[10px] font-semibold ${earned ? "text-primary" : "text-muted-foreground"}`}>
                {m.label}
              </span>
              <span className={`text-[9px] ${earned ? "text-foreground" : "text-muted-foreground"}`}>
                {m.title}
              </span>
              {earned && (
                <CheckCircle2 className="absolute -top-1 -right-1 h-4 w-4 text-primary fill-background" />
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

const AffiliateDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [networkAffiliates, setNetworkAffiliates] = useState<NetworkAffiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("commissions");

  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [requestingPayout, setRequestingPayout] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    const { data: aff } = await supabase
      .from("affiliates")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!aff) {
      navigate("/affiliate/signup");
      return;
    }

    setAffiliate(aff as any);
    setBankName(aff.bank_name || "");
    setAccountNumber(aff.account_number || "");
    setAccountName(aff.account_name || "");

    const [refRes, comRes, payRes, netRes] = await Promise.all([
      supabase
        .from("affiliate_referrals")
        .select("*")
        .eq("affiliate_id", aff.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("affiliate_commissions")
        .select("*")
        .eq("affiliate_id", aff.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("affiliate_payouts")
        .select("*")
        .eq("affiliate_id", aff.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("affiliates")
        .select("id, affiliate_code, status, created_at")
        .eq("recruited_by", aff.id)
        .order("created_at", { ascending: false }),
    ]);

    setReferrals((refRes.data || []) as any);
    setCommissions((comRes.data || []) as any);
    setPayouts((payRes.data || []) as any);
    setNetworkAffiliates((netRes.data || []) as any);
    setLoading(false);
  };

  const saveBankDetails = async () => {
    if (!affiliate) return;
    await supabase
      .from("affiliates")
      .update({ bank_name: bankName, account_number: accountNumber, account_name: accountName })
      .eq("id", affiliate.id);
    toast({ title: "Bank details saved" });
  };

  const requestPayout = async () => {
    if (!affiliate || !payoutAmount) return;
    const amt = parseFloat(payoutAmount);
    const available = affiliate.total_earned - affiliate.total_paid;
    if (amt <= 0 || amt > available) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    if (amt < MIN_PAYOUT_NGN) {
      toast({
        title: `Minimum payout is ${formatNgn(MIN_PAYOUT_NGN)}`,
        variant: "destructive",
      });
      return;
    }
    if (!bankName || !accountNumber || !accountName) {
      toast({ title: "Please save bank details first", variant: "destructive" });
      return;
    }

    setRequestingPayout(true);
    const { error } = await supabase.from("affiliate_payouts").insert({
      affiliate_id: affiliate.id,
      amount: amt,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Payout requested!", description: `We'll process it within ${PAYOUT_PROCESSING_DAYS}.` });
      setPayoutAmount("");
      loadData();
    }
    setRequestingPayout(false);
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!affiliate) return null;

  const availableBalance = affiliate.total_earned - affiliate.total_paid;
  const directEarnings = commissions
    .filter((c) => c.commission_type.startsWith("tier1"))
    .reduce((s, c) => s + c.commission_amount, 0);
  const networkEarnings = commissions
    .filter((c) => c.commission_type.startsWith("tier2"))
    .reduce((s, c) => s + c.commission_amount, 0);
  const pendingCommissions = commissions
    .filter((c) => c.status === "pending")
    .reduce((s, c) => s + c.commission_amount, 0);

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
      paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
      signed_up: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      converted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
      requested: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      processing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
      suspended: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    };
    return (
      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${colors[status] || "bg-muted text-muted-foreground"}`}>
        {status}
      </span>
    );
  };

  if (affiliate.status === "pending") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4 max-w-md"
        >
          <div className="h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
            <Clock className="h-8 w-8 text-amber-600 dark:text-amber-300" />
          </div>
          <h2 className="text-2xl font-serif tracking-tight">Application Under Review</h2>
          <p className="text-muted-foreground">
            Your affiliate application is being reviewed. We'll notify you once approved.
          </p>
          <Button variant="outline" className="rounded-xl" onClick={() => navigate("/")}>
            Back to Home
          </Button>
        </motion.div>
      </div>
    );
  }

  const referralLink = `${window.location.origin}/auth?aff=${affiliate.affiliate_code}`;
  const recruitLink = `${window.location.origin}/affiliate/signup?ref=${affiliate.affiliate_code}`;

  return (
    <div className="min-h-screen bg-background lg:pl-20 pb-24">
      <SEO title="Affiliate Dashboard, Brandie" description="Track referrals, commissions, and milestones." path="/affiliate" noindex />
      <NewAppHeader />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Header & stats */}
        <AffiliateHeader
          totalEarned={affiliate.total_earned}
          directEarnings={directEarnings}
          networkEarnings={networkEarnings}
          pendingCommissions={pendingCommissions}
          availableBalance={availableBalance}
          onRequestPayout={() => setActiveTab("payouts")}
        />

        {/* Milestones */}
        <MilestonesSection totalEarned={affiliate.total_earned} />

        {/* Share kit */}
        <ShareKitCard
          referralLink={referralLink}
          recruitLink={recruitLink}
          recruitedCount={networkAffiliates.length}
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="commissions">Commissions</TabsTrigger>
            <TabsTrigger value="referrals">Referrals</TabsTrigger>
            <TabsTrigger value="network">Network</TabsTrigger>
            <TabsTrigger value="kit">Marketing Kit</TabsTrigger>
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
          </TabsList>

          {/* Commissions */}
          <TabsContent value="commissions">
            <div className="rounded-2xl border border-border p-5 space-y-4">
              <h3 className="font-medium">Commissions ({commissions.length})</h3>
              {commissions.length === 0 ? (
                <EmptyState
                  icon={DollarSign}
                  title="No commissions yet"
                  description="Once a referred user makes a payment, your commission lands here automatically."
                  ctaLabel="Copy referral link"
                  onCta={() => {
                    navigator.clipboard.writeText(referralLink);
                    toast({ title: "Link copied!" });
                  }}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b border-border">
                        <th className="pb-2 font-medium">Type</th>
                        <th className="pb-2 font-medium">Payment</th>
                        <th className="pb-2 font-medium">Commission</th>
                        <th className="pb-2 font-medium">Date</th>
                        <th className="pb-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commissions.map((c) => {
                        const typeInfo = COMMISSION_TYPE_LABELS[c.commission_type] || { label: c.commission_type, color: "bg-muted text-muted-foreground" };
                        return (
                          <tr key={c.id} className="border-b border-border/50">
                            <td className="py-2.5">
                              <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${typeInfo.color}`}>
                                {typeInfo.label}
                              </span>
                            </td>
                            <td className="py-2.5">{formatNgn(c.payment_amount)}</td>
                            <td className="py-2.5 font-medium text-emerald-600 dark:text-emerald-400">
                              {formatNgn(c.commission_amount)}
                            </td>
                            <td className="py-2.5">{new Date(c.created_at).toLocaleDateString()}</td>
                            <td className="py-2.5">{statusBadge(c.status)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Referrals */}
          <TabsContent value="referrals">
            <div className="rounded-2xl border border-border p-5 space-y-4">
              <h3 className="font-medium">Referrals ({referrals.length})</h3>
              {referrals.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No referrals yet"
                  description="Share your link in a post, story, newsletter or DM to get your first signup."
                  ctaLabel="Copy referral link"
                  onCta={() => {
                    navigator.clipboard.writeText(referralLink);
                    toast({ title: "Link copied!" });
                  }}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b border-border">
                        <th className="pb-2 font-medium">User</th>
                        <th className="pb-2 font-medium">Date</th>
                        <th className="pb-2 font-medium">Payments</th>
                        <th className="pb-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referrals.map((r) => (
                        <tr key={r.id} className="border-b border-border/50">
                          <td className="py-2.5 font-mono text-xs">{r.referred_user_id.slice(0, 8)}…</td>
                          <td className="py-2.5">{new Date(r.created_at).toLocaleDateString()}</td>
                          <td className="py-2.5">{r.payment_count || 0}</td>
                          <td className="py-2.5">{statusBadge(r.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Network */}
          <TabsContent value="network">
            {networkAffiliates.length === 0 ? (
              <div className="rounded-2xl border border-border p-5">
                <EmptyState
                  icon={Users2}
                  title="No recruits yet"
                  description="Share your recruitment link to earn 5% first + 3% lifetime from each recruit's referrals."
                  ctaLabel="Copy recruitment link"
                  onCta={() => {
                    navigator.clipboard.writeText(recruitLink);
                    toast({ title: "Link copied!" });
                  }}
                />
              </div>
            ) : (
              <NetworkTree recruits={networkAffiliates} networkEarnings={networkEarnings} />
            )}
          </TabsContent>

          {/* Marketing Kit */}
          <TabsContent value="kit">
            <MarketingKitTab referralLink={referralLink} />
          </TabsContent>

          {/* Payouts */}
          <TabsContent value="payouts">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="rounded-2xl border border-border p-5 space-y-4">
                <h3 className="font-medium">Bank Details</h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Bank Name</Label>
                    <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Access Bank" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Account Number</Label>
                    <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="0123456789" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Account Name</Label>
                    <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Jane Smith" />
                  </div>
                  <Button variant="outline" className="w-full rounded-xl" onClick={saveBankDetails}>
                    Save Details
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-border p-5 space-y-4">
                <h3 className="font-medium">Request Payout</h3>
                <div className="space-y-1 text-sm">
                  <p className="text-muted-foreground">
                    Available: <span className="font-medium text-foreground">{formatNgn(availableBalance)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Wallet className="h-3 w-3" /> Minimum payout: {formatNgn(MIN_PAYOUT_NGN)}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <CalendarClock className="h-3 w-3" /> Processed within {PAYOUT_PROCESSING_DAYS}
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Amount (₦)</Label>
                    <Input
                      type="number"
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                      placeholder={`${MIN_PAYOUT_NGN}`}
                      min={MIN_PAYOUT_NGN}
                      max={availableBalance}
                    />
                  </div>
                  <Button
                    className="w-full rounded-xl gap-2"
                    disabled={requestingPayout || availableBalance < MIN_PAYOUT_NGN}
                    onClick={requestPayout}
                  >
                    {requestingPayout ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    Request Payout
                  </Button>
                </div>
              </div>

              {/* History full-width */}
              <div className="sm:col-span-2 rounded-2xl border border-border p-5 space-y-4">
                <h3 className="font-medium">Payout history</h3>
                {payouts.length === 0 ? (
                  <EmptyState
                    icon={Megaphone}
                    title="No payouts yet"
                    description="Once you've earned at least the minimum, request your first payout above."
                  />
                ) : (
                  <div className="space-y-3">
                    {payouts.map((p) => (
                      <div
                        key={p.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/60 p-4"
                      >
                        <div className="flex items-center gap-3">
                          <Wallet className="h-4 w-4 text-primary" />
                          <div>
                            <p className="font-medium">{formatNgn(p.amount)}</p>
                            <p className="text-[11px] text-muted-foreground">
                              Requested {new Date(p.created_at).toLocaleDateString()}
                              {p.processed_at && ` · Paid ${new Date(p.processed_at).toLocaleDateString()}`}
                            </p>
                          </div>
                        </div>
                        <PayoutTimeline status={p.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AffiliateDashboard;
