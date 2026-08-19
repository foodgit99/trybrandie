import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAccessToken } from "@/lib/authStore";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Gift, Loader2, Send } from "lucide-react";

const callPortal = async (body: Record<string, unknown>) => {
  const accessToken = await getAccessToken();
  const { data, error } = await supabase.functions.invoke("partner-portal", {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error) {
    let details = error.message;
    const ctx = (error as any)?.context;
    if (ctx && typeof ctx.text === "function") {
      try {
        const raw = await ctx.text();
        details = JSON.parse(raw)?.error || raw;
      } catch {
        /* keep original message */
      }
    }
    throw new Error(details);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
};

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

const STATUS_COPY: Record<string, string> = {
  pending: "Waiting for Brandie review",
  approved: "Live",
  rejected: "Not approved",
  paused: "Paused by Brandie",
  exhausted: "Budget used up",
  expired: "Ended",
};

export default function PartnerCreditsPanel({ partnerId }: { partnerId: string }) {
  const { toast } = useToast();
  const [perSignup, setPerSignup] = useState("5");
  const [budget, setBudget] = useState("100");
  const [endsAt, setEndsAt] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: grants, isLoading, refetch } = useQuery({
    queryKey: ["partner-credit-grants", partnerId],
    queryFn: async () => ((await callPortal({ action: "credit_grants" }))?.grants || []) as any[],
  });

  const active = (grants || []).find((g) => g.status === "pending" || g.status === "approved");
  const history = (grants || []).filter((g) => g.id !== active?.id);

  const submit = async () => {
    setSubmitting(true);
    try {
      await callPortal({
        action: "credit_grant_request",
        credits_per_signup: Number(perSignup),
        total_budget_credits: Number(budget),
        ends_at: endsAt,
        request_note: note,
      });
      toast({
        title: "Request sent",
        description: "Brandie will review it and email you the decision.",
      });
      setNote("");
      refetch();
    } catch (e: any) {
      toast({ title: "Couldn't send the request", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const GrantCard = ({ g, main }: { g: any; main?: boolean }) => {
    const used = Number(g.credits_granted || 0);
    const total = Number(g.total_budget_credits || 0);
    const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
    return (
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">
            {g.credits_per_signup} credits per signup
          </span>
          <Badge
            variant={g.status === "approved" ? "default" : g.status === "pending" ? "secondary" : "outline"}
            className="rounded-full text-[11px]"
          >
            {STATUS_COPY[g.status] || g.status}
          </Badge>
          <span className="ml-auto text-xs text-muted-foreground">Requested {fmtDate(g.created_at)}</span>
        </div>

        {main && (
          <>
            <Progress value={pct} className="h-2" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Given out</p>
                <p className="tabular-nums">{used}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Remaining</p>
                <p className="tabular-nums">{Math.max(0, total - used)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Leads credited</p>
                <p className="tabular-nums">{g.leads_credited || 0}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Runs until</p>
                <p>{fmtDate(g.ends_at)}</p>
              </div>
            </div>
          </>
        )}

        {!main && (
          <p className="text-xs text-muted-foreground">
            Budget {total} credits · {g.leads_credited || 0} leads credited · ended {fmtDate(g.ends_at)}
          </p>
        )}

        {g.review_note && (
          <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">Brandie: {g.review_note}</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-4 w-4" /> Signup credits for your leads
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ask Brandie to gift free credits to everyone who signs up through your referral link. Once approved,
            new signups get the credits instantly (they expire 30 days after signup) and the campaign keeps running
            until the budget is used up.
          </p>


          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your credits campaign
            </div>
          ) : active ? (
            <GrantCard g={active} main />
          ) : (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Credits per signup</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={perSignup}
                    onChange={(e) => setPerSignup(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Total budget (credits)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Run until</Label>
                  <Input
                    type="date"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Why do you need this? (optional)</Label>
                <Textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. running a two-week campus activation, 40 signups expected"
                  className="rounded-xl"
                />
              </div>
              <Button
                onClick={submit}
                disabled={submitting || !perSignup || !budget || !endsAt}
                className="w-full rounded-xl"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-1.5" />
                )}
                Send request to Brandie
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs tracking-[0.22em] uppercase text-muted-foreground">Past requests</h3>
          {history.map((g) => (
            <GrantCard key={g.id} g={g} />
          ))}
        </div>
      )}
    </div>
  );
}
