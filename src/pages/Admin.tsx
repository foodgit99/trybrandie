import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppHeader from "@/components/AppHeader";
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
} from "lucide-react";
import { format } from "date-fns";
import DesignViewer from "@/components/DesignViewer";

const TABLES = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "email_crm", label: "Email CRM", icon: Mail },
  { key: "profiles", label: "Users", icon: Users },
  { key: "brands", label: "Brands", icon: Palette },
  { key: "designs", label: "Designs", icon: Image },
  { key: "affiliates", label: "Affiliates", icon: UserCheck },
  { key: "affiliate_commissions", label: "Commissions", icon: DollarSign },
  { key: "affiliate_payouts", label: "Payouts", icon: DollarSign },
  { key: "user_roles", label: "Roles", icon: Users },
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
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-xl">
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
        segment_filters: filters,
        status: "draft",
      };

      if (campaign) {
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
                    {scheduledDate ? format(scheduledDate, "MMM d, yyyy") : "—"} at {scheduledTime} UTC
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
                {emailLoading ? <span className="text-muted-foreground italic">Loading...</span> : email || <span className="text-muted-foreground italic">—</span>}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">whatsapp number</p>
              <p className="text-sm mt-0.5 break-all">
                {detailItem.whatsapp_number ? String(detailItem.whatsapp_number) : <span className="text-muted-foreground italic">—</span>}
              </p>
            </div>
            {Object.entries(detailItem).map(([key, value]) => (
              <div key={key}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{key.replace(/_/g, " ")}</p>
                <p className="text-sm mt-0.5 break-all">
                  {value === null || value === undefined
                    ? <span className="text-muted-foreground italic">—</span>
                    : typeof value === "object"
                    ? JSON.stringify(value, null, 2)
                    : String(value)}
                </p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DataTable({ tableName }: { tableName: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<Record<string, unknown> | null>(null);
  const limit = 20;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-list", tableName, page, search],
    queryFn: () =>
      adminAction({
        operation: "list",
        table: tableName,
        offset: page * limit,
        limit,
        search,
      }),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: Record<string, unknown> }) =>
      adminAction({
        operation: "update",
        table: tableName,
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
      adminAction({ operation: "delete", table: tableName, id }),
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
    return row.id;
  };

  const getSubtitle = (row: Record<string, unknown>) => {
    if (tableName === "profiles") return row.subscription_tier;
    if (tableName === "brands") return row.tagline;
    if (tableName === "affiliates") return row.status;
    if (tableName === "affiliate_commissions") return row.status;
    if (tableName === "affiliate_payouts") return row.status;
    if (tableName === "user_roles") return row.user_id?.toString().slice(0, 8);
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
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6">Admin Panel</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <ScrollArea className="w-full">
            <TabsList className="inline-flex w-max gap-1 p-1 mb-6 rounded-2xl bg-muted">
              {TABLES.map((t) => (
                <TabsTrigger
                  key={t.key}
                  value={t.key}
                  className="rounded-xl px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <t.icon className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">{t.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <TabsContent value="overview">
            <OverviewTab />
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

          {TABLES.filter((t) => t.key !== "overview" && t.key !== "email_crm" && t.key !== "designs").map((t) => (
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
        </Tabs>
      </main>
    </div>
  );
}
