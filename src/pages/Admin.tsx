import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole } from "@/hooks/useAdminRole";
import NewAppHeader from "@/components/v2/NewAppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { toast } from "sonner";
import {
  Users,
  Palette,
  Image,
  UserCheck,
  DollarSign,
  Search,
  Pencil,
  Trash2,
  BarChart3,
  RefreshCw,
  Send,
  Eye,
  CheckCircle2,
  Link,
  Mail,
  Calendar,
  Plus,
  Copy,
  Clock,
  FileText,
  ArrowLeft,
  Filter,
  CalendarIcon,
  X,
  Gift,
  TrendingUp,
  Wallet,
  Users2,
  CreditCard,
  LifeBuoy,
} from "lucide-react";
import { format } from "date-fns";
import DesignViewer from "@/components/DesignViewer";
import AdminTracesTab from "@/components/admin/AdminTracesTab";
import RewardsTab from "@/components/admin/RewardsTab";
import SubscriptionsTab from "@/components/admin/SubscriptionsTab";
import SupportTab from "@/components/admin/SupportTab";
import AdminPartnersTab from "@/components/admin/AdminPartnersTab";


const TABLES = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "support", label: "Support", icon: LifeBuoy },
  { key: "email_crm", label: "Email CRM", icon: Mail },
  { key: "email_aliases", label: "Email Aliases", icon: Mail },
  { key: "profiles", label: "Users", icon: Users },

  { key: "brands", label: "Brands", icon: Palette },
  { key: "designs", label: "Designs", icon: Image },
  { key: "subscriptions", label: "Subscriptions", icon: CreditCard },
  { key: "affiliates", label: "Affiliates", icon: UserCheck },
  { key: "partners", label: "Partners", icon: UserCheck },

  { key: "affiliate_commissions", label: "Commissions", icon: DollarSign },
  { key: "affiliate_payouts", label: "Payouts", icon: DollarSign },
  { key: "rewards", label: "Rewards", icon: Gift },
  { key: "user_roles", label: "Roles", icon: Users },
  { key: "ai_traces", label: "AI Traces", icon: BarChart3 },
];

async function adminAction(payload: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

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
    const err = await res.json();
    throw new Error(err.error || "Admin action failed");
  }

  return res.json();
}

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
}) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminAction({ operation: "stats" }),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  const stats = data?.stats || {};

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Dashboard Overview</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={stats.profiles || 0} icon={Users} />
        <StatCard title="Brands" value={stats.brands || 0} icon={Palette} />
        <StatCard title="Designs" value={stats.designs || 0} icon={Image} />
        <StatCard title="Affiliates" value={stats.affiliates || 0} icon={UserCheck} />
      </div>
    </div>
  );
}

// ─── Email CRM Tab ────────────────────────────────────────────────────────────

interface SegmentFilters {
  tier: string[];
  has_brand: boolean;
  signed_up_after: string;
  signed_up_before: string;
  min_designs: number;
  has_referrals: boolean;
}

const DEFAULT_FILTERS: SegmentFilters = {
  tier: [],
  has_brand: false,
  signed_up_after: "",
  signed_up_before: "",
  min_designs: 0,
  has_referrals: false,
};

const TIER_OPTIONS = ["free", "entrepreneur", "creator", "agency"];

function SegmentBuilder({
  filters,
  onChange,
  recipientCount,
  countLoading,
}: {
  filters: SegmentFilters;
  onChange: (f: SegmentFilters) => void;
  recipientCount: number | null;
  countLoading: boolean;
}) {
  const toggleTier = (tier: string) => {
    const newTiers = filters.tier.includes(tier)
      ? filters.tier.filter((t) => t !== tier)
      : [...filters.tier, tier];
    onChange({ ...filters, tier: newTiers });
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Audience Segment
        </CardTitle>
        <CardDescription>Define who should receive this email</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Subscription tiers */}
        <div className="space-y-2">
          <Label className="text-sm">Subscription Tier</Label>
          <div className="flex flex-wrap gap-2">
            {TIER_OPTIONS.map((tier) => (
              <Badge
                key={tier}
                variant={filters.tier.includes(tier) ? "default" : "outline"}
                className="cursor-pointer capitalize rounded-lg px-3 py-1.5 transition-colors"
                onClick={() => toggleTier(tier)}
              >
                {tier}
              </Badge>
            ))}
          </div>
          {filters.tier.length === 0 && (
            <p className="text-xs text-muted-foreground">No filter = all tiers</p>
          )}
        </div>

        <Separator />

        {/* Toggles row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={filters.has_brand}
              onCheckedChange={(v) => onChange({ ...filters, has_brand: v })}
            />
            <Label className="text-sm">Has a brand</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={filters.has_referrals}
              onCheckedChange={(v) => onChange({ ...filters, has_referrals: v })}
            />
            <Label className="text-sm">Has referrals</Label>
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Min designs</Label>
            <Input
              type="number"
              min={0}
              value={filters.min_designs || ""}
              onChange={(e) =>
                onChange({ ...filters, min_designs: parseInt(e.target.value) || 0 })
              }
              className="rounded-xl h-9"
              placeholder="0"
            />
          </div>
        </div>

        <Separator />

        {/* Date filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-sm">Signed up after</Label>
            <Input
              type="date"
              value={filters.signed_up_after}
              onChange={(e) => onChange({ ...filters, signed_up_after: e.target.value })}
              className="rounded-xl h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Signed up before</Label>
            <Input
              type="date"
              value={filters.signed_up_before}
              onChange={(e) => onChange({ ...filters, signed_up_before: e.target.value })}
              className="rounded-xl h-9"
            />
          </div>
        </div>

        {/* Recipient count */}
        <div className="flex items-center gap-2 pt-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {countLoading ? (
              "Counting recipients…"
            ) : recipientCount !== null ? (
              <>
                <Badge variant="secondary" className="rounded-lg font-semibold">
                  {recipientCount}
                </Badge>{" "}
                matching user{recipientCount !== 1 ? "s" : ""}
              </>
            ) : (
              "Configure filters above"
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function EmailPreview({
  subject,
  headline,
  body,
  ctaText,
  ctaUrl,
}: {
  subject: string;
  headline: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
}) {
  const paragraphs = body.split("\n").filter((p) => p.trim());

  return (
    <Card className="rounded-2xl overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Email Preview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl overflow-hidden border border-border">
          <div style={{ background: "#1a1a2e" }} className="px-8 py-7 text-center">
            <h2 style={{ color: "#ffffff" }} className="font-bold text-xl leading-snug">
              {headline || subject || "Your headline appears here"}
            </h2>
          </div>
          <div style={{ background: "#fafaf9" }} className="px-8 py-7 space-y-3">
            {paragraphs.length > 0 ? (
              paragraphs.map((p, i) => (
                <p key={i} style={{ color: "#1a1a2e" }} className="text-sm leading-relaxed">
                  {p}
                </p>
              ))
            ) : (
              <p className="text-muted-foreground text-sm italic">Your message appears here…</p>
            )}
            {ctaText && ctaUrl && (
              <div className="pt-2 text-center">
                <span
                  style={{ background: "#c4a265", color: "#1a1a2e" }}
                  className="inline-block font-semibold text-sm px-6 py-2.5 rounded-xl"
                >
                  {ctaText}
                </span>
              </div>
            )}
          </div>
          <div style={{ background: "#fafaf9" }} className="border-t border-border px-8 py-4 text-center">
            <p className="text-xs text-muted-foreground">You received this from Brandie.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type CampaignView = "list" | "compose" | "report";

interface Campaign {
  id: string;
  admin_user_id: string;
  subject: string;
  headline: string;
  body: string;
  cta_text: string;
  cta_url: string;
  sender_name: string;
  segment_filters: SegmentFilters;
  status: string;
  scheduled_for: string | null;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
}

function EmailCRMTab() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<CampaignView>("list");
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [reportCampaign, setReportCampaign] = useState<Campaign | null>(null);

  // Campaign list
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const limit = 20;

  const { data: campaignData, isLoading: campaignsLoading } = useQuery({
    queryKey: ["admin-campaigns", page, searchTerm],
    queryFn: () =>
      adminAction({
        operation: "list",
        table: "email_campaigns",
        offset: page * limit,
        limit,
        search: searchTerm,
      }),
  });

  const campaigns = (campaignData?.rows || []) as Campaign[];
  const campaignCount = campaignData?.count || 0;
  const totalPages = Math.ceil(campaignCount / limit);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminAction({ operation: "delete", table: "email_campaigns", id }),
    onSuccess: () => {
      toast.success("Campaign deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleNewCampaign = () => {
    setEditingCampaign(null);
    setView("compose");
  };

  const handleEditCampaign = (c: Campaign) => {
    setEditingCampaign(c);
    setView("compose");
  };

  const handleDuplicate = async (c: Campaign) => {
    try {
      await adminAction({
        operation: "insert",
        table: "email_campaigns",
        data: {
          admin_user_id: c.admin_user_id || "00000000-0000-0000-0000-000000000000",
          subject: `${c.subject} (Copy)`,
          headline: c.headline,
          body: c.body,
          cta_text: c.cta_text,
          cta_url: c.cta_url,
          segment_filters: c.segment_filters,
          status: "draft",
        },
      });
      toast.success("Campaign duplicated");
      queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to duplicate");
    }
  };

  const handleReuse = (c: Campaign) => {
    setEditingCampaign({
      ...c,
      id: "",
      subject: `${c.subject} (Resend)`,
      status: "draft",
      sent_count: 0,
      failed_count: 0,
      recipient_count: 0,
      scheduled_for: null,
    });
    setView("compose");
  };

  const handleViewReport = (c: Campaign) => {
    setReportCampaign(c);
    setView("report");
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: "bg-muted text-muted-foreground",
      scheduled: "bg-blue-500/10 text-blue-600",
      sending: "bg-yellow-500/10 text-yellow-600",
      sent: "bg-green-500/10 text-green-600",
      failed: "bg-destructive/10 text-destructive",
    };
    return (
      <Badge className={`rounded-lg capitalize ${map[status] || ""}`} variant="outline">
        {status}
      </Badge>
    );
  };

  if (view === "compose") {
    return (
      <CampaignComposer
        campaign={editingCampaign}
        onBack={() => {
          setView("list");
          queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
        }}
      />
    );
  }

  if (view === "report" && reportCampaign) {
    return (
      <CampaignReport
        campaign={reportCampaign}
        onBack={() => setView("list")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Email Campaigns</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create, schedule, and send targeted email campaigns
          </p>
        </div>
        <Button onClick={handleNewCampaign} className="rounded-xl gap-2">
          <Plus className="h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(0);
            }}
            className="pl-9 rounded-xl"
          />
        </div>
      </div>

      {/* Campaign list */}
      {campaignsLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center">
            <Mail className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No campaigns yet</p>
            <Button onClick={handleNewCampaign} variant="outline" className="mt-4 rounded-xl gap-2">
              <Plus className="h-4 w-4" />
              Create your first campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <Card key={c.id} className="rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {statusBadge(c.status)}
                      {c.scheduled_for && c.status === "scheduled" && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(c.scheduled_for), "MMM d, yyyy h:mm a")}
                        </span>
                      )}
                    </div>
                    <p className="font-medium truncate">{c.subject}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {c.status === "sent" ? (
                        <>
                          {c.sent_count} sent · {c.failed_count} failed · {c.recipient_count} total
                        </>
                      ) : (
                        <>Created {format(new Date(c.created_at), "MMM d, yyyy")}</>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {c.status === "sent" && (
                      <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => handleReuse(c)} title="Reuse as template">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                    {c.status === "sent" && (
                      <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => handleViewReport(c)}>
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                    )}
                    {c.status === "draft" && (
                      <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => handleEditCampaign(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => handleDuplicate(c)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-xl text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(c.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p, 1))} disabled={page === 0} className="rounded-xl">
            Previous
          </Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded-xl">
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function CampaignComposer({
  campaign,
  onBack,
}: {
  campaign: Campaign | null;
  onBack: () => void;
}) {
  const [subject, setSubject] = useState(campaign?.subject || "");
  const [headline, setHeadline] = useState(campaign?.headline || "");
  const [body, setBody] = useState(campaign?.body || "");
  const [senderName, setSenderName] = useState(campaign?.sender_name || "Brandie");
  const [ctaText, setCtaText] = useState(campaign?.cta_text || "");
  const [ctaUrl, setCtaUrl] = useState(campaign?.cta_url || "");
  const [filters, setFilters] = useState<SegmentFilters>(
    campaign?.segment_filters || { ...DEFAULT_FILTERS }
  );
  const [showPreview, setShowPreview] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"now" | "schedule">("now");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Debounced segment count
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  const fetchCount = useCallback(async () => {
    setCountLoading(true);
    try {
      const result = await adminAction({
        operation: "segment_count",
        data: { segment_filters: filters },
      });
      setRecipientCount(result.count);
    } catch {
      setRecipientCount(null);
    } finally {
      setCountLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(fetchCount, 500);
    return () => clearTimeout(timer);
  }, [fetchCount]);

  const isValid = subject.trim() && body.trim();

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const payload = {
        subject,
        headline: headline || subject,
        body,
        cta_text: ctaText,
        cta_url: ctaUrl,
        sender_name: senderName || "Brandie",
        segment_filters: filters,
        status: "draft",
      };

      if (campaign?.id) {
        await adminAction({
          operation: "update",
          table: "email_campaigns",
          id: campaign.id,
          data: payload,
        });
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        await adminAction({
          operation: "insert",
          table: "email_campaigns",
          data: { ...payload, admin_user_id: user?.id },
        });
      }
      toast.success("Draft saved");
      onBack();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      let campaignId = campaign?.id;

      const payload: Record<string, unknown> = {
        subject,
        headline: headline || subject,
        body,
        cta_text: ctaText,
        cta_url: ctaUrl,
        sender_name: senderName || "Brandie",
        segment_filters: filters,
      };

      if (scheduleMode === "schedule" && scheduledDate) {
        const dateStr = format(scheduledDate, "yyyy-MM-dd");
        payload.status = "scheduled";
        payload.scheduled_for = `${dateStr}T${scheduledTime}:00.000Z`;
      } else {
        payload.status = "draft"; // will be updated to "sending" by send_campaign
      }

      if (campaignId) {
        await adminAction({
          operation: "update",
          table: "email_campaigns",
          id: campaignId,
          data: payload,
        });
      } else {
        const result = await adminAction({
          operation: "insert",
          table: "email_campaigns",
          data: { ...payload, admin_user_id: user?.id },
        });
        campaignId = result.row.id;
      }

      if (scheduleMode === "now") {
        // Send immediately
        const sendResult = await adminAction({
          operation: "send_campaign",
          data: { campaign_id: campaignId },
        });
        toast.success(`Campaign sent! ${sendResult.sent} delivered, ${sendResult.failed} failed`);
      } else {
        toast.success("Campaign scheduled successfully");
      }

      setConfirmOpen(false);
      onBack();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-semibold">
            {campaign ? "Edit Campaign" : "New Campaign"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Compose and target your email campaign
          </p>
        </div>
      </div>

      {/* Segment Builder */}
      <SegmentBuilder
        filters={filters}
        onChange={setFilters}
        recipientCount={recipientCount}
        countLoading={countLoading}
      />

      {/* Email Content */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Email Content</CardTitle>
          <CardDescription>
            Write your email. Paragraphs are separated by line breaks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Subject line <span className="text-destructive">*</span>
              </Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Exciting updates from Brandie"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Sender name</Label>
              <Input
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Brandie"
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Headline</Label>
            <Input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Shown prominently at the top (defaults to subject)"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label>
              Message body <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message here..."
              rows={6}
              className="rounded-xl resize-none"
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Link className="h-3.5 w-3.5" />
              Call-to-action (optional)
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                placeholder="Button text"
                className="rounded-xl"
              />
              <Input
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://..."
                className="rounded-xl"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {showPreview && (
        <EmailPreview
          subject={subject}
          headline={headline}
          body={body}
          ctaText={ctaText}
          ctaUrl={ctaUrl}
        />
      )}

      {/* Schedule Options */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Delivery
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <Button
              variant="default"
              className="rounded-xl flex-1 gap-2"
              disabled={!isValid || (recipientCount !== null && recipientCount === 0) || saving}
              onClick={() => {
                setScheduleMode("now");
                setConfirmOpen(true);
              }}
            >
              <Send className="h-4 w-4" />
              Send Now
            </Button>
            <Button
              variant={scheduleMode === "schedule" ? "default" : "outline"}
              className="rounded-xl flex-1"
              onClick={() => setScheduleMode("schedule")}
            >
              <CalendarIcon className="h-4 w-4 mr-2" />
              Schedule
            </Button>
          </div>

          {scheduleMode === "schedule" && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Date</Label>
                  <Input
                    type="date"
                    value={scheduledDate ? format(scheduledDate, "yyyy-MM-dd") : ""}
                    onChange={(e) => setScheduledDate(e.target.value ? new Date(e.target.value) : undefined)}
                    className="rounded-xl"
                    min={format(new Date(), "yyyy-MM-dd")}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Time (UTC)</Label>
                  <Input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>
              <Button
                className="rounded-xl w-full gap-2"
                disabled={!isValid || !scheduledDate || (recipientCount !== null && recipientCount === 0) || saving}
                onClick={() => setConfirmOpen(true)}
              >
                <CalendarIcon className="h-4 w-4" />
                Schedule Campaign
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setShowPreview((v) => !v)} className="rounded-xl gap-2">
          <Eye className="h-4 w-4" />
          {showPreview ? "Hide Preview" : "Preview"}
        </Button>
        <Button variant="outline" onClick={handleSaveDraft} disabled={!isValid || saving} className="rounded-xl gap-2">
          <FileText className="h-4 w-4" />
          Save Draft
        </Button>
      </div>

      {/* Confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {scheduleMode === "schedule" ? "Schedule Campaign?" : "Send Campaign Now?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {scheduleMode === "schedule" ? (
                <>
                  This campaign will be sent to{" "}
                  <strong>{recipientCount ?? "?"} user{(recipientCount ?? 0) !== 1 ? "s" : ""}</strong> on{" "}
                  <strong>
                    {scheduledDate ? format(scheduledDate, "MMM d, yyyy") : "-"} at {scheduledTime} UTC
                  </strong>.
                </>
              ) : (
                <>
                  This will immediately send <strong>"{subject}"</strong> to{" "}
                  <strong>{recipientCount ?? "?"} user{(recipientCount ?? 0) !== 1 ? "s" : ""}</strong>.
                  This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={saving}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} disabled={saving} className="rounded-xl">
              {saving ? "Processing…" : scheduleMode === "schedule" ? "Schedule" : "Send Now"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CampaignReport({
  campaign,
  onBack,
}: {
  campaign: Campaign;
  onBack: () => void;
}) {
  const { data: logsData, isLoading } = useQuery({
    queryKey: ["campaign-logs", campaign.id],
    queryFn: () =>
      adminAction({
        operation: "list",
        table: "email_campaign_logs",
        offset: 0,
        limit: 500,
        search: "",
      }),
  });

  // Filter logs for this campaign client-side (since we can't filter server-side by campaign_id easily via the generic list)
  const allLogs = (logsData?.rows || []) as Array<{
    id: string;
    campaign_id: string;
    email: string;
    status: string;
    error: string | null;
    sent_at: string;
  }>;
  const logs = allLogs.filter((l) => l.campaign_id === campaign.id);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-semibold">Campaign Report</h2>
          <p className="text-sm text-muted-foreground truncate">{campaign.subject}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Recipients" value={campaign.recipient_count} icon={Users} />
        <StatCard title="Sent" value={campaign.sent_count} icon={CheckCircle2} />
        <StatCard title="Failed" value={campaign.failed_count} icon={X} />
      </div>

      {/* Log table */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Delivery Log</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 rounded-xl" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No delivery logs</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{log.email}</p>
                    {log.error && (
                      <p className="text-xs text-destructive truncate">{log.error}</p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={`rounded-lg ml-2 ${
                      log.status === "sent"
                        ? "bg-green-500/10 text-green-600"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {log.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Admin Designs Gallery ───────────────────────────────────────────────────

function AdminDesignsTab() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const limit = 30;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-all-designs", page, search],
    queryFn: () =>
      adminAction({
        operation: "list",
        table: "designs",
        offset: page * limit,
        limit,
        search,
      }),
  });

  const { data: profilesData } = useQuery({
    queryKey: ["admin-all-profiles-map"],
    queryFn: () =>
      adminAction({
        operation: "list",
        table: "profiles",
        offset: 0,
        limit: 1000,
      }),
  });

  const profileMap = new Map<string, string>();
  ((profilesData?.rows || []) as Array<{ user_id: string; full_name: string | null }>).forEach((p) => {
    profileMap.set(p.user_id, p.full_name || "Unknown user");
  });

  const rows = (data?.rows || []) as Array<{
    id: string;
    title: string | null;
    prompt: string;
    image_url: string;
    created_at: string;
    canvas_size: string;
    user_id: string;
  }>;
  const count = data?.count || 0;
  const totalPages = Math.ceil(count / limit);

  const openViewer = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search designs..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9 rounded-xl"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()} className="rounded-xl">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">{count} total designs</p>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No designs found</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {rows.map((design, index) => (
            <div
              key={design.id}
              onClick={() => openViewer(index)}
              className="group relative rounded-xl border border-border overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
            >
              <div className="aspect-square">
                <img
                  src={design.image_url}
                  alt={design.title || design.prompt}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-xs font-medium truncate">
                  {design.title || "Untitled"}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-1 text-white/70">
                    <Users className="h-3 w-3" />
                    <span className="text-[10px] truncate max-w-[100px]">
                      {profileMap.get(design.user_id) || "Unknown"}
                    </span>
                  </div>
                  <span className="text-white/30">·</span>
                  <div className="flex items-center gap-1 text-white/70">
                    <Calendar className="h-3 w-3" />
                    <span className="text-[10px]">
                      {format(new Date(design.created_at), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-xl">Previous</Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded-xl">Next</Button>
        </div>
      )}

      <DesignViewer
        designs={rows}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
}

function UserDetailDialog({ detailItem, onClose }: { detailItem: Record<string, unknown> | null; onClose: () => void }) {
  const [email, setEmail] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);

  useEffect(() => {
    if (!detailItem?.user_id) {
      setEmail(null);
      return;
    }
    setEmailLoading(true);
    const fetchEmail = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await supabase.functions.invoke("admin-action", {
          body: { operation: "get_user_email", data: { user_id: detailItem.user_id } },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        setEmail(res.data?.email || null);
      } catch {
        setEmail(null);
      } finally {
        setEmailLoading(false);
      }
    };
    fetchEmail();
  }, [detailItem?.user_id]);

  const [grantOpen, setGrantOpen] = useState(false);
  const [grantAmount, setGrantAmount] = useState(5);
  const [grantReason, setGrantReason] = useState("");
  const [grantExpiry, setGrantExpiry] = useState(30);
  const [granting, setGranting] = useState(false);

  const [promoteOpen, setPromoteOpen] = useState(false);
  const [partnerName, setPartnerName] = useState("");
  const [partnerSlug, setPartnerSlug] = useState("");
  const [partnerOrg, setPartnerOrg] = useState("");
  const [partnerFirstPct, setPartnerFirstPct] = useState(0);
  const [partnerRecurringPct, setPartnerRecurringPct] = useState(0);
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    setPartnerName((detailItem?.full_name as string) || "");
    setPartnerSlug("");
    setPartnerOrg("");
    setPromoteOpen(false);
  }, [detailItem?.id]);

  const handlePromote = async () => {
    if (!detailItem?.user_id) return;
    setPromoting(true);
    try {
      await adminAction({
        operation: "promote_to_partner",
        data: {
          user_id: detailItem.user_id,
          name: partnerName.trim(),
          slug: partnerSlug.trim(),
          organization: partnerOrg.trim() || null,
          contact_email: email,
          commission_first_pct: partnerFirstPct,
          commission_recurring_pct: partnerRecurringPct,
        },
      });
      toast.success(`${partnerName} is now a Marketing Partner`);
      setPromoteOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to promote user");
    } finally {
      setPromoting(false);
    }
  };


  const currentTier = (detailItem?.subscription_tier as string) || "free";
  const [tier, setTier] = useState<string>(currentTier);
  const [savingTier, setSavingTier] = useState(false);
  useEffect(() => {
    setTier((detailItem?.subscription_tier as string) || "free");
  }, [detailItem?.id, detailItem?.subscription_tier]);

  const handleTierSave = async () => {
    if (!detailItem?.id || tier === currentTier) return;
    setSavingTier(true);
    try {
      await adminAction({
        operation: "update",
        table: "profiles",
        id: detailItem.id,
        data: { subscription_tier: tier },
      });
      toast.success(`Plan updated to ${tier}`);
      (detailItem as Record<string, unknown>).subscription_tier = tier;
    } catch (e: any) {
      toast.error(e.message || "Failed to update plan");
    } finally {
      setSavingTier(false);
    }
  };

  const handleGrant = async () => {
    if (!detailItem?.user_id || grantAmount < 1) return;
    setGranting(true);
    try {
      await adminAction({
        operation: "grant_reward",
        data: {
          user_id: detailItem.user_id,
          amount: grantAmount,
          reason: grantReason,
          expires_in_days: grantExpiry,
        },
      });
      toast.success(`Granted ${grantAmount} reward credits`);
      setGrantOpen(false);
      setGrantAmount(5);
      setGrantReason("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGranting(false);
    }
  };

  return (
    <Dialog open={!!detailItem} onOpenChange={() => onClose()}>
      <DialogContent className="rounded-2xl max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
        </DialogHeader>
        {detailItem && (
          <div className="space-y-3 mt-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">email</p>
              <p className="text-sm mt-0.5 break-all">
                {emailLoading ? <span className="text-muted-foreground italic">Loading...</span> : email || <span className="text-muted-foreground italic">-</span>}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">whatsapp number</p>
              <p className="text-sm mt-0.5 break-all">
                {detailItem.whatsapp_number ? String(detailItem.whatsapp_number) : <span className="text-muted-foreground italic">-</span>}
              </p>
            </div>
            {Object.entries(detailItem).map(([key, value]) => (
              <div key={key}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{key.replace(/_/g, " ")}</p>
                <p className="text-sm mt-0.5 break-all">
                  {value === null || value === undefined
                    ? <span className="text-muted-foreground italic">-</span>
                    : typeof value === "object"
                    ? JSON.stringify(value, null, 2)
                    : String(value)}
                </p>
              </div>
            ))}

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Subscription Plan</Label>
              <div className="flex gap-2">
                <select
                  className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
                  value={tier}
                  onChange={(e) => setTier(e.target.value)}
                >
                  <option value="free">Free</option>
                  <option value="entrepreneur">Entrepreneur (Paid)</option>
                  <option value="creator">Creator (Paid)</option>
                  <option value="agency">Agency (Paid)</option>
                </select>
                <Button
                  size="sm"
                  className="rounded-lg"
                  onClick={handleTierSave}
                  disabled={savingTier || tier === currentTier}
                >
                  {savingTier ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>

            <Button
              size="sm"
              className="w-full rounded-xl gap-2"
              onClick={() => setGrantOpen(true)}
            >
              <Gift className="h-4 w-4" />
              Grant Reward Credits
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="w-full rounded-xl gap-2"
              onClick={() => setPromoteOpen((v) => !v)}
            >
              <UserCheck className="h-4 w-4" />
              Promote to Partner
            </Button>

            {promoteOpen && (
              <div className="space-y-3 p-3 rounded-xl border bg-muted/30">
                <div>
                  <Label className="text-xs">Partner name</Label>
                  <Input
                    placeholder="e.g. Auxano"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    className="rounded-lg mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Referral slug</Label>
                  <Input
                    placeholder="auxano"
                    value={partnerSlug}
                    onChange={(e) => setPartnerSlug(e.target.value)}
                    className="rounded-lg mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">First payment %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={partnerFirstPct}
                      onChange={(e) => setPartnerFirstPct(Number(e.target.value))}
                      className="rounded-lg mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Recurring %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={partnerRecurringPct}
                      onChange={(e) => setPartnerRecurringPct(Number(e.target.value))}
                      className="rounded-lg mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Organization</Label>
                  <Input
                    value={partnerOrg}
                    onChange={(e) => setPartnerOrg(e.target.value)}
                    className="rounded-lg mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 rounded-lg"
                    disabled={promoting || !partnerName.trim() || partnerSlug.trim().length < 3}
                    onClick={handlePromote}
                  >
                    {promoting ? "Promoting..." : "Create partner"}
                  </Button>
                  <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => setPromoteOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}



            {grantOpen && (
              <div className="space-y-3 p-3 rounded-xl border bg-muted/30">
                <div>
                  <Label className="text-xs">Credits Amount</Label>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={grantAmount}
                    onChange={(e) => setGrantAmount(Number(e.target.value))}
                    className="rounded-lg mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Reason</Label>
                  <Input
                    placeholder="e.g. Contest winner, beta tester"
                    value={grantReason}
                    onChange={(e) => setGrantReason(e.target.value)}
                    className="rounded-lg mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Expires In</Label>
                  <select
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm mt-1"
                    value={grantExpiry}
                    onChange={(e) => setGrantExpiry(Number(e.target.value))}
                  >
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 rounded-lg" onClick={handleGrant} disabled={granting || grantAmount < 1}>
                    {granting ? "Granting..." : "Confirm"}
                  </Button>
                  <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => setGrantOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const NGN = (n: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

async function affiliateInsights(payload: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-affiliate-insights`,
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
    throw new Error(err.error || "Insights request failed");
  }
  return res.json();
}

type AnalyticsResponse = {
  totals: {
    affiliates: number;
    counts_by_status: Record<string, number>;
    total_earned_all: number;
    total_paid_all: number;
    outstanding_balance: number;
  };
  payouts: {
    pending_payout_owed: number;
    payouts_pending_count: number;
    payouts_paid_total: number;
  };
  commissions: {
    mtd: number;
    all_time: number;
    pending: number;
    by_type: Record<string, number>;
  };
  referrals: { total: number; paying: number; conversion_rate: number };
  top_earners: Array<{
    id: string;
    affiliate_code: string;
    email: string | null;
    total_earned: number;
    total_paid: number;
    referrals: number;
    paying_referrals: number;
  }>;
};

function AffiliateAnalyticsPanel({
  onOpenDetail,
}: {
  onOpenDetail: (id: string) => void;
}) {
  const { data, isLoading } = useQuery<AnalyticsResponse>({
    queryKey: ["admin-affiliate-analytics"],
    queryFn: () => affiliateInsights({ operation: "analytics" }),
  });

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (!data) return null;

  const status = data.totals.counts_by_status || {};

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users2 className="h-3.5 w-3.5" /> Affiliates
            </div>
            <p className="text-2xl font-semibold mt-1">
              {data.totals.affiliates}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Object.entries(status).map(([k, v]) => (
                <Badge key={k} variant="secondary" className="text-[10px]">
                  {k}: {v}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" /> Outstanding owed
            </div>
            <p className="text-2xl font-semibold mt-1">
              {NGN(data.totals.outstanding_balance)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {data.payouts.payouts_pending_count} payout request(s) ·{" "}
              {NGN(data.payouts.pending_payout_owed)} pending
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" /> Commissions MTD
            </div>
            <p className="text-2xl font-semibold mt-1">
              {NGN(data.commissions.mtd)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              All-time: {NGN(data.commissions.all_time)} · Pending:{" "}
              {NGN(data.commissions.pending)}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <UserCheck className="h-3.5 w-3.5" /> Referral conversion
            </div>
            <p className="text-2xl font-semibold mt-1">
              {(data.referrals.conversion_rate * 100).toFixed(1)}%
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {data.referrals.paying} paying / {data.referrals.total} referred
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Top earners
          </CardTitle>
          <CardDescription>Tap a row to open full affiliate profile</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.top_earners.length === 0 ? (
            <p className="text-sm text-muted-foreground">No earners yet.</p>
          ) : (
            data.top_earners.map((t, i) => (
              <button
                key={t.id}
                onClick={() => onOpenDetail(t.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-secondary/50 transition text-left"
              >
                <span className="font-serif text-lg text-muted-foreground w-6">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {t.email || t.affiliate_code}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {t.affiliate_code} · {t.referrals} referrals ·{" "}
                    {t.paying_referrals} paying
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{NGN(t.total_earned)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Paid: {NGN(t.total_paid)}
                  </p>
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type DetailResponse = {
  affiliate: Record<string, unknown> & {
    id: string;
    user_id: string;
    affiliate_code: string;
    status: string;
    commission_rate: number;
    total_earned: number;
    total_paid: number;
    bank_name: string | null;
    account_name: string | null;
    account_number: string | null;
    whatsapp_number: string | null;
    location: string | null;
    created_at: string;
    // Application fields (from the new signup wizard)
    primary_channel: string | null;
    channel_handle: string | null;
    channel_url: string | null;
    audience_size: string | null;
    audience_types: string[] | null;
    niche: string | null;
    regions: string[] | null;
    used_brandie: boolean | null;
    brandie_experience: string | null;
    promo_plan: string | null;
    content_types: string[] | null;
    posting_cadence: string | null;
    why_join: string | null;
    agreed_disclosure: boolean | null;
    agreed_terms: boolean | null;
    application_submitted_at: string | null;
  };
  email: string | null;
  recruiter: { affiliate_code: string; email: string | null } | null;
  referrals: Array<{
    id: string;
    referred_user_id: string;
    email: string | null;
    status: string;
    payment_count: number;
    created_at: string;
  }>;
  commissions: Array<{
    id: string;
    commission_amount: number;
    commission_type: string;
    status: string;
    created_at: string;
    payment_reference: string | null;
  }>;
  payouts: Array<{
    id: string;
    amount: number;
    status: string;
    created_at: string;
    processed_at: string | null;
  }>;
  stats: {
    referrals_count: number;
    paying_count: number;
    conversion_rate: number;
    pending_commission_total: number;
    requested_payout_total: number;
    outstanding_balance: number;
  };
};

// Human-friendly labels for application enums
const APPLICATION_LABELS: Record<string, string> = {
  // Channels
  instagram: "Instagram", tiktok: "TikTok", x: "X / Twitter", youtube: "YouTube",
  linkedin: "LinkedIn", newsletter: "Newsletter / Blog", podcast: "Podcast",
  whatsapp: "WhatsApp community", telegram: "Telegram community", other: "Other",
  // Audience sizes
  under_1k: "Under 1,000", "1k_5k": "1,000 – 5,000", "5k_25k": "5,000 – 25,000",
  "25k_100k": "25,000 – 100,000", "100k_plus": "100,000+",
  // Audience types
  smb_owners: "Small business owners", solopreneurs: "Solopreneurs / founders",
  creators: "Content creators", agencies: "Agencies / freelancers",
  marketers: "In-house marketers", students: "Students / early career",
  // Regions
  nigeria: "Nigeria", west_africa: "Rest of West Africa", africa: "Rest of Africa",
  europe: "Europe", north_america: "North America", asia: "Asia", global: "Global / mixed",
  // Content types
  reels: "Short-form video", feed_posts: "Feed posts / carousels", stories: "Stories",
  threads: "Threads / long-form", youtube_long: "Long-form video", livestream: "Livestreams / Spaces",
  dm_outreach: "1:1 DM / WhatsApp",
  // Cadence
  daily: "Daily", few_per_week: "A few times a week", weekly: "Weekly",
  monthly: "A few times a month", occasional: "Occasional / campaign-based",
};

const prettyLabel = (val: string) => APPLICATION_LABELS[val] || val.replace(/_/g, " ");



function AffiliateDetailDrawer({
  affiliateId,
  onClose,
}: {
  affiliateId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const open = !!affiliateId;

  const { data, isLoading, refetch } = useQuery<DetailResponse>({
    queryKey: ["admin-affiliate-detail", affiliateId],
    queryFn: () =>
      affiliateInsights({ operation: "detail", affiliate_id: affiliateId }),
    enabled: open,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  // --- Promote affiliate to Marketing Partner ---
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [pName, setPName] = useState("");
  const [pSlug, setPSlug] = useState("");
  const [pOrg, setPOrg] = useState("");
  const [pFirst, setPFirst] = useState(20);
  const [pRecurring, setPRecurring] = useState(10);
  const [promoting, setPromoting] = useState(false);
  const isPartner = (data?.affiliate?.tier as string) === "marketing_partner";

  useEffect(() => {
    setPromoteOpen(false);
    setPName(String((data?.affiliate as any)?.full_name || data?.email?.split("@")[0] || ""));
    setPSlug(String(data?.affiliate?.affiliate_code || "").toLowerCase());
    setPOrg("");
  }, [affiliateId, data?.email, data?.affiliate?.affiliate_code]);

  const handlePromote = async () => {
    if (!data?.affiliate?.user_id) return;
    setPromoting(true);
    try {
      await adminAction({
        operation: "promote_to_partner",
        data: {
          user_id: data.affiliate.user_id,
          name: pName.trim(),
          slug: pSlug.trim(),
          organization: pOrg.trim() || null,
          contact_email: data.email,
          commission_first_pct: pFirst,
          commission_recurring_pct: pRecurring,
        },
      });
      toast.success(`${pName} is now a Marketing Partner — notification email sent`);
      setPromoteOpen(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["admin-partners"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to promote affiliate");
    } finally {
      setPromoting(false);
    }
  };


  const updateAffiliate = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      adminAction({
        operation: "update",
        table: "affiliates",
        id: affiliateId,
        data: patch,
      }),
    onSuccess: () => {
      toast.success("Affiliate updated");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["admin-affiliate-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["admin-list", "affiliates"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updatePayout = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminAction({
        operation: "update",
        table: "affiliate_payouts",
        id,
        data: {
          status,
          processed_at:
            status === "paid" || status === "rejected"
              ? new Date().toISOString()
              : null,
        },
      }),
    onSuccess: () => {
      toast.success("Payout updated");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["admin-affiliate-analytics"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateCommission = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminAction({
        operation: "update",
        table: "affiliate_commissions",
        id,
        data: { status },
      }),
    onSuccess: () => {
      toast.success("Commission updated");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["admin-affiliate-analytics"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Affiliate profile</SheetTitle>
        </SheetHeader>

        {isLoading || !data ? (
          <div className="space-y-3 mt-6">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        ) : (
          <div className="space-y-6 mt-6">
            {/* Header */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-lg">
                  {data.email || data.affiliate.affiliate_code}
                </p>
                <Badge
                  variant={
                    data.affiliate.status === "approved"
                      ? "default"
                      : data.affiliate.status === "pending"
                      ? "secondary"
                      : "destructive"
                  }
                >
                  {data.affiliate.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Code: {data.affiliate.affiliate_code} · Joined{" "}
                {new Date(data.affiliate.created_at).toLocaleDateString()}
                {data.recruiter && (
                  <> · Recruited by {data.recruiter.email || data.recruiter.affiliate_code}</>
                )}
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border p-3">
                <p className="text-[11px] text-muted-foreground">Total earned</p>
                <p className="font-semibold">{NGN(data.affiliate.total_earned)}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-[11px] text-muted-foreground">Total paid</p>
                <p className="font-semibold">{NGN(data.affiliate.total_paid)}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-[11px] text-muted-foreground">Outstanding</p>
                <p className="font-semibold">{NGN(data.stats.outstanding_balance)}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-[11px] text-muted-foreground">Referrals</p>
                <p className="font-semibold">
                  {data.stats.referrals_count}{" "}
                  <span className="text-xs text-muted-foreground font-normal">
                    ({data.stats.paying_count} paying)
                  </span>
                </p>
              </div>
            </div>

            {/* Status controls */}
            <div className="rounded-xl border border-border p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Controls
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Status</Label>
                  <select
                    className="mt-1 w-full rounded-xl border border-border bg-background h-9 px-3 text-sm"
                    value={data.affiliate.status}
                    onChange={(e) =>
                      updateAffiliate.mutate({ status: e.target.value })
                    }
                    disabled={updateAffiliate.isPending}
                  >
                    <option value="pending">pending</option>
                    <option value="approved">approved</option>
                    <option value="suspended">suspended</option>
                    <option value="rejected">rejected</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Commission rate</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    defaultValue={data.affiliate.commission_rate}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v) && v !== data.affiliate.commission_rate) {
                        updateAffiliate.mutate({ commission_rate: v });
                      }
                    }}
                    className="mt-1 rounded-xl h-9"
                  />
                </div>
              </div>
            </div>

            {/* Promote to Marketing Partner */}
            <div className="rounded-xl border border-border p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Marketing Partner
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isPartner
                      ? "This affiliate is already a Marketing Partner."
                      : "Upgrade to the partner tier — unlocks the Partner CRM and sends them an email."}
                  </p>
                </div>
                {!promoteOpen && (
                  <Button
                    size="sm"
                    variant={isPartner ? "outline" : "default"}
                    className="rounded-xl shrink-0"
                    onClick={() => setPromoteOpen(true)}
                  >
                    {isPartner ? "Update partner" : "Promote to Partner"}
                  </Button>
                )}
              </div>

              {promoteOpen && (
                <div className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Partner name</Label>
                      <Input
                        className="mt-1 rounded-xl h-9"
                        value={pName}
                        onChange={(e) => setPName(e.target.value)}
                        placeholder="Partner display name"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Referral slug</Label>
                      <Input
                        className="mt-1 rounded-xl h-9"
                        value={pSlug}
                        onChange={(e) => setPSlug(e.target.value)}
                        placeholder="e.g. amina-media"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">First payment %</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        className="mt-1 rounded-xl h-9"
                        value={pFirst}
                        onChange={(e) => setPFirst(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Recurring %</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        className="mt-1 rounded-xl h-9"
                        value={pRecurring}
                        onChange={(e) => setPRecurring(Number(e.target.value))}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Organisation (optional)</Label>
                      <Input
                        className="mt-1 rounded-xl h-9"
                        value={pOrg}
                        onChange={(e) => setPOrg(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="rounded-xl"
                      disabled={promoting || !pName.trim() || pSlug.trim().length < 3}
                      onClick={handlePromote}
                    >
                      {promoting ? "Promoting…" : "Confirm & notify"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-xl"
                      disabled={promoting}
                      onClick={() => setPromoteOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>


            {/* Bank */}
            <div className="rounded-xl border border-border p-3 text-sm space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Payout details
              </p>
              <p>
                <span className="text-muted-foreground">Bank:</span>{" "}
                {data.affiliate.bank_name || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Account:</span>{" "}
                {data.affiliate.account_name || "—"} ·{" "}
                {data.affiliate.account_number || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">WhatsApp:</span>{" "}
                {data.affiliate.whatsapp_number || "—"} ·{" "}
                <span className="text-muted-foreground">Location:</span>{" "}
                {data.affiliate.location || "—"}
              </p>
            </div>

            {/* Application details (from signup wizard) */}
            <div className="rounded-xl border border-border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Application details
                </p>
                {data.affiliate.application_submitted_at && (
                  <p className="text-[11px] text-muted-foreground">
                    Submitted{" "}
                    {new Date(
                      data.affiliate.application_submitted_at,
                    ).toLocaleDateString()}
                  </p>
                )}
              </div>

              {/* Audience */}
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Audience
                </p>
                <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <p>
                    <span className="text-muted-foreground">Main channel:</span>{" "}
                    {data.affiliate.primary_channel
                      ? prettyLabel(data.affiliate.primary_channel)
                      : "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Audience size:</span>{" "}
                    {data.affiliate.audience_size
                      ? prettyLabel(data.affiliate.audience_size)
                      : "—"}
                  </p>
                  <p className="sm:col-span-2">
                    <span className="text-muted-foreground">Handle:</span>{" "}
                    {data.affiliate.channel_handle || "—"}
                    {data.affiliate.channel_url && (
                      <>
                        {" · "}
                        <a
                          href={data.affiliate.channel_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline break-all"
                        >
                          {data.affiliate.channel_url}
                        </a>
                      </>
                    )}
                  </p>
                  {data.affiliate.niche && (
                    <p className="sm:col-span-2">
                      <span className="text-muted-foreground">Niche:</span>{" "}
                      {data.affiliate.niche}
                    </p>
                  )}
                </div>
                {data.affiliate.audience_types && data.affiliate.audience_types.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {data.affiliate.audience_types.map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px]">
                        {prettyLabel(t)}
                      </Badge>
                    ))}
                  </div>
                )}
                {data.affiliate.regions && data.affiliate.regions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {data.affiliate.regions.map((r) => (
                      <Badge key={r} variant="outline" className="text-[10px]">
                        {prettyLabel(r)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Fit */}
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Brandie fit
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Used Brandie:</span>{" "}
                  {data.affiliate.used_brandie === true
                    ? "Yes"
                    : data.affiliate.used_brandie === false
                      ? "Not yet"
                      : "—"}
                </p>
                {data.affiliate.brandie_experience && (
                  <div className="text-sm">
                    <p className="text-muted-foreground text-xs mb-0.5">Experience</p>
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {data.affiliate.brandie_experience}
                    </p>
                  </div>
                )}
                {data.affiliate.why_join && (
                  <div className="text-sm">
                    <p className="text-muted-foreground text-xs mb-0.5">Why they want to join</p>
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {data.affiliate.why_join}
                    </p>
                  </div>
                )}
              </div>

              {/* Promo plan */}
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Promo plan
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Cadence:</span>{" "}
                  {data.affiliate.posting_cadence
                    ? prettyLabel(data.affiliate.posting_cadence)
                    : "—"}
                </p>
                {data.affiliate.content_types && data.affiliate.content_types.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {data.affiliate.content_types.map((c) => (
                      <Badge key={c} variant="secondary" className="text-[10px]">
                        {prettyLabel(c)}
                      </Badge>
                    ))}
                  </div>
                )}
                {data.affiliate.promo_plan && (
                  <div className="text-sm">
                    <p className="text-muted-foreground text-xs mb-0.5">Plan</p>
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {data.affiliate.promo_plan}
                    </p>
                  </div>
                )}
              </div>

              {/* Agreements */}
              <div className="space-y-1 pt-2 border-t border-border">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Agreements
                </p>
                <p className="text-xs flex items-center gap-1.5">
                  <span className={data.affiliate.agreed_disclosure ? "text-green-600" : "text-destructive"}>
                    {data.affiliate.agreed_disclosure ? "✓" : "✗"}
                  </span>
                  FTC disclosure
                </p>
                <p className="text-xs flex items-center gap-1.5">
                  <span className={data.affiliate.agreed_terms ? "text-green-600" : "text-destructive"}>
                    {data.affiliate.agreed_terms ? "✓" : "✗"}
                  </span>
                  Program terms
                </p>
              </div>
            </div>


            {/* Payouts */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Payout requests ({data.payouts.length})
              </p>
              {data.payouts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No payouts yet.</p>
              ) : (
                data.payouts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 rounded-xl border border-border p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{NGN(p.amount)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString()} · {p.status}
                      </p>
                    </div>
                    {(p.status === "requested" || p.status === "approved") && (
                      <div className="flex gap-1">
                        {p.status === "requested" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs rounded-lg"
                            onClick={() =>
                              updatePayout.mutate({ id: p.id, status: "approved" })
                            }
                          >
                            Approve
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="h-7 text-xs rounded-lg"
                          onClick={() =>
                            updatePayout.mutate({ id: p.id, status: "paid" })
                          }
                        >
                          Mark paid
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs rounded-lg text-destructive"
                          onClick={() =>
                            updatePayout.mutate({ id: p.id, status: "rejected" })
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Commissions */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Commissions ({data.commissions.length})
              </p>
              {data.commissions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No commissions yet.</p>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {data.commissions.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-2 rounded-xl border border-border p-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {NGN(c.commission_amount)}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {c.commission_type} ·{" "}
                          {new Date(c.created_at).toLocaleDateString()} ·{" "}
                          {c.status}
                        </p>
                      </div>
                      {c.status === "pending" && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs rounded-lg"
                            onClick={() =>
                              updateCommission.mutate({ id: c.id, status: "approved" })
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs rounded-lg text-destructive"
                            onClick={() =>
                              updateCommission.mutate({ id: c.id, status: "voided" })
                            }
                          >
                            Void
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Referrals */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Referrals ({data.referrals.length})
              </p>
              {data.referrals.length === 0 ? (
                <p className="text-xs text-muted-foreground">No referrals yet.</p>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                  {data.referrals.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-2 rounded-xl border border-border p-2.5 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{r.email || r.referred_user_id}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()} ·{" "}
                          {r.payment_count} payments · {r.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function PendingAffiliatesQueue({ onOpenDetail }: { onOpenDetail?: (id: string) => void }) {
  const queryClient = useQueryClient();

  const { data: pending, isLoading } = useQuery({
    queryKey: ["admin-pending-affiliates-list"],
    queryFn: async () => {
      const res = await adminAction({
        operation: "list",
        table: "affiliates",
        offset: 0,
        limit: 50,
        search: "pending",
      });
      return (res.rows || []).filter(
        (r: Record<string, unknown>) => r.status === "pending"
      );
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      affiliateCode,
      userEmail,
    }: {
      id: string;
      status: "approved" | "rejected";
      affiliateCode?: string;
      userEmail?: string;
    }) => {
      await adminAction({
        operation: "update",
        table: "affiliates",
        id,
        data: { status },
      });

      // Send approval/rejection email
      if (userEmail) {
        const emailType =
          status === "approved" ? "affiliate_approved" : "affiliate_rejected";
        const emailData =
          status === "approved"
            ? { affiliate_code: affiliateCode || "" }
            : {};

        try {
          await supabase.functions.invoke("send-email", {
            body: { type: emailType, to: userEmail, data: emailData },
          });
        } catch (e) {
          console.error("Failed to send status email:", e);
        }
      }
    },
    onSuccess: (_, vars) => {
      toast.success(
        vars.status === "approved"
          ? "Affiliate approved!"
          : "Affiliate rejected"
      );
      queryClient.invalidateQueries({ queryKey: ["admin-pending-affiliates"] });
      queryClient.invalidateQueries({
        queryKey: ["admin-pending-affiliates-list"],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-list", "affiliates"],
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-6">
          <Skeleton className="h-24 rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (!pending?.length) return null;

  return (
    <Card className="rounded-2xl border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-primary" />
          Pending Applications
          <Badge variant="secondary" className="ml-auto">
            {pending.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          Review and approve or reject affiliate applications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {pending.map((row: Record<string, unknown>) => (
          <div
            key={row.id as string}
            className="p-3 rounded-xl bg-background border border-border space-y-2"
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">
                    {String(row.affiliate_code)}
                  </p>
                  {row.primary_channel && (
                    <Badge variant="secondary" className="text-[10px]">
                      {prettyLabel(String(row.primary_channel))}
                      {row.channel_handle && ` · ${String(row.channel_handle)}`}
                    </Badge>
                  )}
                  {row.audience_size && (
                    <Badge variant="outline" className="text-[10px]">
                      {prettyLabel(String(row.audience_size))}
                    </Badge>
                  )}
                  {row.recruited_by && (
                    <Badge variant="outline" className="text-[10px]">
                      Recruited ✓
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {row.whatsapp_number && <span>{String(row.whatsapp_number)}</span>}
                  {row.location && <span>{String(row.location)}</span>}
                </div>
                {row.niche && (
                  <p className="text-xs text-muted-foreground italic truncate">
                    "{String(row.niche)}"
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                {onOpenDetail && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl h-8 px-3 text-xs"
                    onClick={() => onOpenDetail(row.id as string)}
                  >
                    Review
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10 h-8 px-3 text-xs"
                  disabled={actionMutation.isPending}
                  onClick={() =>
                    actionMutation.mutate({
                      id: row.id as string,
                      status: "rejected",
                      userEmail: row.user_id
                        ? `__resolve_user__:${row.user_id}`
                        : undefined,
                    })
                  }
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  className="rounded-xl h-8 px-3 text-xs"
                  disabled={actionMutation.isPending}
                  onClick={() =>
                    actionMutation.mutate({
                      id: row.id as string,
                      status: "approved",
                      affiliateCode: row.affiliate_code as string,
                      userEmail: row.user_id
                        ? `__resolve_user__:${row.user_id}`
                        : undefined,
                    })
                  }
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Approve
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DataTable({
  tableName,
  onOpenAffiliateDetail,
}: {
  tableName: string;
  onOpenAffiliateDetail?: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<Record<string, unknown> | null>(null);
  const limit = 20;

  const dbTable = tableName === "email_aliases" ? "email_sender_aliases" : tableName;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-list", tableName, page, search],
    queryFn: () =>
      adminAction({
        operation: "list",
        table: dbTable,
        offset: page * limit,
        limit,
        search,
      }),
  });


  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: Record<string, unknown> }) =>
      adminAction({
        operation: "update",
        table: dbTable,
        id: payload.id,
        data: payload.data,
      }),
    onSuccess: () => {
      toast.success("Record updated");
      queryClient.invalidateQueries({ queryKey: ["admin-list", tableName] });
      setSheetOpen(false);
      setEditItem(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      adminAction({ operation: "delete", table: dbTable, id }),
    onSuccess: () => {
      toast.success("Record deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-list", tableName] });
    },
    onError: (err: Error) => toast.error(err.message),
  });


  const rows = data?.rows || [];
  const count = data?.count || 0;
  const totalPages = Math.ceil(count / limit);

  const getDisplayValue = (row: Record<string, unknown>) => {
    if (tableName === "profiles") return row.full_name || row.user_id;
    if (tableName === "brands") return row.name;
    if (tableName === "designs") return row.title || row.prompt?.toString().slice(0, 40);
    if (tableName === "affiliates") return row.affiliate_code;
    if (tableName === "affiliate_commissions") return `$${row.commission_amount}`;
    if (tableName === "affiliate_payouts") return `$${row.amount}`;
    if (tableName === "user_roles") return row.role;
    if (tableName === "email_aliases") return `${row.handle}@trybrandie.com`;
    return row.id;
  };


  const getSubtitle = (row: Record<string, unknown>) => {
    if (tableName === "profiles") return row.subscription_tier;
    if (tableName === "brands") return row.tagline;
    if (tableName === "affiliates") return row.status;
    if (tableName === "affiliate_commissions") return row.status;
    if (tableName === "affiliate_payouts") return row.status;
    if (tableName === "user_roles") return row.user_id?.toString().slice(0, 8);
    if (tableName === "email_aliases") return `${row.status} · ${row.reply_to}`;
    return new Date(row.created_at as string).toLocaleDateString();
  };


  const handleEdit = (row: Record<string, unknown>) => {
    setEditItem({ ...row });
    setSheetOpen(true);
  };

  const handleSave = () => {
    if (!editItem) return;
    const { id, ...rest } = editItem;
    delete rest.created_at;
    delete rest.updated_at;
    updateMutation.mutate({ id: id as string, data: rest });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9 rounded-xl"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()} className="rounded-xl">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No records found</div>
      ) : (
        <div className="space-y-3">
          {rows.map((row: Record<string, unknown>) => (
            <Card key={row.id as string} className="rounded-2xl">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{String(getDisplayValue(row))}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {String(getSubtitle(row))}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  {tableName === "profiles" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDetailItem(row)}
                      className="rounded-xl"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  {tableName === "affiliates" && onOpenAffiliateDetail && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onOpenAffiliateDetail(row.id as string)}
                      className="rounded-xl"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(row)}
                    className="rounded-xl"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(row.id as string)}
                    className="rounded-xl text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-xl">Previous</Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded-xl">Next</Button>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Record</SheetTitle>
          </SheetHeader>
          {editItem && (
            <div className="space-y-4 mt-6">
              {Object.entries(editItem).map(([key, value]) => {
                if (key === "id" || key === "created_at" || key === "updated_at") {
                  return (
                    <div key={key}>
                      <label className="text-sm font-medium text-muted-foreground">{key}</label>
                      <p className="text-sm mt-1 truncate">{String(value)}</p>
                    </div>
                  );
                }
                return (
                  <div key={key}>
                    <label className="text-sm font-medium">{key}</label>
                    <Input
                      className="mt-1 rounded-xl"
                      value={typeof value === "object" ? JSON.stringify(value) : String(value ?? "")}
                      onChange={(e) =>
                        setEditItem((prev) => (prev ? { ...prev, [key]: e.target.value } : null))
                      }
                    />
                  </div>
                );
              })}
              <Button onClick={handleSave} disabled={updateMutation.isPending} className="w-full rounded-xl">
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) deleteMutation.mutate(deleteId);
                setDeleteId(null);
              }}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {tableName === "profiles" && (
        <UserDetailDialog detailItem={detailItem} onClose={() => setDetailItem(null)} />
      )}
    </div>
  );
}

export default function Admin() {
  const { isAdmin, loading: adminLoading } = useAdminRole();
  const [activeTab, setActiveTab] = useState("overview");
  const [affiliateDetailId, setAffiliateDetailId] = useState<string | null>(null);

  const { data: pendingCount } = useQuery({
    queryKey: ["admin-pending-affiliates"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("affiliates")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });

  return (
    <div className="min-h-screen bg-background lg:pl-20 pb-24">
      <NewAppHeader />
      <main className="container max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6">Admin Panel</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <ScrollArea className="w-full">
            <TabsList className="inline-flex w-max gap-1 p-1 mb-6 rounded-2xl bg-muted">
              {TABLES.map((t) => (
                <TabsTrigger
                  key={t.key}
                  value={t.key}
                  className="rounded-xl px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm relative"
                >
                  <t.icon className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">{t.label}</span>
                  {t.key === "affiliates" && !!pendingCount && pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                      {pendingCount}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <TabsContent value="overview">
            <OverviewTab />
          </TabsContent>

          <TabsContent value="support">
            <SupportTab />
          </TabsContent>

          <TabsContent value="email_crm">
            <EmailCRMTab />
          </TabsContent>

          <TabsContent value="designs">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5" />
                  Designs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AdminDesignsTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="affiliates">
            <div className="space-y-6">
              <AffiliateAnalyticsPanel onOpenDetail={setAffiliateDetailId} />
              <PendingAffiliatesQueue onOpenDetail={setAffiliateDetailId} />
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5" />
                    All Affiliates
                  </CardTitle>
                  <CardDescription>
                    Tap the eye icon on any row to view full profile, payouts, commissions and referrals.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DataTable
                    tableName="affiliates"
                    onOpenAffiliateDetail={setAffiliateDetailId}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <AffiliateDetailDrawer
            affiliateId={affiliateDetailId}
            onClose={() => setAffiliateDetailId(null)}
          />


          <TabsContent value="subscriptions">
            <SubscriptionsTab />
          </TabsContent>

          <TabsContent value="partners">
            <AdminPartnersTab />
          </TabsContent>

          {TABLES.filter((t) => !["overview","support","email_crm","designs","ai_traces","affiliates","rewards","subscriptions","partners"].includes(t.key)).map((t) => (

            <TabsContent key={t.key} value={t.key}>
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <t.icon className="h-5 w-5" />
                    {t.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DataTable tableName={t.key} />
                </CardContent>
              </Card>
            </TabsContent>
          ))}

          <TabsContent value="rewards">
            <RewardsTab />
          </TabsContent>

          <TabsContent value="ai_traces">
            <AdminTracesTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
