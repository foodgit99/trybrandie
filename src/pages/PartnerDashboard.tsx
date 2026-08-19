import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getAccessToken } from "@/lib/authStore";
import { useAuth } from "@/hooks/useAuth";
import { useAffiliateRole } from "@/hooks/useAffiliateRole";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AtSign, Copy, Gift, Loader2, Mail, Megaphone, Users, Workflow, ArrowUpRight } from "lucide-react";
import CampaignManager from "@/components/campaign/CampaignManager";

import SEO from "@/components/SEO";
import NewAppHeader from "@/components/v2/NewAppHeader";
import PartnerLeadsTable, { type PartnerLead } from "@/components/partner/PartnerLeadsTable";
import LeadDetailDialog from "@/components/partner/LeadDetailDialog";
import PartnerCampaignsPanel from "@/components/partner/PartnerCampaignsPanel";
import PartnerAutomationsPanel from "@/components/partner/PartnerAutomationsPanel";
import PartnerIdentityPanel from "@/components/partner/PartnerIdentityPanel";
import PartnerCreditsPanel from "@/components/partner/PartnerCreditsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { partnerReferralUrl } from "@/lib/partnerRef";


interface Overview {
  partner: {
    id: string;
    name: string;
    partner_type: string;
    slug: string;
    status: string;
    commission_first_pct: number;
    commission_recurring_pct: number;
  };
  link: { code: string; active: boolean; clicks: number };
  metrics: {
    leads: number;
    activated: number;
    paying: number;
    conversion: number;
    credits_distributed: number;
    week: { new_leads: number; activated: number; paid: number };
    statuses: Record<string, number>;
  };
}

const Metric = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-2xl border border-border bg-card p-5">
    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
    <p className="mt-2 font-serif text-3xl tracking-tight">{value}</p>
  </div>
);

export default function PartnerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { isAffiliate } = useAffiliateRole();

  const { toast } = useToast();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [leads, setLeads] = useState<PartnerLead[]>([]);
  const [selected, setSelected] = useState<PartnerLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);

      // Check partner membership first so non-partners never trigger a 403 from the portal.
      const { data: profile } = await supabase
        .from("partner_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) {
        setDenied(true);
        setLoading(false);
        return;
      }

      const auth = { Authorization: `Bearer ${await getAccessToken()}` };

      const [ov, ld] = await Promise.all([
        supabase.functions.invoke("partner-portal", { body: { action: "overview" }, headers: auth }),
        supabase.functions.invoke("partner-portal", { body: { action: "leads" }, headers: auth }),
      ]);

      if (ov.error || (ov.data as any)?.error) {
        setDenied(true);
        setLoading(false);
        return;
      }
      setOverview(ov.data as Overview);
      setLeads(((ld.data as any)?.leads as PartnerLead[]) || []);
      setLoading(false);
    })();
  }, [user?.id]);


  if (authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth?next=/partner" replace />;

  const link = overview ? partnerReferralUrl(overview.link.code) : "";

  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    toast({ title: "Referral link copied" });
  };

  return (
    <div className="min-h-dvh bg-background lg:pl-20 pb-24">
      <SEO
        title="Partner dashboard, Brandie"
        description="Track the users you bring to Brandie, their activation and conversion."
        path="/partner"
        noindex
      />
      <NewAppHeader />

      <main className="max-w-5xl mx-auto px-5 sm:px-8 pt-8 sm:pt-12 space-y-10">
        {denied ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-2">
            <h1 className="font-serif text-3xl">Partner access required</h1>
            <p className="text-sm text-muted-foreground">
              This area is for Brandie Marketing Partners. Reach out to the Brandie team if you'd like to become one.
            </p>
          </div>
        ) : loading || !overview ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-10">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your partnership
          </div>
        ) : (
          <>
            <header className="space-y-3">
              <p className="text-xs tracking-[0.22em] uppercase text-muted-foreground">Marketing Partner</p>
              <h1 className="font-serif text-4xl sm:text-5xl tracking-tight leading-[1]">
                {overview.partner.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full border-0">
                  {overview.partner.status === "active" ? "Active" : overview.partner.status}
                </Badge>
              </div>
              {isAffiliate && (
                <Button asChild variant="outline" className="rounded-xl gap-2">
                  <Link to="/affiliate">
                    Affiliate dashboard <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}

            </header>

            <section className="space-y-3">
              <h2 className="text-xs tracking-[0.22em] uppercase text-muted-foreground">Referral link</h2>
              <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <code className="flex-1 rounded-xl bg-muted px-3 py-2 text-sm break-all">{link}</code>
                  <Button className="rounded-xl gap-2" onClick={copyLink}>
                    <Copy className="h-4 w-4" /> Copy link
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {overview.link.clicks} clicks tracked. Anyone who signs up through this link is permanently
                  attributed to you.
                </p>
              </div>
            </section>

            <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Metric label="Leads" value={overview.metrics.leads} />
              <Metric label="Activated" value={overview.metrics.activated} />
              <Metric label="Paying" value={overview.metrics.paying} />
              <Metric label="Conversion" value={`${overview.metrics.conversion.toFixed(1)}%`} />
              <Metric label="Credits used" value={overview.metrics.credits_distributed} />
            </section>

            <section className="space-y-3">
              <h2 className="text-xs tracking-[0.22em] uppercase text-muted-foreground">This week</h2>
              <div className="rounded-2xl border border-border bg-card p-5 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">New leads</p>
                  <p className="mt-1 text-2xl tabular-nums">{overview.metrics.week.new_leads}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Activated</p>
                  <p className="mt-1 text-2xl tabular-nums">{overview.metrics.week.activated}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Paid</p>
                  <p className="mt-1 text-2xl tabular-nums">{overview.metrics.week.paid}</p>
                </div>
              </div>
            </section>

            <section className="space-y-3 pb-10">
              <Tabs defaultValue="leads">
                <TabsList className="rounded-xl w-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <TabsTrigger value="leads" className="rounded-lg gap-2 shrink-0">
                    <Users className="h-3.5 w-3.5" /> My leads
                  </TabsTrigger>
                  <TabsTrigger value="campaigns" className="rounded-lg gap-2 shrink-0">
                    <Mail className="h-3.5 w-3.5" /> Campaigns
                  </TabsTrigger>
                  <TabsTrigger value="automations" className="rounded-lg gap-2 shrink-0">
                    <Workflow className="h-3.5 w-3.5" /> Automations
                  </TabsTrigger>
                  <TabsTrigger value="credits" className="rounded-lg gap-2 shrink-0">
                    <Gift className="h-3.5 w-3.5" /> Credits
                  </TabsTrigger>
                  <TabsTrigger value="pages" className="rounded-lg gap-2 shrink-0">
                    <Megaphone className="h-3.5 w-3.5" /> Campaign pages
                  </TabsTrigger>
                  <TabsTrigger value="identity" className="rounded-lg gap-2 shrink-0">
                    <AtSign className="h-3.5 w-3.5" /> Identity
                  </TabsTrigger>

                </TabsList>


                <TabsContent value="leads" className="mt-5">
                  <PartnerLeadsTable leads={leads} onSelect={setSelected} />
                </TabsContent>
                <TabsContent value="campaigns" className="mt-5">
                  <PartnerCampaignsPanel partnerId={overview.partner.id} />
                </TabsContent>
                <TabsContent value="automations" className="mt-5">
                  <PartnerAutomationsPanel partnerId={overview.partner.id} />
                </TabsContent>
                <TabsContent value="credits" className="mt-5">
                  <PartnerCreditsPanel partnerId={overview.partner.id} />
                </TabsContent>
                <TabsContent value="pages" className="mt-5">
                  <CampaignManager />
                </TabsContent>
                <TabsContent value="identity" className="mt-5">


                  <PartnerIdentityPanel
                    partnerId={overview.partner.id}
                    partnerName={overview.partner.name}
                    userId={user.id}
                  />
                </TabsContent>
              </Tabs>
            </section>

          </>
        )}
      </main>

      <LeadDetailDialog lead={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
