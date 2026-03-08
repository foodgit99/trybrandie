import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import {
  DollarSign,
  Users,
  Clock,
  Copy,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Wallet,
  Share2,
} from "lucide-react";

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
}

interface Referral {
  id: string;
  referred_user_id: string;
  status: string;
  created_at: string;
}

interface Commission {
  id: string;
  payment_amount: number;
  commission_amount: number;
  status: string;
  created_at: string;
}

interface Payout {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  processed_at: string | null;
}

const AffiliateDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Bank details for payout
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

    setAffiliate(aff as Affiliate);
    setBankName(aff.bank_name || "");
    setAccountNumber(aff.account_number || "");
    setAccountName(aff.account_name || "");

    // Load referrals, commissions, payouts in parallel
    const [refRes, comRes, payRes] = await Promise.all([
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
    ]);

    setReferrals((refRes.data || []) as Referral[]);
    setCommissions((comRes.data || []) as Commission[]);
    setPayouts((payRes.data || []) as Payout[]);
    setLoading(false);
  };

  const copyLink = () => {
    if (!affiliate) return;
    const link = `${window.location.origin}/auth?aff=${affiliate.affiliate_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Link copied!" });
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
      toast({ title: "Payout requested!", description: "We'll process it within 3–5 business days." });
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl sm:text-3xl font-serif tracking-tight">Affiliate Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Commission rate: <span className="font-medium text-foreground">{(affiliate.commission_rate * 100).toFixed(0)}%</span>
          </p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Earned", value: `₦${affiliate.total_earned.toLocaleString()}`, icon: DollarSign },
            { label: "Available Balance", value: `₦${availableBalance.toLocaleString()}`, icon: Wallet },
            { label: "Pending", value: `₦${pendingCommissions.toLocaleString()}`, icon: Clock },
            { label: "Referrals", value: referrals.length.toString(), icon: Users },
          ].map((s) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border p-4 space-y-1"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <s.icon className="h-4 w-4" />
                <span className="text-xs">{s.label}</span>
              </div>
              <p className="text-xl font-serif tracking-tight">{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Affiliate Link */}
        <div className="rounded-2xl border border-border p-5 space-y-3">
          <h3 className="font-medium">Your Affiliate Link</h3>
          <div className="flex gap-2">
            <Input
              readOnly
              value={`${window.location.origin}/auth?aff=${affiliate.affiliate_code}`}
              className="font-mono text-sm"
            />
            <Button variant="outline" className="rounded-xl shrink-0 gap-2" onClick={copyLink}>
              {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-2 text-xs"
              onClick={() => {
                const url = `${window.location.origin}/auth?aff=${affiliate.affiliate_code}`;
                const text = encodeURIComponent(`Join Brandie and grow your brand! Check it out here: ${url}`);
                window.open(`https://wa.me/?text=${text}`, "_blank");
              }}
            >
              <Share2 className="h-3.5 w-3.5" />
              WhatsApp
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-2 text-xs"
              onClick={() => {
                const url = `${window.location.origin}/auth?aff=${affiliate.affiliate_code}`;
                const text = encodeURIComponent(`Join Brandie and grow your brand! Check it out here: ${url}`);
                window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
              }}
            >
              <Share2 className="h-3.5 w-3.5" />
              X / Twitter
            </Button>
          </div>
        </div>

        {/* Referrals */}
        <div className="rounded-2xl border border-border p-5 space-y-4">
          <h3 className="font-medium">Referrals ({referrals.length})</h3>
          {referrals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No referrals yet. Share your link to get started!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="pb-2 font-medium">User</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="py-2.5 font-mono text-xs">
                        {r.referred_user_id.slice(0, 8)}…
                      </td>
                      <td className="py-2.5">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="py-2.5">{statusBadge(r.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Commissions */}
        <div className="rounded-2xl border border-border p-5 space-y-4">
          <h3 className="font-medium">Commissions ({commissions.length})</h3>
          {commissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No commissions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="pb-2 font-medium">Payment</th>
                    <th className="pb-2 font-medium">Commission</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.id} className="border-b border-border/50">
                      <td className="py-2.5">₦{c.payment_amount.toLocaleString()}</td>
                      <td className="py-2.5 font-medium text-emerald-600 dark:text-emerald-400">
                        ₦{c.commission_amount.toLocaleString()}
                      </td>
                      <td className="py-2.5">{new Date(c.created_at).toLocaleDateString()}</td>
                      <td className="py-2.5">{statusBadge(c.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payout Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Bank Details */}
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

          {/* Request Payout */}
          <div className="rounded-2xl border border-border p-5 space-y-4">
            <h3 className="font-medium">Request Payout</h3>
            <p className="text-sm text-muted-foreground">
              Available: <span className="font-medium text-foreground">₦{availableBalance.toLocaleString()}</span>
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Amount (₦)</Label>
                <Input
                  type="number"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  placeholder="5000"
                  min={1}
                  max={availableBalance}
                />
              </div>
              <Button
                className="w-full rounded-xl gap-2"
                disabled={requestingPayout || availableBalance <= 0}
                onClick={requestPayout}
              >
                {requestingPayout ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Request Payout
              </Button>
            </div>

            {/* Payout History */}
            {payouts.length > 0 && (
              <div className="pt-4 border-t border-border space-y-2">
                <h4 className="text-sm font-medium">History</h4>
                {payouts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span>₦{p.amount.toLocaleString()}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
                      {statusBadge(p.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AffiliateDashboard;
